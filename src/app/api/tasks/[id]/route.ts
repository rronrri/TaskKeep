import { after, NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { updateTaskSchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";
import { reminderFields } from "@/lib/tasks/reminders";
import { cancelTaskReminders, syncTaskReminders } from "@/lib/tasks/schedule-reminders";
import type { SessionUser } from "@/types";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    let taskQuery = supabase
      .from("tasks")
      .select("*, responsible:users!tasks_responsible_id_fkey(full_name,email), company:companies!tasks_company_id_fkey(drive_folder_id,drive_owner_user_id)")
      .eq("id", id)
      .is("deleted_at", null);
    if (auth.user.role !== "admin") taskQuery = taskQuery.eq("company_id", auth.user.companyId!);
    if (auth.user.role === "collaborator") taskQuery = taskQuery.eq("responsible_id", auth.user.id);
    const { data: task, error: taskError } = await taskQuery.maybeSingle();
    if (taskError) throw taskError;
    if (!task) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    let filesQuery = supabase
      .from("task_files")
      .select("id,uploaded_by,file_name,mime_type,file_size,drive_web_url,created_at,approval_status,review_comment,reviewed_at,uploader:users!task_files_uploaded_by_fkey(full_name,role),reviewer:users!task_files_reviewed_by_fkey(full_name)")
      .eq("task_id", id)
      .is("deleted_at", null);
    if (auth.user.role === "collaborator") {
      filesQuery = filesQuery.or(`approval_status.eq.approved,uploaded_by.eq.${auth.user.id}`);
    }
    const [comments, logs, requests, files] = await Promise.all([
      supabase.from("task_comments").select("id,comment,created_at,user:users(full_name,role)").eq("task_id", id).is("deleted_at", null).order("created_at", { ascending: true }),
      supabase.from("task_status_logs").select("id,old_status,new_status,source,created_at,user:users!task_status_logs_changed_by_fkey(full_name)").eq("task_id", id).order("created_at", { ascending: false }),
      supabase.from("task_status_requests").select("id,old_status,requested_status,review_status,manager_comment,created_at,reviewed_at,requester:users!task_status_requests_requested_by_fkey(full_name),reviewer:users!task_status_requests_reviewed_by_fkey(full_name)").eq("task_id", id).order("created_at", { ascending: false }),
      filesQuery.order("created_at", { ascending: false }),
    ]);
    for (const result of [comments, logs, requests, files]) if (result.error) throw result.error;
    return NextResponse.json({
      data: task,
      comments: comments.data ?? [],
      history: logs.data ?? [],
      requests: requests.data ?? [],
      files: files.data ?? [],
      capabilities: {
        canComment: auth.user.role === "manager" || auth.user.role === "collaborator",
        canUpload: auth.user.role === "manager" || auth.user.role === "collaborator",
        canReviewFiles: auth.user.role === "manager",
        currentUserId: auth.user.id,
        driveConfigured: Boolean((Array.isArray(task.company) ? task.company[0] : task.company)?.drive_folder_id && (Array.isArray(task.company) ? task.company[0] : task.company)?.drive_owner_user_id),
        taskFolderId: task.drive_folder_id ?? null,
        taskFolderName: task.drive_folder_name ?? null,
        isOwnTask: task.created_by === auth.user.id && task.responsible_id === auth.user.id,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  const auth = await requireApiUser(["manager", "collaborator"]);
  if (auth.error) return auth.error;
  const { id } = await context.params;
  const response = await applyTaskUpdate(request, auth.user, id);
  // Reconciliamos los recordatorios programados solo si la actualización tuvo éxito.
  if (response.status < 300) {
    defer("reprogramar los recordatorios", () => syncTaskReminders(id));
  }
  return response;
}

async function applyTaskUpdate(request: Request, user: SessionUser, id: string) {
  const auth = { user };
  try {
    const input = updateTaskSchema.parse(await request.json());
    const normalized = input.reminder_mode
      ? { ...input, ...reminderFields(input.reminder_mode, input.deadline, input.reminder_settings) }
      : input;
    const supabase = createAdminClient();
    if (auth.user.role === "collaborator") {
      const { data: owned } = await supabase
        .from("tasks")
        .select("id,status")
        .eq("id", id)
        .eq("company_id", auth.user.companyId!)
        .eq("created_by", auth.user.id)
        .eq("responsible_id", auth.user.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (!owned) return NextResponse.json({ error: "Solo puedes editar tareas creadas por ti" }, { status: 403 });
      if (normalized.responsible_id && normalized.responsible_id !== auth.user.id) {
        return NextResponse.json({ error: "No puedes asignar tareas a otras personas" }, { status: 403 });
      }
      const update = { ...normalized, responsible_id: auth.user.id, is_pinned: undefined };
      delete update.is_pinned;
      const { data, error } = await supabase
        .from("tasks")
        .update({ ...update, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      if (normalized.status && normalized.status !== owned.status) {
        await supabase.from("task_status_logs").insert({
          task_id: id,
          changed_by: auth.user.id,
          old_status: owned.status,
          new_status: normalized.status,
          source: "collaborator_self_direct",
        });
      }
      defer("registrar la edición en auditoría", () => writeAudit({ actorId: auth.user.id, companyId: auth.user.companyId, action: "task.updated", entityType: "task", entityId: id }));
      return NextResponse.json({ data });
    }
    if (normalized.responsible_id) {
      const { data: responsible } = await supabase
        .from("users")
        .select("id")
        .eq("id", normalized.responsible_id)
        .eq("company_id", auth.user.companyId!)
        .eq("is_active", true)
        .is("deleted_at", null)
        .maybeSingle();
      if (!responsible) {
        return NextResponse.json({ error: "Responsable no válido" }, { status: 400 });
      }
    }
    if (normalized.status) {
      const { data, error } = await supabase.rpc("manager_update_task_status", {
        target_task_id: id,
        actor_id: auth.user.id,
        actor_company_id: auth.user.companyId,
        next_status: normalized.status,
      });
      if (error) throw error;
      const rest = { ...normalized };
      delete rest.status;
      if (Object.keys(rest).length === 0) {
        defer("registrar el estado en auditoría", () => writeAudit({ actorId: auth.user.id, companyId: auth.user.companyId, action: "task.status_updated", entityType: "task", entityId: id, metadata: { status: normalized.status } }));
        return NextResponse.json({ data });
      }
      const { data: updated, error: updateError } = await supabase
        .from("tasks")
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("company_id", auth.user.companyId!)
        .is("deleted_at", null)
        .select()
        .single();
      if (updateError) throw updateError;
      defer("registrar la edición en auditoría", () => writeAudit({ actorId: auth.user.id, companyId: auth.user.companyId, action: "task.updated", entityType: "task", entityId: id }));
      return NextResponse.json({ data: updated });
    }
    const { data, error } = await supabase
      .from("tasks")
      .update({ ...normalized, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("company_id", auth.user.companyId!)
      .is("deleted_at", null)
      .select()
      .single();
    if (error) throw error;
    defer("registrar la edición en auditoría", () => writeAudit({ actorId: auth.user.id, companyId: auth.user.companyId, action: "task.updated", entityType: "task", entityId: id }));
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, context: Context) {
  const auth = await requireApiUser(["manager", "collaborator"]);
  if (auth.error) return auth.error;
  const { id } = await context.params;
  const now = new Date().toISOString();
  let query = createAdminClient()
    .from("tasks")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", id)
    .eq("company_id", auth.user.companyId!);
  if (auth.user.role === "collaborator") {
    query = query.eq("created_by", auth.user.id).eq("responsible_id", auth.user.id);
  }
  const { data, error } = await query.select("id").maybeSingle();
  if (error) return apiError(error);
  if (!data) return NextResponse.json({ error: "Solo puedes eliminar tareas creadas por ti" }, { status: 403 });
  defer("finalizar la eliminación", async () => {
    const results = await Promise.allSettled([
      cancelTaskReminders(id),
      writeAudit({ actorId: auth.user.id, companyId: auth.user.companyId, action: "task.deleted", entityType: "task", entityId: id }),
    ]);
    for (const result of results) if (result.status === "rejected") console.error("Proceso posterior a eliminar tarea falló", result.reason);
  });
  return NextResponse.json({ ok: true });
}

function defer(label: string, operation: () => Promise<unknown>) {
  after(async () => {
    try {
      await operation();
    } catch (error) {
      console.error(`No se pudo ${label}`, error);
    }
  });
}
