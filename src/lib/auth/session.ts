import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/types";

const cookieName = process.env.COOKIE_NAME ?? "taskkeep_session";

function shouldUseSecureCookie() {
  if (process.env.COOKIE_SECURE) return process.env.COOKIE_SECURE === "true";
  if (process.env.APP_URL) return process.env.APP_URL.startsWith("https://");
  return process.env.NODE_ENV === "production";
}

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) {
    throw new Error("JWT_SECRET debe contener al menos 32 caracteres");
  }
  return new TextEncoder().encode(value);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret());

  const store = await cookies();
  store.set(cookieName, token, {
    httpOnly: true,
    secure: shouldUseSecureCookie(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

/**
 * Lee la sesión comprobando únicamente la firma del token.
 *
 * No consulta la base, así que refleja el estado que tenía la cuenta al iniciar
 * sesión. Úsala sólo donde eso no importe: por ejemplo, para sacar de la pantalla
 * de acceso a quien ya tiene sesión. Para autorizar cualquier cosa, usa
 * `getVerifiedSession`.
 */
export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.user as SessionUser;
  } catch {
    return null;
  }
}

/**
 * Lee la sesión y la contrasta con la base de datos.
 *
 * El token dura 8 horas y lleva incrustados el rol, la empresa y el estado de
 * contraseña temporal. Sin esta comprobación, eliminar o desactivar una cuenta no
 * cerraba su sesión, cambiar un rol no surtía efecto hasta el siguiente acceso, y
 * restablecer la contraseña no expulsaba a quien ya estuviera dentro.
 *
 * Devuelve los datos frescos de la base y no los del token, para que un cambio de
 * rol o de empresa se aplique de inmediato.
 */
export async function getVerifiedSession(): Promise<SessionUser | null> {
  const claimed = await getSession();
  if (!claimed?.id) return null;

  const { data, error } = await createAdminClient()
    .from("users")
    .select("id,company_id,full_name,email,role,is_active,must_change_password,session_epoch")
    .eq("id", claimed.id)
    .is("deleted_at", null)
    .maybeSingle();

  // La cuenta ya no existe o quedó desactivada: la sesión deja de valer.
  if (error || !data || !data.is_active) return null;

  // Generación anterior a la vigente: la sesión fue revocada explícitamente.
  const current = data.session_epoch ?? 0;
  if ((claimed.sessionEpoch ?? 0) !== current) return null;

  return {
    id: data.id,
    companyId: data.company_id,
    fullName: data.full_name,
    email: data.email,
    role: data.role,
    mustChangePassword: data.must_change_password,
    sessionEpoch: current,
  };
}

/**
 * Invalida todas las sesiones abiertas de una persona y devuelve la generación
 * nueva, para poder reemitir en el acto la sesión de quien hizo el cambio.
 */
export async function revokeSessions(userId: string): Promise<number | null> {
  const { data, error } = await createAdminClient().rpc("bump_session_epoch", { target_user_id: userId });
  if (error) {
    console.error("No se pudieron revocar las sesiones", error.message);
    return null;
  }
  return typeof data === "number" ? data : null;
}

export async function destroySession() {
  (await cookies()).delete(cookieName);
}
