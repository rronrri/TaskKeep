import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { assertFolderInCompanyTree, createDriveFolder, listDriveFolders } from "@/lib/google-drive";
import { createAdminClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const auth = await requireApiUser(["manager", "collaborator"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    let query = supabase
      .from("tasks")
      .select("id,title,drive_folder_id,company:companies!inner(drive_folder_id,drive_owner_user_id)")
      .eq("id", id)
      .eq("company_id", auth.user.companyId!)
      .is("deleted_at", null);
    if (auth.user.role === "collaborator") query = query.eq("responsible_id", auth.user.id);
    const { data: task, error } = await query.maybeSingle();
    if (error) throw error;
    if (!task) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    const company = Array.isArray(task.company) ? task.company[0] : task.company;
    if (!company?.drive_owner_user_id) return NextResponse.json({ error: "Google Drive no está configurado" }, { status: 409 });
    let taskFolderId = task.drive_folder_id;
    try {
      if (!taskFolderId && company.drive_folder_id) {
        const folder = await createDriveFolder(taskFolderName(task.id, task.title), company.drive_folder_id, company.drive_owner_user_id);
        taskFolderId = folder.id;
        await supabase.from("tasks").update({ drive_folder_id: taskFolderId }).eq("id", task.id);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("File not found")) {
        return NextResponse.json({ error: "Google Drive no encuentra la carpeta configurada. Reconecta Google o vuelve a guardar una carpeta raíz accesible desde el perfil." }, { status: 400 });
      }
      throw error;
    }
    const url = new URL(request.url);
    const requestedParent = url.searchParams.get("parent");
    const parentId = requestedParent || taskFolderId || company.drive_folder_id;
    if (!parentId) return NextResponse.json({ error: "La tarea no tiene carpeta de Drive" }, { status: 409 });
    if (requestedParent) {
      // Solo se puede navegar dentro del árbol de la empresa.
      await assertFolderInCompanyTree(requestedParent, company.drive_folder_id!, company.drive_owner_user_id);
    }
    let folders: Array<{ id: string; name: string; webViewLink?: string }> = [];
    try {
      folders = await listDriveFolders(parentId, company.drive_owner_user_id);
    } catch (error) {
      if (error instanceof Error && error.message.includes("File not found")) {
        return NextResponse.json({ error: "Google Drive no encuentra la carpeta configurada. Reconecta Google o vuelve a guardar una carpeta raíz accesible desde el perfil." }, { status: 400 });
      }
      throw error;
    }
    return NextResponse.json({
      data: {
        parentId,
        rootTaskFolderId: taskFolderId,
        companyRootFolderId: company.drive_folder_id,
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
      .select("id,title,drive_folder_id,company:companies!inner(drive_folder_id,drive_owner_user_id)")
      .eq("id", id)
      .eq("company_id", auth.user.companyId!)
      .is("deleted_at", null);
    if (auth.user.role === "collaborator") query = query.eq("responsible_id", auth.user.id);
    const { data: task, error } = await query.maybeSingle();
    if (error) throw error;
    if (!task) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    const company = Array.isArray(task.company) ? task.company[0] : task.company;
    if (!company?.drive_owner_user_id || !company.drive_folder_id) return NextResponse.json({ error: "Google Drive no está configurado" }, { status: 409 });

    let taskFolderId = task.drive_folder_id;
    try {
      if (!taskFolderId) {
        const folder = await createDriveFolder(taskFolderName(task.id, task.title), company.drive_folder_id, company.drive_owner_user_id);
        taskFolderId = folder.id;
        await supabase.from("tasks").update({ drive_folder_id: taskFolderId }).eq("id", task.id);
      }
      if (requestedParent) {
        await assertFolderInCompanyTree(requestedParent, company.drive_folder_id, company.drive_owner_user_id);
      }
      const folder = await createDriveFolder(name, requestedParent || taskFolderId, company.drive_owner_user_id);
      return NextResponse.json({ data: folder }, { status: 201 });
    } catch (error) {
      if (error instanceof Error && error.message.includes("File not found")) {
        return NextResponse.json({ error: "Google Drive no encuentra la carpeta configurada. Reconecta Google o vuelve a guardar una carpeta raíz accesible desde el perfil." }, { status: 400 });
      }
      throw error;
    }
  } catch (error) {
    return apiError(error);
  }
}

function taskFolderName(id: string, title: string) {
  return `TK-${id.slice(0, 8)} - ${title}`.slice(0, 120);
}
