import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

type Bucket = { count: number; resetAt: number };

// Primera barrera, local a la instancia. Es gratis y absorbe las ráfagas
// evidentes sin tocar la base de datos, pero NO es el límite real: en serverless
// cada petición puede caer en una instancia distinta. El límite efectivo lo
// impone `consume_rate_limit` en PostgreSQL, que sí es estado compartido.
const buckets = new Map<string, Bucket>();

function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

function checkOrigin(request: Request) {
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
  return null;
}

function tooManyRequests() {
  return NextResponse.json(
    { error: "Demasiadas solicitudes. Intenta nuevamente en unos minutos." },
    { status: 429 },
  );
}

/** Contador local a la instancia. Devuelve true si el intento excede el límite. */
function exceedsLocalBucket(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(bucketKey);
      }
    }
    return false;
  }
  if (current.count >= limit) return true;
  current.count += 1;
  return false;
}

/**
 * Valida el origen de la petición y aplica el límite de intentos.
 * Devuelve una respuesta de error si hay que cortar, o null para continuar.
 */
export async function protectMutation(
  request: Request,
  options: { scope: string; limit: number; windowMs?: number },
) {
  const badOrigin = checkOrigin(request);
  if (badOrigin) return badOrigin;

  const windowMs = options.windowMs ?? 60_000;
  const key = `${options.scope}:${clientIp(request)}`;

  if (exceedsLocalBucket(key, options.limit, windowMs)) return tooManyRequests();

  const { data, error } = await createAdminClient().rpc("consume_rate_limit", {
    bucket: key,
    max_hits: options.limit,
    window_seconds: Math.ceil(windowMs / 1000),
  });

  if (error) {
    // Si la migración aún no se aplicó o la base no responde, seguimos con el
    // contador local en lugar de dejar fuera a todo el mundo. Queda registrado
    // para que la degradación no pase inadvertida.
    console.error("No se pudo aplicar el límite compartido de peticiones", error.message);
    return null;
  }
  return data === false ? tooManyRequests() : null;
}

/**
 * Bloqueo por cuenta para el inicio de sesión. Complementa al límite por IP: es
 * lo que frena el relleno de credenciales repartido entre muchas direcciones.
 */
export async function isAccountLocked(email: string) {
  const { data, error } = await createAdminClient()
    .from("users")
    .select("locked_until")
    .eq("email", email.toLowerCase())
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data?.locked_until) return false;
  return new Date(data.locked_until).getTime() > Date.now();
}

export async function registerFailedLogin(email: string) {
  const { error } = await createAdminClient().rpc("register_failed_login", {
    target_email: email.toLowerCase(),
  });
  if (error) console.error("No se pudo registrar el intento fallido de acceso", error.message);
}

export async function clearFailedLogins(userId: string) {
  const { error } = await createAdminClient().rpc("clear_failed_logins", { target_user_id: userId });
  if (error) console.error("No se pudo reiniciar el contador de accesos fallidos", error.message);
}
