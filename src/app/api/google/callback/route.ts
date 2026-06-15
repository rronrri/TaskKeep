import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { encryptGoogleToken, exchangeGoogleCode, verifyGoogleState } from "@/lib/google-drive/oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const fallback = new URL("/manager/profile", process.env.APP_URL ?? request.url);
  try {
    if (!code || !state) throw new Error("Google no devolvió los datos necesarios");
    const verified = await verifyGoogleState(state);
    const google = await exchangeGoogleCode(code);
    await createAdminClient().from("users").update({
      google_email: google.email,
      google_refresh_token_encrypted: encryptGoogleToken(google.refreshToken),
      google_connected_at: new Date().toISOString(),
    }).eq("id", verified.userId);
    const target = new URL(verified.returnPath ?? "/manager/profile", process.env.APP_URL ?? request.url);
    target.searchParams.set("google", "connected");
    return NextResponse.redirect(target);
  } catch (error) {
    fallback.searchParams.set("google", "error");
    fallback.searchParams.set("reason", error instanceof Error ? error.message : "No se pudo conectar Google");
    return NextResponse.redirect(fallback);
  }
}
