import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
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

export async function destroySession() {
  (await cookies()).delete(cookieName);
}
