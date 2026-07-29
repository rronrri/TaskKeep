import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import type { SessionUser } from "@/types";

const protectedPrefixes = ["/admin", "/manager", "/collaborator"];

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// El planificador lo invoca la infraestructura de Vercel, sin cabeceras de
// navegador, y se autentica por su cuenta con CRON_SECRET.
const CSRF_EXEMPT = ["/api/cron/", "/api/health"];

function allowedOrigins(request: NextRequest) {
  const origins = new Set<string>();
  if (process.env.APP_URL) {
    try {
      origins.add(new URL(process.env.APP_URL).origin);
    } catch {
      // APP_URL mal formada: se ignora y queda el host real de la petición.
    }
  }
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    origins.add(`${proto}://${forwardedHost.split(",")[0]?.trim()}`);
  }
  return origins;
}

/**
 * Comprobación de origen para toda petición que modifica datos.
 *
 * Antes vivía dentro de `protectMutation`, que sólo llamaban seis endpoints y que
 * además dejaba pasar cualquier petición sin cabecera `Origin`. La cookie de
 * sesión es `SameSite=Lax`, lo que ya frena la mayor parte del CSRF, pero era la
 * única defensa y dependía por completo del navegador.
 *
 * Aquí se invierte el criterio: una petición mutante debe demostrar que viene del
 * mismo origen; si no puede, se rechaza.
 */
function checkApiOrigin(request: NextRequest) {
  if (SAFE_METHODS.has(request.method)) return null;
  if (CSRF_EXEMPT.some((prefix) => request.nextUrl.pathname.startsWith(prefix))) return null;

  // `Sec-Fetch-Site` lo pone el navegador y no se puede alterar desde JavaScript,
  // así que es la señal más fiable cuando está presente.
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) {
    return fetchSite === "same-origin" || fetchSite === "none" ? null : forbidden();
  }

  // Sin esa cabecera exigimos un `Origin` que coincida. Los clientes que no son
  // navegadores (scripts, pruebas) deben declararlo explícitamente.
  const origin = request.headers.get("origin");
  if (origin && allowedOrigins(request).has(origin)) return null;

  return forbidden();
}

function forbidden() {
  return NextResponse.json(
    { error: "Origen no permitido para esta operación" },
    { status: 403 },
  );
}

export async function proxy(request: NextRequest) {
  const cookieName = process.env.COOKIE_NAME ?? "taskkeep_session";

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return checkApiOrigin(request) ?? NextResponse.next();
  }

  const protectedRoute = protectedPrefixes.some((prefix) => request.nextUrl.pathname.startsWith(prefix));
  if (!protectedRoute) return NextResponse.next();

  const token = request.cookies.get(cookieName)?.value;
  const jwtSecret = process.env.JWT_SECRET;
  if (!token || !jwtSecret || jwtSecret.length < 32) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(jwtSecret));
    const user = payload.user as SessionUser | undefined;
    if (!user) throw new Error("Sesión inválida");

    const profilePath = `/${user.role}/profile`;
    if (user.mustChangePassword && request.nextUrl.pathname !== profilePath) {
      const url = new URL(profilePath, request.url);
      url.searchParams.set("temporary", "1");
      return NextResponse.redirect(url);
    }

    if (!request.nextUrl.pathname.startsWith(`/${user.role}`)) {
      return NextResponse.redirect(new URL(`/${user.role}/dashboard`, request.url));
    }

    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete(cookieName);
    return response;
  }
}

export const config = {
  matcher: ["/admin/:path*", "/manager/:path*", "/collaborator/:path*", "/api/:path*"],
};
