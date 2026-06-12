import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { apiError, requireApiUser } from "@/lib/api";
import { createSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";

export async function GET() {
  const auth = await requireApiUser(undefined, { allowTemporaryPassword: true });
  if (auth.error) return auth.error;
  const { data, error } = await createAdminClient()
    .from("users")
    .select("id,full_name,email,role,created_at,must_change_password,company:companies(name)")
    .eq("id", auth.user.id)
    .single();
  if (error) return apiError(error);
  return NextResponse.json({ data });
}

export async function PATCH(request: Request) {
  const auth = await requireApiUser(undefined, { allowTemporaryPassword: true });
  if (auth.error) return auth.error;
  try {
    const input = profileSchema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: current, error: currentError } = await supabase
      .from("users")
      .select("id,password_hash,must_change_password")
      .eq("id", auth.user.id)
      .single();
    if (currentError) throw currentError;
    if (current.must_change_password && !input.new_password) {
      return NextResponse.json(
        {
          error: "Debes establecer una nueva contraseña para continuar",
          code: "PASSWORD_CHANGE_REQUIRED",
        },
        { status: 400 },
      );
    }
    if (input.new_password) {
      if (!input.current_password || !(await bcrypt.compare(input.current_password, current.password_hash))) {
        return NextResponse.json({ error: "La contraseña actual no es correcta" }, { status: 400 });
      }
    }
    const update: Record<string, unknown> = {
      full_name: input.full_name,
      email: input.email.toLowerCase(),
      updated_at: new Date().toISOString(),
    };
    if (input.new_password) {
      update.password_hash = await bcrypt.hash(input.new_password, 12);
      update.must_change_password = false;
    }
    const { data, error } = await supabase
      .from("users")
      .update(update)
      .eq("id", auth.user.id)
      .select("id,company_id,full_name,email,role,must_change_password")
      .single();
    if (error) throw error;
    await createSession({
      id: data.id,
      companyId: data.company_id,
      fullName: data.full_name,
      email: data.email,
      role: data.role,
      mustChangePassword: data.must_change_password,
    });
    await writeAudit({ actorId: auth.user.id, companyId: auth.user.companyId, action: input.new_password ? "profile.password_changed" : "profile.updated", entityType: "user", entityId: auth.user.id });
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
