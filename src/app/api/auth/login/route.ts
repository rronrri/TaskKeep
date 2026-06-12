import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSession } from "@/lib/auth/session";
import { apiError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validators";
import { protectMutation } from "@/lib/security";

export async function POST(request: Request) {
  const blocked = protectMutation(request, { scope: "login", limit: 10, windowMs: 10 * 60_000 });
  if (blocked) return blocked;
  try {
    const input = loginSchema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: user } = await supabase
      .from("users")
      .select("id, company_id, full_name, email, role, password_hash, is_active, must_change_password")
      .eq("email", input.email.toLowerCase())
      .is("deleted_at", null)
      .maybeSingle();

    if (!user?.is_active || !(await bcrypt.compare(input.password, user.password_hash))) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    await createSession({
      id: user.id,
      companyId: user.company_id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.must_change_password,
    });
    return NextResponse.json({ role: user.role, mustChangePassword: user.must_change_password });
  } catch (error) {
    return apiError(error);
  }
}
