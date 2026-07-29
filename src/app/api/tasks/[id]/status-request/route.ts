import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { statusRequestSchema } from "@/lib/validators";
import { protectMutation } from "@/lib/security";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const blocked = await protectMutation(request, { scope: "status-request", limit: 15, windowMs: 10 * 60_000 });
  if (blocked) return blocked;
  const auth = await requireApiUser(["collaborator"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const input = statusRequestSchema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: task } = await supabase
      .from("tasks")
      .select("id,status")
      .eq("id", id)
      .eq("responsible_id", auth.user.id)
      .eq("company_id", auth.user.companyId!)
      .is("deleted_at", null)
      .single();
    if (!task) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    const { data, error } = await supabase
      .from("task_status_requests")
      .insert({
        task_id: task.id,
        requested_by: auth.user.id,
        old_status: task.status,
        requested_status: input.requested_status,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
