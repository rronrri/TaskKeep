import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { apiError, requireApiUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { updateUserSchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";
import { revokeSessions } from "@/lib/auth/session";
import { cancelUserReminders } from "@/lib/tasks/schedule-reminders";

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
      targetQuery = targetQuery.eq("company_id", auth.user.companyId!).eq("role", "collaborator").eq("created_by", auth.user.id);
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
    // Cambiarle la contraseña a alguien cierra sus sesiones abiertas.
    if (input.password) await revokeSessions(target.id);
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
  let query = supabase.from("users").select("id,company_id,full_name,email,role").eq("id", id).is("deleted_at", null);
  if (auth.user.role === "manager") {
    query = query.eq("company_id", auth.user.companyId!).eq("role", "collaborator").eq("created_by", auth.user.id);
  } else {
    query = query.neq("role", "admin");
  }
  const { data: target } = await query.maybeSingle();
  if (!target) return NextResponse.json({ error: "Usuario no encontrado o no permitido" }, { status: 404 });
  if (target.role === "collaborator") {
    const { count, error: taskError } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("responsible_id", target.id)
      .is("deleted_at", null);
    if (taskError) return apiError(taskError);
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "No se puede eliminar al colaborador/a mientras tenga tareas asignadas. Reasigna o elimina esas tareas primero." },
        { status: 409 },
      );
    }
  }
  // Antes del RPC, por el mismo motivo que en la eliminación de empresas.
  try {
    await cancelUserReminders(target.id);
  } catch (error) {
    console.error("No se pudieron cancelar los recordatorios del usuario", error);
  }
  const { data: deleted, error } = await supabase.rpc("delete_user_cascade", { target_user_id: target.id });
  if (error) return apiError(error);
  if (!deleted) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  await writeAudit({
    actorId: auth.user.id,
    companyId: target.company_id,
    action: "user.deleted",
    entityType: "user",
    entityId: target.id,
    metadata: { fullName: target.full_name, email: target.email },
  });
  return NextResponse.json({ ok: true, deleted: true });
}
