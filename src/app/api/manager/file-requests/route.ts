import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  const auth = await requireApiUser(["manager"]);
  if (auth.error) return auth.error;
  const { data, error } = await createAdminClient()
    .from("task_files")
    .select("id,file_name,mime_type,file_size,drive_web_url,created_at,uploader:users!task_files_uploaded_by_fkey(full_name),task:tasks!inner(id,title,company_id)")
    .eq("approval_status", "pending")
    .eq("task.company_id", auth.user.companyId!)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) return apiError(error);
  return NextResponse.json({ data });
}
