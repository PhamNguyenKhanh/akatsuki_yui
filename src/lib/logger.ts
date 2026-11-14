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
  "apiKey",
  "authorization",
]);

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (
        SENSITIVE_KEYS.has(k) ||
        k.toLowerCase().includes("password") ||
        k.toLowerCase().includes("secret")
      ) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactValue(v);
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
        ? { name: error.name, message: error.message }
        : { raw: String(error) };
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
