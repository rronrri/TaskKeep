import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { updateTaskSchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    let taskQuery = supabase
      .from("tasks")
      .select("*, responsible:users!tasks_responsible_id_fkey(full_name,email)")
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
        driveConfigured: Boolean(process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  const auth = await requireApiUser(["manager"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const input = updateTaskSchema.parse(await request.json());
    const supabase = createAdminClient();
    if (input.responsible_id) {
      const { data: responsible } = await supabase
        .from("users")
        .select("id")
        .eq("id", input.responsible_id)
        .eq("company_id", auth.user.companyId!)
        .eq("is_active", true)
        .is("deleted_at", null)
        .maybeSingle();
      if (!responsible) {
        return NextResponse.json({ error: "Responsable no válido" }, { status: 400 });
      }
    }
    if (input.status) {
      const { data, error } = await supabase.rpc("manager_update_task_status", {
        target_task_id: id,
        actor_id: auth.user.id,
        actor_company_id: auth.user.companyId,
        next_status: input.status,
      });
      if (error) throw error;
      const rest = { ...input };
      delete rest.status;
      if (Object.keys(rest).length === 0) {
        await writeAudit({ actorId: auth.user.id, companyId: auth.user.companyId, action: "task.status_updated", entityType: "task", entityId: id, metadata: { status: input.status } });
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
      await writeAudit({ actorId: auth.user.id, companyId: auth.user.companyId, action: "task.updated", entityType: "task", entityId: id });
      return NextResponse.json({ data: updated });
    }
    const { data, error } = await supabase
      .from("tasks")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("company_id", auth.user.companyId!)
      .is("deleted_at", null)
      .select()
      .single();
    if (error) throw error;
    await writeAudit({ actorId: auth.user.id, companyId: auth.user.companyId, action: "task.updated", entityType: "task", entityId: id });
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, context: Context) {
  const auth = await requireApiUser(["manager"]);
  if (auth.error) return auth.error;
  const { id } = await context.params;
  const now = new Date().toISOString();
  const { error } = await createAdminClient()
    .from("tasks")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", id)
    .eq("company_id", auth.user.companyId!);
  if (error) return apiError(error);
  await writeAudit({ actorId: auth.user.id, companyId: auth.user.companyId, action: "task.deleted", entityType: "task", entityId: id });
  return NextResponse.json({ ok: true });
}
