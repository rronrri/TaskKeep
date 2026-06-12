import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { taskCommentSchema } from "@/lib/validators";
import { protectMutation } from "@/lib/security";
import { writeAudit } from "@/lib/audit";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const blocked = protectMutation(request, { scope: "task-comment", limit: 30, windowMs: 10 * 60_000 });
  if (blocked) return blocked;
  const auth = await requireApiUser(["manager", "collaborator"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const input = taskCommentSchema.parse(await request.json());
    const supabase = createAdminClient();
    let taskQuery = supabase.from("tasks").select("id").eq("id", id).eq("company_id", auth.user.companyId!).is("deleted_at", null);
    if (auth.user.role === "collaborator") taskQuery = taskQuery.eq("responsible_id", auth.user.id);
    const { data: task } = await taskQuery.maybeSingle();
    if (!task) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    const { data, error } = await supabase
      .from("task_comments")
      .insert({ task_id: id, user_id: auth.user.id, comment: input.comment })
      .select("id,comment,created_at,user:users(full_name,role)")
      .single();
    if (error) throw error;
    await writeAudit({ actorId: auth.user.id, companyId: auth.user.companyId, action: "task.commented", entityType: "task", entityId: id });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
