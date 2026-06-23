import { after, NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { taskSchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";
import { reminderFields } from "@/lib/tasks/reminders";
import { syncTaskReminders } from "@/lib/tasks/schedule-reminders";
import { createDriveFolder } from "@/lib/google-drive";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const size = Math.min(50, Math.max(1, Number(url.searchParams.get("size") ?? 20)));
  const supabase = createAdminClient();
  let query = supabase
    .from("tasks")
    .select("*, responsible:users!tasks_responsible_id_fkey(full_name,email)", { count: "exact" })
    .is("deleted_at", null);
  if (auth.user.role !== "admin") query = query.eq("company_id", auth.user.companyId!);
  if (auth.user.role === "collaborator") query = query.eq("responsible_id", auth.user.id);
  for (const key of ["status", "priority", "responsible_id"] as const) {
    const value = url.searchParams.get(key);
    if (value) query = query.eq(key, value);
  }
  if (url.searchParams.get("pinned") === "true") query = query.eq("is_pinned", true);
  const folderId = url.searchParams.get("folder_id");
  if (folderId === "none") query = query.is("folder_id", null);
  else if (folderId) query = query.eq("folder_id", folderId);
  const search = url.searchParams.get("q")?.trim();
  if (search) query = query.or(`title.ilike.%${search.replaceAll("%", "")}%,description.ilike.%${search.replaceAll("%", "")}%`);
  const deadlineFrom = url.searchParams.get("deadline_from");
  const deadlineTo = url.searchParams.get("deadline_to");
  if (deadlineFrom) query = query.gte("deadline", new Date(`${deadlineFrom}T00:00:00`).toISOString());
  if (deadlineTo) query = query.lte("deadline", new Date(`${deadlineTo}T23:59:59.999`).toISOString());
  const sort = url.searchParams.get("sort") ?? "deadline_asc";
  const sortOptions: Record<string, { column: string; ascending: boolean }> = {
    newest: { column: "created_at", ascending: false },
    oldest: { column: "created_at", ascending: true },
    deadline_asc: { column: "deadline", ascending: true },
    deadline_desc: { column: "deadline", ascending: false },
    priority: { column: "priority", ascending: false },
    status: { column: "status", ascending: true },
  };
  const ordering = sortOptions[sort] ?? sortOptions.deadline_asc;
  const { data, count, error } = await query
    .order("is_pinned", { ascending: false })
    .order(ordering.column, { ascending: ordering.ascending, nullsFirst: false })
    .range((page - 1) * size, page * size - 1);
  if (error) return apiError(error);
  return NextResponse.json({ data, pagination: { page, size, total: count ?? 0 } });
}

export async function POST(request: Request) {
  const auth = await requireApiUser(["manager", "collaborator"]);
  if (auth.error) return auth.error;
  try {
    const raw = await request.json();
    const input = taskSchema.parse(auth.user.role === "collaborator"
      ? { ...raw, responsible_id: auth.user.id, status: "pending", is_pinned: false }
      : raw);
    const supabase = createAdminClient();
    const { data: responsible } = await supabase
      .from("users")
      .select("id")
      .eq("id", input.responsible_id)
      .eq("company_id", auth.user.companyId!)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle();
    if (!responsible) return NextResponse.json({ error: "Responsable no válido" }, { status: 400 });
    if (input.folder_id) {
      const { data: folder, error: folderError } = await supabase
        .from("task_folders")
        .select("id")
        .eq("id", input.folder_id)
        .eq("company_id", auth.user.companyId!)
        .maybeSingle();
      if (folderError) throw folderError;
      if (!folder) return NextResponse.json({ error: "Carpeta no encontrada" }, { status: 404 });
    }
    const reminder = reminderFields(input.reminder_mode, input.deadline, input.reminder_settings);
    const { data, error } = await supabase
      .from("tasks")
      .insert({ ...input, ...reminder, company_id: auth.user.companyId, created_by: auth.user.id })
      .select()
      .single();
    if (error) throw error;
    after(async () => {
      const results = await Promise.allSettled([
        createTaskDriveFolder(data.id, data.title, auth.user.companyId!),
        writeAudit({ actorId: auth.user.id, companyId: auth.user.companyId, action: "task.created", entityType: "task", entityId: data.id, metadata: { title: data.title } }),
        syncTaskReminders(data.id),
      ]);
      reportBackgroundFailures("crear tarea", results);
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

async function createTaskDriveFolder(taskId: string, title: string, companyId: string) {
  const supabase = createAdminClient();
  const { data: company, error } = await supabase
    .from("companies")
    .select("drive_folder_id,drive_owner_user_id")
    .eq("id", companyId)
    .maybeSingle();
  if (error) throw error;
  if (!company?.drive_folder_id || !company.drive_owner_user_id) return;
  const taskFolder = await createDriveFolder(taskFolderName(taskId, title), company.drive_folder_id, company.drive_owner_user_id);
  const { error: updateError } = await supabase.from("tasks").update({ drive_folder_id: taskFolder.id }).eq("id", taskId);
  if (updateError) throw updateError;
}

function reportBackgroundFailures(context: string, results: PromiseSettledResult<unknown>[]) {
  for (const result of results) {
    if (result.status === "rejected") console.error(`Proceso posterior al ${context} falló`, result.reason);
  }
}

function taskFolderName(id: string, title: string) {
  return `TK-${id.slice(0, 8)} - ${title}`.slice(0, 120);
}
