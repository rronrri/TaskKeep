import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSession } from "@/lib/auth/session";
import { DriveFolderNotAllowedError } from "@/lib/google-drive/errors";
import type { UserRole } from "@/types";

export async function requireApiUser(
  roles?: UserRole[],
  options?: { allowTemporaryPassword?: boolean },
) {
  const user = await getSession();
  if (!user) return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  if (user.mustChangePassword && !options?.allowTemporaryPassword) {
    return {
      error: NextResponse.json(
        {
          error: "Debes cambiar tu contraseña temporal antes de continuar",
          code: "PASSWORD_CHANGE_REQUIRED",
        },
        { status: 403 },
      ),
    };
  }
  if (roles && !roles.includes(user.role)) {
    return { error: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }) };
  }
  return { user };
}

export function apiError(error: unknown) {
  if (error instanceof DriveFolderNotAllowedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (isDuplicateEmailError(error)) {
    return NextResponse.json(
      { error: "Ya existe una cuenta con ese correo electrónico" },
      { status: 409 },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: error.flatten() },
      { status: 400 },
    );
  }
  console.error(error);
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}

/**
 * Limpia un término de búsqueda antes de interpolarlo en un filtro `.or()`.
 *
 * PostgREST usa `,` `.` `(` `)` `:` como sintaxis de filtros, así que un término
 * sin sanear permite inyectar condiciones adicionales sobre columnas arbitrarias.
 * Se eliminan también `%` y `_`, que son comodines de `ilike`.
 */
export function sanitizeSearch(value: string | null | undefined) {
  const cleaned = value?.trim().replace(/[,.()%_*\\:"']/g, "").trim();
  return cleaned ? cleaned.slice(0, 100) : null;
}

/** Violación del índice único de `users.email` (código 23505 de PostgreSQL). */
export function isDuplicateEmailError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const databaseError = error as { code?: string; message?: string };
  return databaseError.code === "23505" && Boolean(databaseError.message?.includes("users_email_key"));
}
