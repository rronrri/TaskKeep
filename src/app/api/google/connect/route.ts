import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api";
import { createGoogleAuthorizationUrl } from "@/lib/google-drive/oauth";

export async function GET(request: Request) {
  const auth = await requireApiUser(["manager"], { allowTemporaryPassword: true });
  if (auth.error) return auth.error;
  try {
    const returnPath = new URL(request.url).searchParams.get("return") ?? "/manager/profile";
    return NextResponse.redirect(await createGoogleAuthorizationUrl(auth.user.id, returnPath));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo iniciar la conexión con Google";
    return NextResponse.redirect(new URL(`/manager/profile?google=error&reason=${encodeURIComponent(message)}`, process.env.APP_URL ?? request.url));
  }
}
