import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { listDriveFolders } from "@/lib/google-drive";
import { createAdminClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const auth = await requireApiUser(["manager"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const { data: task, error } = await supabase
      .from("tasks")
      .select("id,drive_folder_id,company:companies!inner(drive_folder_id,drive_owner_user_id)")
      .eq("id", id)
      .eq("company_id", auth.user.companyId!)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!task) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    const company = Array.isArray(task.company) ? task.company[0] : task.company;
    if (!company?.drive_owner_user_id) return NextResponse.json({ error: "Google Drive no está configurado" }, { status: 409 });
    const url = new URL(request.url);
    const parentId = url.searchParams.get("parent") || task.drive_folder_id || company.drive_folder_id;
    if (!parentId) return NextResponse.json({ error: "La tarea no tiene carpeta de Drive" }, { status: 409 });
    const folders = await listDriveFolders(parentId, company.drive_owner_user_id);
    return NextResponse.json({
      data: {
        parentId,
        rootTaskFolderId: task.drive_folder_id,
        folders,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
