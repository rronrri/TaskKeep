import { NextResponse } from "next/server";
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
    // La carpeta de la tarea en Drive se queda aunque se borren todos sus
    // archivos: puede ser una carpeta que el/la gestor/a eligió a mano, no
    // solo la automática, así que no se borra sola por quedar vacía.
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
