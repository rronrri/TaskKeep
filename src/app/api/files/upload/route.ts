import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { uploadToDrive } from "@/lib/google-drive";
import { createAdminClient } from "@/lib/supabase/server";

const allowed = new Set(["application/pdf", "image/png", "image/jpeg", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);

export async function POST(request: Request) {
  const auth = await requireApiUser(["manager"]);
  if (auth.error) return auth.error;
  try {
    const form = await request.formData();
    const file = form.get("file");
    const taskId = String(form.get("task_id") ?? "");
    if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024 || !allowed.has(file.type)) {
      return NextResponse.json({ error: "Archivo vacío, no permitido o mayor a 10 MB" }, { status: 400 });
    }
    const supabase = createAdminClient();
    const { data: task } = await supabase.from("tasks").select("id,drive_folder_id").eq("id", taskId).eq("company_id", auth.user.companyId!).single();
    if (!task?.drive_folder_id) return NextResponse.json({ error: "La tarea no tiene carpeta de Drive configurada" }, { status: 409 });
    const drive = await uploadToDrive(file, task.drive_folder_id);
    const { data, error } = await supabase.from("task_files").insert({
      task_id: task.id, uploaded_by: auth.user.id, file_name: file.name, mime_type: file.type,
      file_size: file.size, drive_file_id: drive.id, drive_web_url: drive.webViewLink,
    }).select().single();
    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { return apiError(error); }
}
