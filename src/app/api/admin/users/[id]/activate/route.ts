import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };

export async function POST(_: Request, context: Context) {
  const auth = await requireApiUser(["admin", "manager"]);
  if (auth.error) return auth.error;
  const { id } = await context.params;
  let query = createAdminClient().from("users").update({ is_active: true, updated_at: new Date().toISOString() }).eq("id", id).is("deleted_at", null);
  if (auth.user.role === "manager") query = query.eq("company_id", auth.user.companyId!).eq("role", "collaborator");
  else query = query.neq("role", "admin");
  const { data, error } = await query.select("id").maybeSingle();
  if (error) return apiError(error);
  if (!data) return NextResponse.json({ error: "Usuario no encontrado o no permitido" }, { status: 404 });
  await writeAudit({ actorId: auth.user.id, companyId: auth.user.companyId, action: "user.reactivated", entityType: "user", entityId: id });
  return NextResponse.json({ ok: true });
}
