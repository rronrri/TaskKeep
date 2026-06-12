import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import type { SessionUser } from "@/types";

const protectedPrefixes = ["/admin", "/manager", "/collaborator"];

export async function proxy(request: NextRequest) {
  const cookieName = process.env.COOKIE_NAME ?? "taskkeep_session";
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
  matcher: ["/admin/:path*", "/manager/:path*", "/collaborator/:path*"],
};
