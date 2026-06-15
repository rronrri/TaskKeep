import { jwtVerify, SignJWT } from "jose";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";

const scopes = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

function secretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET no está configurado");
  return new TextEncoder().encode(secret);
}

export function isGoogleOAuthConfigured() {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

export async function createGoogleAuthorizationUrl(userId: string, returnPath: string) {
  if (!isGoogleOAuthConfigured()) throw new Error("Google OAuth no está configurado");
  const callback = new URL("/api/google/callback", process.env.APP_URL ?? "http://localhost:3000").toString();
  const state = await new SignJWT({ userId, returnPath })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secretKey());
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_OAUTH_CLIENT_ID!);
  url.searchParams.set("redirect_uri", callback);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function verifyGoogleState(state: string) {
  const { payload } = await jwtVerify(state, secretKey());
  return payload as { userId: string; returnPath?: string };
}

export async function exchangeGoogleCode(code: string) {
  const callback = new URL("/api/google/callback", process.env.APP_URL ?? "http://localhost:3000").toString();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: callback,
      grant_type: "authorization_code",
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.refresh_token) {
    throw new Error(data.error_description ?? "Google no devolvió autorización permanente");
  }
  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const profile = await profileResponse.json();
  if (!profileResponse.ok) throw new Error("No se pudo consultar la cuenta de Google");
  return { refreshToken: data.refresh_token as string, email: profile.email as string };
}

export function encryptGoogleToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

function decryptGoogleToken(value: string) {
  const [iv, tag, encrypted] = value.split(".");
  if (!iv || !tag || !encrypted) return Buffer.from(value, "base64").toString("utf8");
  const decipher = createDecipheriv("aes-256-gcm", tokenKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
}

function tokenKey() {
  return createHash("sha256").update(process.env.JWT_SECRET ?? "").digest();
}

export async function getGoogleAccessToken(userId: string) {
  const { data, error } = await createAdminClient()
    .from("users")
    .select("google_refresh_token_encrypted")
    .eq("id", userId)
    .single();
  if (error || !data.google_refresh_token_encrypted) {
    throw new Error("El/la gestor/a debe conectar su cuenta de Google");
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      refresh_token: decryptGoogleToken(data.google_refresh_token_encrypted),
      grant_type: "refresh_token",
    }),
  });
  const token = await response.json();
  if (!response.ok) throw new Error(token.error_description ?? "No se pudo renovar el acceso a Google");
  return token.access_token as string;
}

export function parseDriveFolderLink(value: string) {
  try {
    const url = new URL(value);
    const foldersMatch = url.pathname.match(/\/folders\/([^/?]+)/);
    if (foldersMatch?.[1]) return foldersMatch[1];
    const id = url.searchParams.get("id");
    return id || null;
  } catch {
    return null;
  }
}
