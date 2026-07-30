import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveTeamIds } from "@/lib/tasks/team-scope";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  try {
    const supabase = createAdminClient();
    if (auth.user.role === "admin") {
      const [companies, managers, collaborators, recentUsers] = await Promise.all([
        supabase.from("companies").select("id,is_active", { count: "exact" }).is("deleted_at", null),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "manager").eq("is_active", true).is("deleted_at", null),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "collaborator").eq("is_active", true).is("deleted_at", null),
        supabase.from("users").select("id,full_name,email,role,created_at,company:companies!users_company_id_fkey(name)").neq("role", "admin").is("deleted_at", null).order("created_at", { ascending: false }).limit(6),
      ]);
      for (const result of [companies, managers, collaborators, recentUsers]) if (result.error) throw result.error;
      const companyRows = companies.data ?? [];
      return NextResponse.json({
        role: "admin",
        metrics: {
          companies: companies.count ?? companyRows.length,
          activeCompanies: companyRows.filter((company) => company.is_active).length,
          managers: managers.count ?? 0,
          collaborators: collaborators.count ?? 0,
        },
        recent: recentUsers.data ?? [],
      });
    }

    let taskQuery = supabase
      .from("tasks")
      .select("id,title,status,priority,deadline,is_pinned,responsible:users!tasks_responsible_id_fkey(full_name)")
      .eq("company_id", auth.user.companyId!)
      .is("deleted_at", null);
    if (auth.user.role === "collaborator") taskQuery = taskQuery.eq("responsible_id", auth.user.id);
    const teamIds = auth.user.role === "manager" ? await resolveTeamIds(supabase, auth.user.id, "manager") : [];
    if (auth.user.role === "manager") taskQuery = taskQuery.in("responsible_id", teamIds);
    const [tasksResult, requestsResult, fileRequestsResult] = await Promise.all([
      taskQuery.order("deadline", { ascending: true, nullsFirst: false }),
      auth.user.role === "manager"
        ? supabase.from("task_status_requests").select("id,task:tasks!inner(company_id,responsible_id)").eq("task.company_id", auth.user.companyId!).eq("review_status", "pending_review").in("task.responsible_id", teamIds)
        : Promise.resolve({ data: [], error: null }),
      auth.user.role === "manager"
        ? supabase.from("task_files").select("id,task:tasks!inner(company_id,responsible_id)").eq("task.company_id", auth.user.companyId!).eq("approval_status", "pending").is("deleted_at", null).in("task.responsible_id", teamIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (tasksResult.error) throw tasksResult.error;
    if (requestsResult.error) throw requestsResult.error;
    if (fileRequestsResult.error) throw fileRequestsResult.error;
    const tasks = tasksResult.data ?? [];
    const now = Date.now();
    const week = now + 7 * 24 * 60 * 60 * 1000;
    return NextResponse.json({
      role: auth.user.role,
      metrics: {
        pending: tasks.filter((task) => task.status === "pending").length,
        inProgress: tasks.filter((task) => task.status === "in_progress").length,
        completed: tasks.filter((task) => task.status === "completed").length,
        overdue: tasks.filter((task) => task.deadline && task.status !== "completed" && new Date(task.deadline).getTime() < now).length,
        dueSoon: tasks.filter((task) => {
          if (!task.deadline) return false;
          const deadline = new Date(task.deadline).getTime();
          return task.status !== "completed" && deadline >= now && deadline <= week;
        }).length,
        pendingRequests: (requestsResult.data?.length ?? 0) + (fileRequestsResult.data?.length ?? 0),
      },
      upcoming: tasks.filter((task) => task.status !== "completed").slice(0, 6),
    });
  } catch (error) {
    return apiError(error);
  }
}
