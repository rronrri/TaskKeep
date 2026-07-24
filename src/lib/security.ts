import { NextResponse } from "next/server";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function protectMutation(request: Request, options: { scope: string; limit: number; windowMs?: number }) {
  const origin = request.headers.get("origin");
  const allowedOrigins = new Set<string>();
  if (process.env.APP_URL) {
    allowedOrigins.add(new URL(process.env.APP_URL).origin);
  }
  // Mismo host de la petición (soporta despliegues detrás de proxy, p. ej. Vercel).
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    allowedOrigins.add(`${proto}://${forwardedHost.split(",")[0]?.trim()}`);
  }
  if (origin && allowedOrigins.size > 0 && !allowedOrigins.has(origin)) {
    return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const key = `${options.scope}:${ip}`;
  const now = Date.now();
  const current = buckets.get(key);
  const windowMs = options.windowMs ?? 60_000;
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  if (current.count >= options.limit) {
    return NextResponse.json({ error: "Demasiadas solicitudes. Intenta nuevamente en unos minutos." }, { status: 429 });
  }
  current.count += 1;
  return null;
}
