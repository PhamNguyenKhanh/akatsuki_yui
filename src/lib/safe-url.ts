export const ALLOWED_GOOGLE_DRIVE_HOSTS = new Set(["drive.google.com", "docs.google.com"]);
export const ALLOWED_GOOGLE_MEET_HOSTS = new Set(["meet.google.com"]);

const CONTROL_CHARS_OR_BACKSLASH = /[\u0000-\u001F\u007F\\]/;
const HTTP_HTTPS_PREFIX = /^https?:\/\/[^/\s?#\\]/i;
const HTTPS_PREFIX = /^https:\/\/[^/\s?#\\]/i;

export interface GoogleDriveUrlValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  reason?: string;
}

/**
 * Validates and preserves a safe external http(s) URL while blocking
 * dangerous schemes (javascript:, data:, vbscript:, file:), control chars,
 * embedded credentials, backslashes, and protocol-relative URLs (//host).
 */
export function sanitizeExternalHttpUrl(
  rawUrl: string | null | undefined,
  options?: { maxLength?: number }
): string | null {
  if (typeof rawUrl !== "string") {
    return null;
  }

  const trimmed = rawUrl.trim();
  const maxLength = options?.maxLength ?? 2048;
  if (!trimmed || trimmed.length > maxLength) {
    return null;
  }

  if (CONTROL_CHARS_OR_BACKSLASH.test(trimmed) || /\s/.test(trimmed)) {
    return null;
  }

  if (!HTTP_HTTPS_PREFIX.test(trimmed)) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  if (parsed.username || parsed.password || parsed.hostname.length === 0) {
    return null;
  }

  return trimmed;
}

export function isSafeHttpUrl(rawUrl: string): boolean {
  return sanitizeExternalHttpUrl(rawUrl) !== null;
}

/**
 * Validates that a URL is a legitimate HTTPS Google Drive or Google Docs link (DEC-035).
 * Rejects http:, control chars, embedded credentials, lookalike domains, subdomains, and bare root URLs.
 */
export function validateGoogleDriveUrl(rawUrl: string): GoogleDriveUrlValidationResult {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, reason: "URL tài liệu không được để trống." };
  }
  if (trimmed.length > 1000) {
    return { valid: false, reason: "URL tài liệu không được vượt quá 1000 ký tự." };
  }
  if (
    CONTROL_CHARS_OR_BACKSLASH.test(trimmed) ||
    /\s/.test(trimmed) ||
    !HTTPS_PREFIX.test(trimmed)
  ) {
    return {
      valid: false,
      reason: "URL tài liệu không đúng định dạng HTTPS hợp lệ.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, reason: "URL tài liệu không đúng định dạng hợp lệ." };
  }

  if (parsed.protocol !== "https:") {
    return {
      valid: false,
      reason: "Chỉ chấp nhận liên kết Google Drive / Google Docs sử dụng giao thức HTTPS.",
    };
  }

  if (parsed.username || parsed.password) {
    return {
      valid: false,
      reason: "URL tài liệu không được chứa thông tin xác thực (username/password).",
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!ALLOWED_GOOGLE_DRIVE_HOSTS.has(hostname)) {
    return {
      valid: false,
      reason:
        "Chỉ chấp nhận liên kết từ tên miền chính thức https://drive.google.com hoặc https://docs.google.com.",
    };
  }

  if (parsed.port && parsed.port !== "443") {
    return {
      valid: false,
      reason: "URL tài liệu không được sử dụng cổng mạng tùy chỉnh.",
    };
  }

  const cleanPath = parsed.pathname.replace(/\/+$/, "");
  if (!cleanPath || cleanPath === "") {
    return {
      valid: false,
      reason: "URL phải trỏ tới một tệp, thư mục hoặc tài liệu cụ thể trên Google Drive / Docs.",
    };
  }

  return {
    valid: true,
    normalizedUrl: trimmed,
  };
}

export function sanitizeGoogleDriveReadUrl(rawUrl: string | null | undefined): string | null {
  if (typeof rawUrl !== "string") {
    return null;
  }
  const check = validateGoogleDriveUrl(rawUrl);
  return check.valid ? (check.normalizedUrl ?? null) : null;
}

/**
 * Validates that a URL is a legitimate HTTPS Google Meet link (https://meet.google.com/<code>).
 * Rejects http:, control chars, embedded credentials, lookalike domains, subdomains, and bare root URLs.
 */
export function validateGoogleMeetUrl(rawUrl: string): GoogleDriveUrlValidationResult {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, reason: "Link Google Meet không được để trống." };
  }
  if (trimmed.length > 500) {
    return { valid: false, reason: "Link Google Meet không được vượt quá 500 ký tự." };
  }
  if (
    CONTROL_CHARS_OR_BACKSLASH.test(trimmed) ||
    /\s/.test(trimmed) ||
    !HTTPS_PREFIX.test(trimmed)
  ) {
    return {
      valid: false,
      reason: "Link Google Meet không đúng định dạng HTTPS hợp lệ.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, reason: "Link Google Meet không đúng định dạng hợp lệ." };
  }

  if (parsed.protocol !== "https:") {
    return {
      valid: false,
      reason: "Link Google Meet bắt buộc sử dụng giao thức HTTPS.",
    };
  }

  if (parsed.username || parsed.password) {
    return {
      valid: false,
      reason: "Link Google Meet không được chứa thông tin xác thực.",
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!ALLOWED_GOOGLE_MEET_HOSTS.has(hostname)) {
    return {
      valid: false,
      reason: "Chỉ chấp nhận liên kết từ tên miền chính thức https://meet.google.com.",
    };
  }

  if (parsed.port && parsed.port !== "443") {
    return {
      valid: false,
      reason: "Link Google Meet không được sử dụng cổng mạng tùy chỉnh.",
    };
  }

  const cleanPath = parsed.pathname.replace(/\/+$/, "");
  if (!cleanPath || cleanPath === "") {
    return {
      valid: false,
      reason:
        "Link Google Meet phải bao gồm mã phòng họp cụ thể (VD: https://meet.google.com/abc-defg-hij).",
    };
  }

  return {
    valid: true,
    normalizedUrl: trimmed,
  };
}

export function sanitizeGoogleMeetReadUrl(rawUrl: string | null | undefined): string | null {
  if (typeof rawUrl !== "string") {
    return null;
  }
  const check = validateGoogleMeetUrl(rawUrl);
  return check.valid ? (check.normalizedUrl ?? null) : null;
}

/**
 * Validates internal app navigation paths (e.g. "/projects/uuid/tasks/uuid")
 * while blocking protocol-relative redirects ("//evil.com"), backslashes, or schemes.
 */
export function sanitizeInternalTargetPath(rawTargetUrl: string | null | undefined): string | null {
  if (typeof rawTargetUrl !== "string") {
    return null;
  }

  const trimmed = rawTargetUrl.trim();
  if (!trimmed || trimmed.length > 1000) {
    return null;
  }

  if (CONTROL_CHARS_OR_BACKSLASH.test(trimmed) || /\s/.test(trimmed)) {
    return null;
  }

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }

  const sentinelOrigin = "https://akatsuki.internal";
  let resolved: URL;
  try {
    resolved = new URL(trimmed, sentinelOrigin);
  } catch {
    return null;
  }

  if (resolved.origin !== sentinelOrigin || !resolved.pathname.startsWith("/")) {
    return null;
  }

  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}

