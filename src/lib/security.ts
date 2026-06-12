import { NextResponse } from "next/server";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function protectMutation(request: Request, options: { scope: string; limit: number; windowMs?: number }) {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_URL ? new URL(process.env.APP_URL).origin : null;
  if (origin && expected && origin !== expected) {
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
