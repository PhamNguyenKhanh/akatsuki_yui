/**
 * Restricts post-login callback redirects to same-origin relative application paths.
 * Rejects protocol-relative URLs (`//evil.com`), backslashes (`/\evil.com`), external origins,
 * and auth route redirect loops (`/login`, `/register`).
 */
export function getSafeCallbackUrl(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== "string") {
    return "/dashboard";
  }

  const trimmed = rawUrl.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return "/dashboard";
  }

  // Reject control characters (CR/LF/NUL/tabs)
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    return "/dashboard";
  }

  try {
    const parsed = new URL(trimmed, "http://localhost");
    if (parsed.origin !== "http://localhost" || !parsed.pathname.startsWith("/")) {
      return "/dashboard";
    }
    if (parsed.pathname === "/login" || parsed.pathname === "/register") {
      return "/dashboard";
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/dashboard";
  }
}
