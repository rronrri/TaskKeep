import { after, NextResponse } from "next/server";
import { apiError, requireApiUser, sanitizeSearch } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { taskSchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";
import { reminderFields } from "@/lib/tasks/reminders";
import { syncTaskReminders } from "@/lib/tasks/schedule-reminders";
import { verifyDriveFolder } from "@/lib/google-drive";
import { resolveDriveOwner } from "@/lib/google-drive/resolve-owner";
import { resolveTeamIds } from "@/lib/tasks/team-scope";

// Los parámetros llegan de la URL, así que hay que tolerar cualquier cosa: sin
// esto, `?page=abc` produce un NaN que revienta el rango, y una fecha inválida
// hace que `toISOString()` lance y devuelva un 500 sin contexto.
function positiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

/** Convierte `YYYY-MM-DD` en un instante; devuelve null si no es una fecha válida. */
function boundaryDate(value: string | null, endOfDay: boolean) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(endOfDay ? `${value}T23:59:59.999Z` : `${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  try {
    const url = new URL(request.url);
    const page = positiveInt(url.searchParams.get("page"), 1, 100_000);
    const size = positiveInt(url.searchParams.get("size"), 20, 50);
    const supabase = createAdminClient();
    let query = supabase
      .from("tasks")
      .select("*, responsible:users!tasks_responsible_id_fkey(full_name,email)", { count: "exact" })
      .is("deleted_at", null);
    if (auth.user.role !== "admin") query = query.eq("company_id", auth.user.companyId!);
    if (auth.user.role === "collaborator") query = query.eq("responsible_id", auth.user.id);
    if (auth.user.role === "manager") {
      const teamIds = await resolveTeamIds(supabase, auth.user.id, "manager");
      query = query.in("responsible_id", teamIds);
    }
    for (const key of ["status", "priority", "responsible_id"] as const) {
      const value = url.searchParams.get(key);
      if (value) query = query.eq(key, value);
    }
    if (url.searchParams.get("pinned") === "true") query = query.eq("is_pinned", true);
    const folderId = url.searchParams.get("folder_id");
    if (folderId === "none") query = query.is("folder_id", null);
    else if (folderId) query = query.eq("folder_id", folderId);
    const search = sanitizeSearch(url.searchParams.get("q"));
    if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    const deadlineFrom = boundaryDate(url.searchParams.get("deadline_from"), false);
    const deadlineTo = boundaryDate(url.searchParams.get("deadline_to"), true);
    if (deadlineFrom) query = query.gte("deadline", deadlineFrom);
    if (deadlineTo) query = query.lte("deadline", deadlineTo);
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
  } catch (error) {
    return apiError(error);
  }
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
    // El equipo de quien crea (gestor/a + sus colaboradores/as, o el equipo de
    // quien lo/la creó si es colaborador/a) acota tanto a quién se le puede
    // asignar la tarea como en qué carpeta se puede archivar.
    const teamIds = await resolveTeamIds(supabase, auth.user.id, auth.user.role as "manager" | "collaborator");
    const { data: responsible } = await supabase
      .from("users")
      .select("id")
      .eq("id", input.responsible_id)
      .eq("company_id", auth.user.companyId!)
      .eq("is_active", true)
      .is("deleted_at", null)
      .in("id", teamIds)
      .maybeSingle();
    if (!responsible) return NextResponse.json({ error: "Responsable no válido" }, { status: 400 });
    let assignedFolderId: string | null = null;
    let assignedFolderName: string | null = null;
    if (input.drive_folder_id && auth.user.role === "manager") {
      const owner = await resolveDriveOwner(supabase, auth.user.companyId!, input.responsible_id);
      if (!owner) return NextResponse.json({ error: "Conecta Google Drive antes de asignar una carpeta" }, { status: 409 });
      try {
        const verified = await verifyDriveFolder(input.drive_folder_id, owner.ownerId);
        assignedFolderId = verified.id;
        assignedFolderName = verified.name;
      } catch {
        return NextResponse.json({ error: "No se pudo validar la carpeta de Google Drive elegida" }, { status: 400 });
      }
    }
    if (input.folder_id) {
      const { data: folder, error: folderError } = await supabase
        .from("task_folders")
        .select("id,created_by")
        .eq("id", input.folder_id)
        .eq("company_id", auth.user.companyId!)
        .maybeSingle();
      if (folderError) throw folderError;
      if (!folder || !folder.created_by || !teamIds.includes(folder.created_by)) {
        return NextResponse.json({ error: "Carpeta no encontrada" }, { status: 404 });
      }
    }
    const reminder = reminderFields(input.reminder_mode, input.deadline, input.reminder_settings);
    const { data, error } = await supabase
      .from("tasks")
      .insert({ ...input, ...reminder, company_id: auth.user.companyId, created_by: auth.user.id, drive_folder_id: assignedFolderId, drive_folder_name: assignedFolderName })
      .select()
      .single();
    if (error) throw error;
    // Sin carpeta asignada a mano, no se crea ninguna todavía: nace recién al
    // primer uso real (subir un archivo, o abrir el explorador de Drive de la
    // tarea), no solo por haber creado la tarea.
    after(async () => {
      const results = await Promise.allSettled([
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

function reportBackgroundFailures(context: string, results: PromiseSettledResult<unknown>[]) {
  for (const result of results) {
    if (result.status === "rejected") console.error(`Proceso posterior al ${context} falló`, result.reason);
  }
}