/**
 * Resolves a notification action URL safely against a validated app baseUrl.
 * Accepts safe internal paths (e.g. "/projects/...") or same-origin http(s) URLs.
 * Rejects javascript:/data:/vbscript:/protocol-relative/cross-origin targets.
 */
export function resolveSafeNotificationTargetUrl(
  rawTargetUrl: string | null | undefined,
  baseUrl?: string | null
): string | null {
  if (typeof rawTargetUrl !== "string") {
    return null;
  }

  const trimmed = rawTargetUrl.trim();
  if (!trimmed || trimmed.length > 1000) {
    return null;
  }

  if (CONTROL_CHARS_OR_BACKSLASH.test(trimmed) || /\s/.test(trimmed)) {
    return null;
  }

  const safeBaseUrl = sanitizeExternalHttpUrl(baseUrl) ?? "http://localhost:3000";
  let parsedBase: URL;
  try {
    parsedBase = new URL(safeBaseUrl);
  } catch {
    parsedBase = new URL("http://localhost:3000");
  }

  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("//")) {
      return null;
    }
    try {
      const resolved = new URL(trimmed, parsedBase.origin);
      if (resolved.origin !== parsedBase.origin) {
        return null;
      }
      return resolved.toString();
    } catch {
      return null;
    }
  }

  const safeExternal = sanitizeExternalHttpUrl(trimmed, { maxLength: 1000 });
  if (!safeExternal) {
    return null;
  }

  try {
    const parsedExternal = new URL(safeExternal);
    return parsedExternal.origin === parsedBase.origin ? safeExternal : null;
  } catch {
    return null;
  }
}
