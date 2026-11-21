export const NONCE_REQUEST_HEADER = "x-nonce";

export interface SecurityHeaderEntry {
  key: string;
  value: string;
}

/**
 * HSTS is emitted exclusively in real Vercel Production deployments (`NODE_ENV === "production"`
 * AND `VERCEL_ENV === "production"`), without relying on build-time `NEXT_PUBLIC_APP_URL`
 * and without `includeSubDomains` / `preload` unless domain-wide HTTPS is explicitly guaranteed.
 */
export function shouldEnableHsts(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env.NODE_ENV === "production" && env.VERCEL_ENV === "production";
}

/**
 * Builds Content-Security-Policy header value.
 *
 * Production eliminates `'unsafe-inline'` and `'unsafe-eval'` from `script-src`, enforcing
 * `'self'` plus the per-request cryptographic `'nonce-...'` when served via middleware.
 *
 * Style policy note (`style-src 'self' 'unsafe-inline'`):
 * - Retained intentionally because `sonner` injects toast `<style>` nodes without a nonce
 *   at runtime (`node_modules/sonner/dist/index.mjs`) and React inline `style={{ ... }}`
 *   attributes are used by layout/chart components. Revisit if external libraries support nonces.
 */
export function buildContentSecurityPolicy(options: {
  isProd: boolean;
  nonce?: string;
}): string {
  const scriptSrc = options.isProd
    ? options.nonce
      ? `script-src 'self' 'nonce-${options.nonce}'`
      : "script-src 'self'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.pusher.com wss://*.pusher.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function buildSecurityHeaders(options: {
  isProd: boolean;
  nonce?: string;
  env?: Record<string, string | undefined>;
}): SecurityHeaderEntry[] {
  const headers: SecurityHeaderEntry[] = [
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy({ isProd: options.isProd, nonce: options.nonce }),
    },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ];

  if (shouldEnableHsts(options.env)) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000",
    });
  }

  return headers;
}
