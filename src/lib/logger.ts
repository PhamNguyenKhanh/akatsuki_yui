import "server-only";

const SENSITIVE_KEYS = new Set([
  "password",
  "currentPassword",
  "newPassword",
  "confirmPassword",
  "confirmNewPassword",
  "passwordHash",
  "secret",
  "token",
  "accessToken",
  "idToken",
  "csrfToken",
  "apiKey",
  "authorization",
  "cookie",
  "set-cookie",
  "x-nonce",
  "x-cron-secret",
  "smtpPass",
  "oauthClientSecret",
  "oauthRefreshToken",
  "refreshToken",
  "clientSecret",
  "pass",
  "databaseUrl",
  "directUrl",
  "testDatabaseUrl",
]);

function maskEmailAddress(email: string): string {
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0) {
    return "[REDACTED_EMAIL]";
  }
  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  const visiblePrefix = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visiblePrefix}***@${domain}`;
}

function scrubConnectionUrls(text: string): string {
  return text
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, "[REDACTED_DB_URL]")
    .replace(/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]")
    .replace(/(password|pass|token|secret|authorization)=[^\s&;]+/gi, "$1=[REDACTED]");
}

function redactValue(value: unknown, parentKey?: string): unknown {
  if (typeof value === "string") {
    if (parentKey && (parentKey === "email" || parentKey.toLowerCase().endsWith("email"))) {
      return maskEmailAddress(value);
    }
    return scrubConnectionUrls(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, parentKey));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const lower = k.toLowerCase();
      if (
        SENSITIVE_KEYS.has(k) ||
        lower.includes("password") ||
        lower.includes("secret") ||
        lower.includes("refreshtoken") ||
        lower.includes("authorization") ||
        lower.includes("cookie") ||
        lower.includes("apikey") ||
        (lower.includes("token") && lower !== "tokenversion" && !lower.includes("token_version")) ||
        lower.includes("database_url")
      ) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactValue(v, k);
      }
    }
    return out;
  }
  return value;
}

export const logger = {
  info(message: string, context?: Record<string, unknown>) {
    console.info(
      JSON.stringify({
        level: "info",
        timestamp: new Date().toISOString(),
        message,
        ...(context ? { context: redactValue(context) } : {}),
      })
    );
  },
  warn(message: string, context?: Record<string, unknown>) {
    console.warn(
      JSON.stringify({
        level: "warn",
        timestamp: new Date().toISOString(),
        message,
        ...(context ? { context: redactValue(context) } : {}),
      })
    );
  },
  error(message: string, error?: unknown, context?: Record<string, unknown>) {
    const safeError =
      error instanceof Error
        ? { name: error.name, message: scrubConnectionUrls(error.message) }
        : { raw: scrubConnectionUrls(String(error)) };
    console.error(
      JSON.stringify({
        level: "error",
        timestamp: new Date().toISOString(),
        message,
        error: safeError,
        ...(context ? { context: redactValue(context) } : {}),
      })
    );
  },
};
