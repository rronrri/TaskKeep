import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/server";
import { fileReviewSchema } from "@/lib/validators";
import { moveDriveFile } from "@/lib/google-drive";
import { resolveDriveOwner } from "@/lib/google-drive/resolve-owner";
import { resolveTeamIds } from "@/lib/tasks/team-scope";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const auth = await requireApiUser(["manager"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const input = fileReviewSchema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: target, error: targetError } = await supabase
      .from("task_files")
      .select("id,drive_file_id,drive_folder_id,task:tasks!inner(id,company_id,responsible_id,drive_folder_id)")
      .eq("id", id)
      .eq("approval_status", "pending")
      .eq("task.company_id", auth.user.companyId!)
      .is("deleted_at", null)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) return NextResponse.json({ error: "Archivo pendiente no encontrado" }, { status: 404 });
    const task = Array.isArray(target.task) ? target.task[0] : target.task;
    // Solo el/la gestor/a dueño/a del equipo de esta tarea puede revisar su archivo.
    const teamIds = await resolveTeamIds(supabase, auth.user.id, "manager");
    if (!teamIds.includes(task.responsible_id)) {
      return NextResponse.json({ error: "Archivo pendiente no encontrado" }, { status: 404 });
    }
    let nextWebUrl: string | undefined;
    let nextFolderId = target.drive_folder_id;
    if (input.decision === "approved") {
      const destination = input.drive_folder_id || task.drive_folder_id;
      const owner = await resolveDriveOwner(supabase, auth.user.companyId!, task.responsible_id);
      if (!destination || !owner) {
        return NextResponse.json({ error: "Configura Google Drive antes de aprobar el archivo" }, { status: 409 });
      }
      // El destino, elegido o no por el cliente, siempre sale de una carpeta ya
      // creada por la app o elegida con el Picker del mismo gestor/a dueño/a: el
      // alcance `drive.file` ya impide que apunte a cualquier otro lugar de su
      // cuenta, así que no hace falta validar un árbol de carpetas propio.
      const moved = await moveDriveFile(target.drive_file_id, target.drive_folder_id, destination, owner.ownerId);
      nextWebUrl = moved.webViewLink;
      nextFolderId = destination;
    }
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("task_files")
      .update({
        approval_status: input.decision,
        reviewed_by: auth.user.id,
        reviewed_at: now,
        review_comment: input.comment || null,
        drive_folder_id: nextFolderId,
        ...(nextWebUrl ? { drive_web_url: nextWebUrl } : {}),
      })
      .eq("id", id)
      .select("id")
      .single();
    if (error) throw error;
    await writeAudit({
      actorId: auth.user.id,
      companyId: auth.user.companyId,
      action: `file.${input.decision}`,
      entityType: "task_file",
      entityId: id,
      metadata: { comment: input.comment || null },
    });
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
