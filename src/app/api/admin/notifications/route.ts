import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  const auth = await requireApiUser(["admin"]);
  if (auth.error) return auth.error;
  const { data, error } = await createAdminClient()
    .from("notification_logs")
    .select("id,notification_type,email,status,error_message,sent_at,task:tasks(title),user:users(full_name)")
    .order("sent_at", { ascending: false })
    .limit(100);
  if (error) return apiError(error);
  return NextResponse.json({ data });
}
