import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { buildTaskFolderName, createDriveFolder, listDriveFolders } from "@/lib/google-drive";
import { resolveDriveOwner } from "@/lib/google-drive/resolve-owner";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveTeamIds } from "@/lib/tasks/team-scope";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const auth = await requireApiUser(["manager", "collaborator"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    let query = supabase
      .from("tasks")
      .select("id,title,created_at,drive_folder_id,responsible_id")
      .eq("id", id)
      .eq("company_id", auth.user.companyId!)
      .is("deleted_at", null);
    if (auth.user.role === "collaborator") query = query.eq("responsible_id", auth.user.id);
    if (auth.user.role === "manager") {
      const teamIds = await resolveTeamIds(supabase, auth.user.id, "manager");
      query = query.in("responsible_id", teamIds);
    }
    const { data: task, error } = await query.maybeSingle();
    if (error) throw error;
    if (!task) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    const owner = await resolveDriveOwner(supabase, auth.user.companyId!, task.responsible_id);
    if (!owner) return NextResponse.json({ error: "Google Drive no está configurado" }, { status: 409 });
    let taskFolderId = task.drive_folder_id;
    try {
      if (!taskFolderId) {
        const folder = await createDriveFolder(buildTaskFolderName(task.title, task.created_at), "root", owner.ownerId);
        taskFolderId = folder.id;
        await supabase.from("tasks").update({ drive_folder_id: taskFolderId, drive_folder_name: folder.name }).eq("id", task.id);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("File not found")) {
        return NextResponse.json({ error: "Google Drive no encuentra la carpeta configurada. Reconecta Google desde tu perfil." }, { status: 400 });
      }
      throw error;
    }
    const url = new URL(request.url);
    const requestedParent = url.searchParams.get("parent");
    const parentId = requestedParent || taskFolderId;
    if (!parentId) return NextResponse.json({ error: "La tarea no tiene carpeta de Drive" }, { status: 409 });
    let folders: Array<{ id: string; name: string; webViewLink?: string }> = [];
    try {
      folders = await listDriveFolders(parentId, owner.ownerId);
    } catch (error) {
      if (error instanceof Error && error.message.includes("File not found")) {
        return NextResponse.json({ error: "Google Drive no encuentra la carpeta configurada. Reconecta Google desde tu perfil." }, { status: 400 });
      }
      throw error;
    }
    return NextResponse.json({
      data: {
        parentId,
        rootTaskFolderId: taskFolderId,
        folders,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: Context) {
  const auth = await requireApiUser(["manager", "collaborator"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const body = await request.json();
    const name = String(body.name ?? "").trim().slice(0, 80);
    const requestedParent = String(body.parent_id ?? "");
    if (name.length < 2) return NextResponse.json({ error: "Escribe un nombre de carpeta" }, { status: 400 });

    const supabase = createAdminClient();
    let query = supabase
      .from("tasks")
      .select("id,title,created_at,drive_folder_id,responsible_id")
      .eq("id", id)
      .eq("company_id", auth.user.companyId!)
      .is("deleted_at", null);
    if (auth.user.role === "collaborator") query = query.eq("responsible_id", auth.user.id);
    if (auth.user.role === "manager") {
      const teamIds = await resolveTeamIds(supabase, auth.user.id, "manager");
      query = query.in("responsible_id", teamIds);
    }
    const { data: task, error } = await query.maybeSingle();
    if (error) throw error;
    if (!task) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    const owner = await resolveDriveOwner(supabase, auth.user.companyId!, task.responsible_id);
    if (!owner) return NextResponse.json({ error: "Google Drive no está configurado" }, { status: 409 });

    let taskFolderId = task.drive_folder_id;
    try {
      if (!taskFolderId) {
        const folder = await createDriveFolder(buildTaskFolderName(task.title, task.created_at), "root", owner.ownerId);
        taskFolderId = folder.id;
        await supabase.from("tasks").update({ drive_folder_id: taskFolderId, drive_folder_name: folder.name }).eq("id", task.id);
      }
      const folder = await createDriveFolder(name, requestedParent || taskFolderId, owner.ownerId);
      return NextResponse.json({ data: folder }, { status: 201 });
    } catch (error) {
      if (error instanceof Error && error.message.includes("File not found")) {
        return NextResponse.json({ error: "Google Drive no encuentra la carpeta configurada. Reconecta Google desde tu perfil." }, { status: 400 });
      }
      throw error;
    }
  } catch (error) {
    return apiError(error);
  }
}
