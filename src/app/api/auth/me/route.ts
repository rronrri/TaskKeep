import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const user = await getSession();
  return user
    ? NextResponse.json({ user })
    : NextResponse.json({ error: "No autenticado" }, { status: 401 });
}
