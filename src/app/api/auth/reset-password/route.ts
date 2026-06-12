import { createHash } from "crypto";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { protectMutation } from "@/lib/security";

const schema = z.object({ token: z.string().min(32), password: z.string().min(8).max(128) });

export async function POST(request: Request) {
  const blocked = protectMutation(request, { scope: "reset-password", limit: 8, windowMs: 15 * 60_000 });
  if (blocked) return blocked;
  try {
    const input = schema.parse(await request.json());
    const tokenHash = createHash("sha256").update(input.token).digest("hex");
    const supabase = createAdminClient();
    const { data: reset } = await supabase.from("password_reset_tokens").select("id,user_id,expires_at,used_at").eq("token_hash", tokenHash).maybeSingle();
    if (!reset || reset.used_at || new Date(reset.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "El enlace es inválido o ha vencido" }, { status: 400 });
    }
    const now = new Date().toISOString();
    const { error: userError } = await supabase.from("users").update({ password_hash: await bcrypt.hash(input.password, 12), must_change_password: false, updated_at: now }).eq("id", reset.user_id);
    if (userError) throw userError;
    const { error: tokenError } = await supabase.from("password_reset_tokens").update({ used_at: now }).eq("id", reset.id);
    if (tokenError) throw tokenError;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
