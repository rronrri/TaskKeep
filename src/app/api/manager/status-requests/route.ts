import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveTeamIds } from "@/lib/tasks/team-scope";

export async function GET() {
  const auth = await requireApiUser(["manager"]);
  if (auth.error) return auth.error;
  const supabase = createAdminClient();
  const teamIds = await resolveTeamIds(supabase, auth.user.id, "manager");
  const { data, error } = await supabase
    .from("task_status_requests")
    .select("*, task:tasks!inner(id,title,company_id,responsible_id), requester:users!task_status_requests_requested_by_fkey(full_name)")
    .eq("task.company_id", auth.user.companyId!)
    .in("task.responsible_id", teamIds)
    .eq("review_status", "pending_review")
    .order("created_at");
  if (error) return apiError(error);
  return NextResponse.json({ data });
}
