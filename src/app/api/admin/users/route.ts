import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { apiError, requireApiUser } from "@/lib/api";
import { sendUserWelcomeEmail } from "@/lib/resend/send-user-welcome";
import { createAdminClient } from "@/lib/supabase/server";
import { userSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const auth = await requireApiUser(["admin", "manager"]);
  if (auth.error) return auth.error;
  const url = new URL(request.url);
  const supabase = createAdminClient();
  let query = supabase
    .from("users")
    .select("id, company_id, full_name, email, role, is_active, created_at, company:companies(name)")
    .neq("role", "admin")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (auth.user.role === "manager") query = query.eq("company_id", auth.user.companyId!);
  if (url.searchParams.get("role")) query = query.eq("role", url.searchParams.get("role")!);
  const { data, error } = await query;
  if (error) return apiError(error);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const auth = await requireApiUser(["admin", "manager"]);
  if (auth.error) return auth.error;
  try {
    const input = userSchema.parse(await request.json());
    if (input.role === "admin") {
      return NextResponse.json({ error: "No se pueden crear administradores desde esta pantalla" }, { status: 403 });
    }
    if (auth.user.role === "manager") {
      if (input.role !== "collaborator" || input.company_id !== auth.user.companyId) {
        return NextResponse.json({ error: "Un gestor solo puede crear colaboradores de su empresa" }, { status: 403 });
      }
    }
    const supabase = createAdminClient();
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id, name")
      .eq("id", input.company_id!)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle();
    if (companyError) throw companyError;
    if (!company) {
      return NextResponse.json({ error: "La empresa seleccionada no está disponible" }, { status: 400 });
    }
    if (input.company_id) {
      const { data: allowed, error: limitError } = await supabase.rpc("can_add_company_user", {
        target_company_id: input.company_id,
        target_role: input.role,
      });
      if (limitError) throw limitError;
      if (!allowed) return NextResponse.json({ error: "Se alcanzó el límite de usuarios para este rol" }, { status: 409 });
    }
    const { password, ...profile } = input;
    const { data, error } = await supabase
      .from("users")
      .insert({
        ...profile,
        email: profile.email.toLowerCase(),
        password_hash: await bcrypt.hash(password, 12),
        created_by: auth.user.id,
      })
      .select("id, company_id, full_name, email, role, is_active, created_at")
      .single();
    if (error) throw error;
    const emailDelivery = await sendUserWelcomeEmail({
      fullName: data.full_name,
      email: data.email,
      temporaryPassword: password,
      role: data.role,
      companyName: company.name,
    });
    return NextResponse.json({ data, emailDelivery }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
