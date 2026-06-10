import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { updateTaskSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const auth = await requireApiUser(["manager"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const input = updateTaskSchema.parse(await request.json());
    const supabase = createAdminClient();
    if (input.responsible_id) {
      const { data: responsible } = await supabase
        .from("users")
        .select("id")
        .eq("id", input.responsible_id)
        .eq("company_id", auth.user.companyId!)
        .eq("is_active", true)
        .is("deleted_at", null)
        .maybeSingle();
      if (!responsible) {
        return NextResponse.json({ error: "Responsable no válido" }, { status: 400 });
      }
    }
    if (input.status) {
      const { data, error } = await supabase.rpc("manager_update_task_status", {
        target_task_id: id,
        actor_id: auth.user.id,
        actor_company_id: auth.user.companyId,
        next_status: input.status,
      });
      if (error) throw error;
      const rest = { ...input };
      delete rest.status;
      if (Object.keys(rest).length === 0) return NextResponse.json({ data });
      const { data: updated, error: updateError } = await supabase
        .from("tasks")
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("company_id", auth.user.companyId!)
        .is("deleted_at", null)
        .select()
        .single();
      if (updateError) throw updateError;
      return NextResponse.json({ data: updated });
    }
    const { data, error } = await supabase
      .from("tasks")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("company_id", auth.user.companyId!)
      .is("deleted_at", null)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, context: Context) {
  const auth = await requireApiUser(["manager"]);
  if (auth.error) return auth.error;
  const { id } = await context.params;
  const now = new Date().toISOString();
  const { error } = await createAdminClient()
    .from("tasks")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", id)
    .eq("company_id", auth.user.companyId!);
  if (error) return apiError(error);
  return NextResponse.json({ ok: true });
}
