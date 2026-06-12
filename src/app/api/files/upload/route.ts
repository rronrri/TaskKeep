import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { uploadToDrive } from "@/lib/google-drive";
import { createAdminClient } from "@/lib/supabase/server";
import { protectMutation } from "@/lib/security";
import { writeAudit } from "@/lib/audit";

const allowed = new Set(["application/pdf", "image/png", "image/jpeg", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);

export async function POST(request: Request) {
  const blocked = protectMutation(request, { scope: "file-upload", limit: 20, windowMs: 10 * 60_000 });
  if (blocked) return blocked;
  const auth = await requireApiUser(["manager", "collaborator"]);
  if (auth.error) return auth.error;
  try {
    const form = await request.formData();
    const file = form.get("file");
    const taskId = String(form.get("task_id") ?? "");
    if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024 || !allowed.has(file.type)) {
      return NextResponse.json({ error: "Archivo vacío, no permitido o mayor a 10 MB" }, { status: 400 });
    }
    const supabase = createAdminClient();
    let taskQuery = supabase.from("tasks").select("id,drive_folder_id").eq("id", taskId).eq("company_id", auth.user.companyId!).is("deleted_at", null);
    if (auth.user.role === "collaborator") taskQuery = taskQuery.eq("responsible_id", auth.user.id);
    const { data: task } = await taskQuery.maybeSingle();
    if (!task) return NextResponse.json({ error: "Tarea no encontrada o no asignada" }, { status: 404 });
    if (!task?.drive_folder_id) return NextResponse.json({ error: "La tarea no tiene carpeta de Drive configurada" }, { status: 409 });
    const drive = await uploadToDrive(file, task.drive_folder_id);
    const { data, error } = await supabase.from("task_files").insert({
      task_id: task.id, uploaded_by: auth.user.id, file_name: file.name, mime_type: file.type,
      file_size: file.size, drive_file_id: drive.id, drive_web_url: drive.webViewLink,
      approval_status: auth.user.role === "manager" ? "approved" : "pending",
      reviewed_by: auth.user.role === "manager" ? auth.user.id : null,
      reviewed_at: auth.user.role === "manager" ? new Date().toISOString() : null,
    }).select("id,file_name,mime_type,file_size,drive_web_url,created_at,approval_status,review_comment,uploader:users!task_files_uploaded_by_fkey(full_name,role)").single();
    if (error) throw error;
    await writeAudit({
      actorId: auth.user.id,
      companyId: auth.user.companyId,
      action: auth.user.role === "manager" ? "file.uploaded_approved" : "file.uploaded_pending",
      entityType: "task_file",
      entityId: data.id,
      metadata: { taskId: task.id, fileName: file.name },
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { return apiError(error); }
}
