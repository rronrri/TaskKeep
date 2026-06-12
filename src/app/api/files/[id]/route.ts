import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { deleteDriveFile } from "@/lib/google-drive";
import { createAdminClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_: Request, context: Context) {
  const auth = await requireApiUser(["manager", "collaborator"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    let fileQuery = supabase.from("task_files").select("id,drive_file_id,uploaded_by,task:tasks!inner(company_id,responsible_id)").eq("id", id).eq("task.company_id", auth.user.companyId!).is("deleted_at", null);
    if (auth.user.role === "collaborator") fileQuery = fileQuery.eq("uploaded_by", auth.user.id).eq("task.responsible_id", auth.user.id);
    const { data: file } = await fileQuery.maybeSingle();
    if (!file) return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    await deleteDriveFile(file.drive_file_id);
    const { error } = await supabase.from("task_files").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    await writeAudit({ actorId: auth.user.id, companyId: auth.user.companyId, action: "file.deleted", entityType: "task_file", entityId: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
