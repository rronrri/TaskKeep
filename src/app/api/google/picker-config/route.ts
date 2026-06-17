import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api";

export async function GET() {
  const auth = await requireApiUser(["manager", "collaborator"], { allowTemporaryPassword: true });
  if (auth.error) return auth.error;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  const appId = process.env.NEXT_PUBLIC_GOOGLE_APP_ID;

  if (!apiKey || !appId) {
    return NextResponse.json(
      { error: "Google Picker no esta configurado. Falta NEXT_PUBLIC_GOOGLE_API_KEY o NEXT_PUBLIC_GOOGLE_APP_ID en el .env." },
      { status: 503 },
    );
  }

  return NextResponse.json({ apiKey, appId });
}
