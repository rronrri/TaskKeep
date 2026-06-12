import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { taskSchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";
import { createDriveFolder, isDriveConfigured } from "@/lib/google-drive";

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
    .order(ordering.column, { ascending: ordering.ascending })
    .range((page - 1) * size, page * size - 1);
  if (error) return apiError(error);
  return NextResponse.json({ data, pagination: { page, size, total: count ?? 0 } });
}

export async function POST(request: Request) {
  const auth = await requireApiUser(["manager"]);
  if (auth.error) return auth.error;
  try {
    const input = taskSchema.parse(await request.json());
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
    let driveFolderId: string | null = null;
    if (isDriveConfigured()) {
      const { data: company } = await supabase.from("companies").select("name,drive_folder_id").eq("id", auth.user.companyId!).single();
      let parentId = company?.drive_folder_id;
      if (!parentId && company) {
        const companyFolder = await createDriveFolder(company.name, process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!);
        parentId = companyFolder.id;
        await supabase.from("companies").update({ drive_folder_id: parentId }).eq("id", auth.user.companyId!);
      }
      if (parentId) driveFolderId = (await createDriveFolder(input.title, parentId)).id;
    }
    const { data, error } = await supabase
      .from("tasks")
      .insert({ ...input, company_id: auth.user.companyId, created_by: auth.user.id, drive_folder_id: driveFolderId })
      .select()
      .single();
    if (error) throw error;
    await writeAudit({ actorId: auth.user.id, companyId: auth.user.companyId, action: "task.created", entityType: "task", entityId: data.id, metadata: { title: data.title } });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
