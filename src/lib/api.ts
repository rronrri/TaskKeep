import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSession } from "@/lib/auth/session";
import type { UserRole } from "@/types";

export async function requireApiUser(roles?: UserRole[]) {
  const user = await getSession();
  if (!user) return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  if (roles && !roles.includes(user.role)) {
    return { error: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }) };
  }
  return { user };
}

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: error.flatten() },
      { status: 400 },
    );
  }
  console.error(error);
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}
