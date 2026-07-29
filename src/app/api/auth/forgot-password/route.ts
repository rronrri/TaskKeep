import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { sendPasswordResetEmail } from "@/lib/resend/send-password-reset";
import { createAdminClient } from "@/lib/supabase/server";
import { protectMutation } from "@/lib/security";

const schema = z.object({ email: z.string().email().max(254) });

export async function POST(request: Request) {
  const blocked = await protectMutation(request, { scope: "forgot-password", limit: 5, windowMs: 15 * 60_000 });
  if (blocked) return blocked;
  try {
    const { email } = schema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: user } = await supabase.from("users").select("id,full_name,email").eq("email", email.toLowerCase()).eq("is_active", true).is("deleted_at", null).maybeSingle();
    if (user) {
      const token = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      await supabase.from("password_reset_tokens").update({ used_at: new Date().toISOString() }).eq("user_id", user.id).is("used_at", null);
      const { error } = await supabase.from("password_reset_tokens").insert({ user_id: user.id, token_hash: tokenHash, expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() });
      if (error) throw error;
      await sendPasswordResetEmail({ fullName: user.full_name, email: user.email, token });
    }
    return NextResponse.json({ ok: true, message: "Si existe una cuenta activa, recibirás un enlace de recuperación." });
  } catch (error) {
    return apiError(error);
  }
}
