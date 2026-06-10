import { NextRequest, NextResponse } from "next/server";

const protectedPrefixes = ["/admin", "/manager", "/collaborator"];

export function proxy(request: NextRequest) {
  const cookieName = process.env.COOKIE_NAME ?? "taskkeep_session";
  const protectedRoute = protectedPrefixes.some((prefix) => request.nextUrl.pathname.startsWith(prefix));
  if (protectedRoute && !request.cookies.has(cookieName)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/manager/:path*", "/collaborator/:path*"],
};
