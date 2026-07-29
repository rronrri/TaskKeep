import { NextResponse } from "next/server";
import { getVerifiedSession } from "@/lib/auth/session";

export async function GET() {
  const user = await getVerifiedSession();
  return user
    ? NextResponse.json({ user })
    : NextResponse.json({ error: "No autenticado" }, { status: 401 });
}
