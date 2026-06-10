import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSession } from "@/lib/auth/session";
import { apiError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: user } = await supabase
      .from("users")
      .select("id, company_id, full_name, email, role, password_hash, is_active")
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
    });
    return NextResponse.json({ role: user.role });
  } catch (error) {
    return apiError(error);
  }
}
