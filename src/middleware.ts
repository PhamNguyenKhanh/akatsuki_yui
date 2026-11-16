import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig, PROTECTED_ROUTE_PREFIXES } from "@/lib/auth.config";
import {
  NONCE_REQUEST_HEADER,
  buildContentSecurityPolicy,
  buildSecurityHeaders,
} from "@/lib/security-headers";

const { auth } = NextAuth(authConfig);

function generateCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function applySecurityHeaders(response: NextResponse, nonce: string): NextResponse {
  const headers = buildSecurityHeaders({
    isProd: process.env.NODE_ENV === "production",
    nonce,
    env: process.env,
  });

  for (const header of headers) {
    response.headers.set(header.key, header.value);
  }

  return response;
}

export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const isLoggedIn = Boolean(req.auth?.user?.id);
  const nonce = generateCspNonce();
  const cspHeaderValue = buildContentSecurityPolicy({
    isProd: process.env.NODE_ENV === "production",
    nonce,
  });

  const isProtectedRoute = PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  // NOTE: Do not bounce /login or /register to /dashboard from Edge middleware alone.
  // Revoked JWTs (tokenVersion mismatch or non-ACTIVE user) still appear truthy here;
  // auth pages check PostgreSQL via getOptionalAuthContext() to avoid /login <-> /dashboard loops.
  if (isProtectedRoute && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return applySecurityHeaders(NextResponse.redirect(loginUrl), nonce);
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(NONCE_REQUEST_HEADER, nonce);
  requestHeaders.set("Content-Security-Policy", cspHeaderValue);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  return applySecurityHeaders(response, nonce);
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
