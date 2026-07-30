import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { buildTaskFolderName, createDriveFolder, uploadToDrive } from "@/lib/google-drive";
import { resolveDriveOwner } from "@/lib/google-drive/resolve-owner";
import { createAdminClient } from "@/lib/supabase/server";
import { protectMutation } from "@/lib/security";
import { writeAudit } from "@/lib/audit";
import { resolveTeamIds } from "@/lib/tasks/team-scope";

const allowed = new Set(["application/pdf", "image/png", "image/jpeg", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);

export async function POST(request: Request) {
  const blocked = await protectMutation(request, { scope: "file-upload", limit: 20, windowMs: 10 * 60_000 });
  if (blocked) return blocked;
  const auth = await requireApiUser(["manager", "collaborator"]);
  if (auth.error) return auth.error;
  try {
    const form = await request.formData();
    const file = form.get("file");
    const taskId = String(form.get("task_id") ?? "");
    const selectedFolderId = String(form.get("drive_folder_id") ?? "");
    if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024 || !allowed.has(file.type)) {
      return NextResponse.json({ error: "Archivo vacío, no permitido o mayor a 10 MB" }, { status: 400 });
    }
    const supabase = createAdminClient();
    let taskQuery = supabase
      .from("tasks")
      .select("id,title,created_at,drive_folder_id,responsible_id")
      .eq("id", taskId)
      .eq("company_id", auth.user.companyId!)
      .is("deleted_at", null);
    if (auth.user.role === "collaborator") taskQuery = taskQuery.eq("responsible_id", auth.user.id);
    if (auth.user.role === "manager") {
      const teamIds = await resolveTeamIds(supabase, auth.user.id, "manager");
      taskQuery = taskQuery.in("responsible_id", teamIds);
    }
    const { data: task } = await taskQuery.maybeSingle();
    if (!task) return NextResponse.json({ error: "Tarea no encontrada o no asignada" }, { status: 404 });
    const owner = await resolveDriveOwner(supabase, auth.user.companyId!, task.responsible_id);
    if (!owner) {
      return NextResponse.json({ error: "El/la gestor/a debe conectar Google Drive" }, { status: 409 });
    }
    let taskFolderId = task.drive_folder_id;
    try {
      if (!taskFolderId) {
        // Sin carpeta raíz compartida: la carpeta de la tarea nace directo en la
        // raíz de "Mi unidad" de quien la posee.
        const taskFolder = await createDriveFolder(buildTaskFolderName(task.title, task.created_at), "root", owner.ownerId);
        taskFolderId = taskFolder.id;
        await supabase.from("tasks").update({ drive_folder_id: taskFolderId, drive_folder_name: taskFolder.name }).eq("id", task.id);
      }
      // El destino, elegido o no por el cliente, siempre sale de una carpeta ya
      // creada por la app o elegida con el Picker del mismo gestor/a dueño/a: el
      // alcance `drive.file` ya impide que apunte a cualquier otro lugar de su
      // cuenta, así que no hace falta validar un árbol de carpetas propio. Todo
      // el mundo sube directo a la carpeta de la tarea, sin subcarpeta
      // intermedia: la aprobación de colaboradores/as es solo un estado dentro
      // de TaskKeep, no algo que se refleje moviendo el archivo en Drive.
      let drive: Awaited<ReturnType<typeof uploadToDrive>>;
      let targetFolder: string;
      try {
        targetFolder = selectedFolderId || taskFolderId;
        drive = await uploadToDrive(file, targetFolder, owner.ownerId);
      } catch (uploadError) {
        // La carpeta guardada de la tarea ya no existe en Drive (se borró a mano,
        // o cambió la cuenta conectada): no es una elección explícita del
        // cliente, así que se recrea sola y se reintenta una vez antes de fallar.
        if (selectedFolderId || !(uploadError instanceof Error) || !uploadError.message.includes("File not found")) {
          throw uploadError;
        }
        const freshFolder = await createDriveFolder(buildTaskFolderName(task.title, task.created_at), "root", owner.ownerId);
        taskFolderId = freshFolder.id;
        await supabase.from("tasks").update({ drive_folder_id: taskFolderId, drive_folder_name: freshFolder.name }).eq("id", task.id);
        targetFolder = taskFolderId;
        drive = await uploadToDrive(file, targetFolder, owner.ownerId);
      }
      const { data, error } = await supabase.from("task_files").insert({
        task_id: task.id,
        uploaded_by: auth.user.id,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
        drive_file_id: drive.id,
        drive_web_url: drive.webViewLink,
        drive_folder_id: targetFolder,
        approval_status: auth.user.role === "manager" ? "approved" : "pending",
        reviewed_by: auth.user.role === "manager" ? auth.user.id : null,
        reviewed_at: auth.user.role === "manager" ? new Date().toISOString() : null,
      }).select("id,uploaded_by,file_name,mime_type,file_size,drive_web_url,created_at,approval_status,review_comment,uploader:users!task_files_uploaded_by_fkey(full_name,role)").single();
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
    } catch (error) {
      if (error instanceof Error && error.message.includes("File not found")) {
        return NextResponse.json({ error: "Google Drive no encuentra esa carpeta. Reconecta Google desde el perfil del/de la gestor/a o elige otra carpeta para la tarea." }, { status: 400 });
      }
      throw error;
    }
  } catch (error) {
    return apiError(error);
  }
}
