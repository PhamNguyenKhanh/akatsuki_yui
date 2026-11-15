import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig, PROTECTED_ROUTE_PREFIXES } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const isLoggedIn = Boolean(req.auth?.user?.id);

  const isProtectedRoute = PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  // NOTE: Do not bounce /login or /register to /dashboard from Edge middleware alone.
  // Revoked JWTs (tokenVersion mismatch or non-ACTIVE user) still appear truthy here;
  // auth pages check PostgreSQL via getOptionalAuthContext() to avoid /login <-> /dashboard loops.
  if (isProtectedRoute && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
