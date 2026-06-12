import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { apiError, requireApiUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { updateUserSchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const auth = await requireApiUser(["admin", "manager"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const input = updateUserSchema.parse(await request.json());
    const supabase = createAdminClient();
    let targetQuery = supabase
      .from("users")
      .select("id, company_id, role")
      .eq("id", id)
      .is("deleted_at", null);
    if (auth.user.role === "manager") {
      targetQuery = targetQuery.eq("company_id", auth.user.companyId!).eq("role", "collaborator");
    } else {
      targetQuery = targetQuery.neq("role", "admin");
    }
    const { data: target } = await targetQuery.maybeSingle();
    if (!target) return NextResponse.json({ error: "Usuario no encontrado o no permitido" }, { status: 404 });

    const update: Record<string, unknown> = {
      full_name: input.full_name,
      email: input.email.toLowerCase(),
      updated_at: new Date().toISOString(),
    };
    if (input.password) update.password_hash = await bcrypt.hash(input.password, 12);
    const { data, error } = await supabase
      .from("users")
      .update(update)
      .eq("id", target.id)
      .select("id, company_id, full_name, email, role, is_active, created_at")
      .single();
    if (error) throw error;
    await writeAudit({ actorId: auth.user.id, companyId: data.company_id, action: "user.updated", entityType: "user", entityId: data.id });
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, context: Context) {
  const auth = await requireApiUser(["admin", "manager"]);
  if (auth.error) return auth.error;
  const { id } = await context.params;
  const supabase = createAdminClient();
  let query = supabase.from("users").select("id").eq("id", id).is("deleted_at", null);
  if (auth.user.role === "manager") {
    query = query.eq("company_id", auth.user.companyId!).eq("role", "collaborator");
  } else {
    query = query.neq("role", "admin");
  }
  const { data: target } = await query.maybeSingle();
  if (!target) return NextResponse.json({ error: "Usuario no encontrado o no permitido" }, { status: 404 });
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("users")
    .update({ is_active: false, updated_at: now })
    .eq("id", target.id);
  if (error) return apiError(error);
  await writeAudit({ actorId: auth.user.id, companyId: auth.user.companyId, action: "user.deactivated", entityType: "user", entityId: target.id });
  return NextResponse.json({ ok: true });
}
