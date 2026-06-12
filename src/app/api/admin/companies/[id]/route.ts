import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { companySchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const auth = await requireApiUser(["admin"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const input = companySchema.partial().parse(await request.json());
    const { data, error } = await createAdminClient()
      .from("companies")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    await writeAudit({ actorId: auth.user.id, companyId: id, action: "company.updated", entityType: "company", entityId: id });
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, context: Context) {
  const auth = await requireApiUser(["admin"]);
  if (auth.error) return auth.error;
  const { id } = await context.params;
  const { data: deleted, error } = await createAdminClient()
    .rpc("delete_company_cascade", { target_company_id: id });
  if (error) return apiError(error);
  if (!deleted) return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
  await writeAudit({ actorId: auth.user.id, action: "company.deleted", entityType: "company", entityId: id });
  return NextResponse.json({ ok: true, deleted: true });
}
