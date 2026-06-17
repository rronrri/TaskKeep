import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { getGoogleAccessToken } from "@/lib/google-drive/oauth";

export async function GET() {
  const auth = await requireApiUser(["manager"], { allowTemporaryPassword: true });
  if (auth.error) return auth.error;
  try {
    return NextResponse.json({ access_token: await getGoogleAccessToken(auth.user.id) });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return apiError(error);
  }
}
