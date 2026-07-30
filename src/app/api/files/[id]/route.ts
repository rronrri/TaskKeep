import { after, NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { deleteDriveFile } from "@/lib/google-drive";
import { resolveDriveOwner } from "@/lib/google-drive/resolve-owner";
import { resolveTeamIds } from "@/lib/tasks/team-scope";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_: Request, context: Context) {
  const auth = await requireApiUser(["manager", "collaborator"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    let fileQuery = supabase.from("task_files").select("id,drive_file_id,uploaded_by,task:tasks!inner(id,drive_folder_id,company_id,responsible_id)").eq("id", id).eq("task.company_id", auth.user.companyId!).is("deleted_at", null);
    if (auth.user.role === "collaborator") fileQuery = fileQuery.eq("uploaded_by", auth.user.id).eq("task.responsible_id", auth.user.id);
    if (auth.user.role === "manager") {
      const teamIds = await resolveTeamIds(supabase, auth.user.id, "manager");
      fileQuery = fileQuery.in("task.responsible_id", teamIds);
    }
    const { data: file } = await fileQuery.maybeSingle();
    if (!file) return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    const task = Array.isArray(file.task) ? file.task[0] : file.task;
    const owner = await resolveDriveOwner(supabase, task.company_id, task.responsible_id);
    if (owner) await deleteDriveFile(file.drive_file_id, owner.ownerId);
    const { error } = await supabase.from("task_files").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    await writeAudit({ actorId: auth.user.id, companyId: auth.user.companyId, action: "file.deleted", entityType: "task_file", entityId: id });
    // Si tras borrar este adjunto la tarea se queda sin archivos activos, la
    // carpeta que el sistema creó para ella en Drive ya no sirve de nada: se
    // borra para no dejar carpetas vacías acumulándose. Esto NO se ejecuta al
    // borrar la tarea completa (esa ruta no toca Drive), solo al borrar un
    // adjunto puntual desde la tarea.
    if (owner && task.drive_folder_id) {
      const ownerId = owner.ownerId;
      const folderId = task.drive_folder_id;
      const taskId = task.id;
      after(async () => {
        try {
          const { count, error: countError } = await supabase
            .from("task_files")
            .select("id", { count: "exact", head: true })
            .eq("task_id", taskId)
            .is("deleted_at", null);
          if (countError) throw countError;
          if (count === 0) {
            await deleteDriveFile(folderId, ownerId);
            await supabase.from("tasks").update({ drive_folder_id: null, drive_folder_name: null }).eq("id", taskId);
          }
        } catch (cleanupError) {
          console.error("No se pudo limpiar la carpeta vacía de la tarea en Drive", cleanupError);
        }
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
