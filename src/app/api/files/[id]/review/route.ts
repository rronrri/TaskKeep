import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/server";
import { fileReviewSchema } from "@/lib/validators";
import { assertFolderInCompanyTree, moveDriveFile } from "@/lib/google-drive";

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
      .select("id,drive_file_id,drive_folder_id,task:tasks!inner(id,company_id,drive_folder_id,company:companies!inner(drive_owner_user_id))")
      .eq("id", id)
      .eq("approval_status", "pending")
      .eq("task.company_id", auth.user.companyId!)
      .is("deleted_at", null)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) return NextResponse.json({ error: "Archivo pendiente no encontrado" }, { status: 404 });
    const task = Array.isArray(target.task) ? target.task[0] : target.task;
    const company = Array.isArray(task.company) ? task.company[0] : task.company;
    let nextWebUrl: string | undefined;
    let nextFolderId = target.drive_folder_id;
    if (input.decision === "approved") {
      const destination = input.drive_folder_id || task.drive_folder_id;
      if (!destination || !company?.drive_owner_user_id) {
        return NextResponse.json({ error: "Configura Google Drive antes de aprobar el archivo" }, { status: 409 });
      }
      if (input.drive_folder_id) {
        // Destino elegido por el cliente: debe caer dentro del árbol de la empresa.
        const { data: companyRoot } = await supabase
          .from("companies")
          .select("drive_folder_id")
          .eq("id", auth.user.companyId!)
          .maybeSingle();
        if (!companyRoot?.drive_folder_id) {
          return NextResponse.json({ error: "Configura Google Drive antes de aprobar el archivo" }, { status: 409 });
        }
        await assertFolderInCompanyTree(destination, companyRoot.drive_folder_id, company.drive_owner_user_id);
      }
      const moved = await moveDriveFile(target.drive_file_id, target.drive_folder_id, destination, company.drive_owner_user_id);
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
