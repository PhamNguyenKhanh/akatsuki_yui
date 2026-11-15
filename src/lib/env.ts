import "server-only";
import { z } from "zod";

const optionalTrimmed = z
  .string()
  .optional()
  .transform((v) => {
    const trimmed = v?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
  });

const booleanFlagSchema = z
  .string()
  .optional()
  .transform((v) => {
    const normalized = v?.trim().toLowerCase();
    return normalized === "true" || normalized === "1";
  });

const positiveIntWithDefault = (defaultValue: number, min = 1, max = 10000) =>
  z
    .string()
    .optional()
    .transform((raw) => {
      if (!raw || !raw.trim()) return defaultValue;
      const parsed = Number(raw);
      return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : defaultValue;
    });

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: optionalTrimmed,
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 characters"),
  AUTH_URL: optionalTrimmed,
  NEXT_PUBLIC_APP_URL: optionalTrimmed,
  CRON_SECRET: optionalTrimmed,
  SMTP_HOST: optionalTrimmed,
  SMTP_PORT: positiveIntWithDefault(587, 1, 65535),
  SMTP_SECURE: booleanFlagSchema,
  SMTP_AUTH_MODE: z
    .enum(["password", "oauth2"])
    .optional()
    .default("password"),
  SMTP_USER: optionalTrimmed,
  SMTP_PASS: optionalTrimmed,
  SMTP_OAUTH_CLIENT_ID: optionalTrimmed,
  SMTP_OAUTH_CLIENT_SECRET: optionalTrimmed,
  SMTP_OAUTH_REFRESH_TOKEN: optionalTrimmed,
  SMTP_FROM: optionalTrimmed,
  SMTP_DAILY_SEND_LIMIT: positiveIntWithDefault(50, 1, 5000),
  SMTP_PER_MINUTE_LIMIT: positiveIntWithDefault(10, 1, 200),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export interface SmtpRuntimeConfig {
  configured: boolean;
  host?: string;
  port: number;
  secure: boolean;
  authMode: "password" | "oauth2";
  user?: string;
  pass?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
  oauthRefreshToken?: string;
  from: string;
  dailySendLimit: number;
  perMinuteLimit: number;
  missingFields: string[];
}

export function getServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid server environment configuration: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`
    );
  }
  return parsed.data;
}

/**
 * Inspects SMTP configuration lazily from process.env without crashing unrelated
 * routes or SSR pages when email credentials are intentionally absent in local dev/CI.
 */
export function getSmtpConfigFromEnv(
  env: Record<string, string | undefined> = process.env
): SmtpRuntimeConfig {
  const host = env.SMTP_HOST?.trim() || undefined;
  const rawPort = Number(env.SMTP_PORT?.trim() || "587");
  const port = Number.isInteger(rawPort) && rawPort >= 1 && rawPort <= 65535 ? rawPort : 587;
  const secureRaw = env.SMTP_SECURE?.trim().toLowerCase();
  const secure = secureRaw === "true" || secureRaw === "1" || port === 465;
  const authMode: "password" | "oauth2" =
    env.SMTP_AUTH_MODE?.trim().toLowerCase() === "oauth2" ? "oauth2" : "password";

  const user = env.SMTP_USER?.trim() || undefined;
  const pass = env.SMTP_PASS?.trim() || undefined;
  const oauthClientId = env.SMTP_OAUTH_CLIENT_ID?.trim() || undefined;
  const oauthClientSecret = env.SMTP_OAUTH_CLIENT_SECRET?.trim() || undefined;
  const oauthRefreshToken = env.SMTP_OAUTH_REFRESH_TOKEN?.trim() || undefined;
  const from = env.SMTP_FROM?.trim() || user || "Akatsuki Yui <no-reply@akatsuki-yui.local>";

  const rawDaily = Number(env.SMTP_DAILY_SEND_LIMIT?.trim() || "50");
  const dailySendLimit = Number.isInteger(rawDaily) && rawDaily >= 1 ? rawDaily : 50;

  const rawPerMinute = Number(env.SMTP_PER_MINUTE_LIMIT?.trim() || "10");
  const perMinuteLimit = Number.isInteger(rawPerMinute) && rawPerMinute >= 1 ? rawPerMinute : 10;

  const missingFields: string[] = [];
  if (!host) missingFields.push("SMTP_HOST");
  if (!env.SMTP_FROM?.trim() && !user) missingFields.push("SMTP_FROM");
  if (!user) missingFields.push("SMTP_USER");

  if (authMode === "oauth2") {
    if (!oauthClientId) missingFields.push("SMTP_OAUTH_CLIENT_ID");
    if (!oauthClientSecret) missingFields.push("SMTP_OAUTH_CLIENT_SECRET");
    if (!oauthRefreshToken) missingFields.push("SMTP_OAUTH_REFRESH_TOKEN");
  } else {
    if (!pass) missingFields.push("SMTP_PASS");
  }

  return {
    configured: missingFields.length === 0,
    host,
    port,
    secure,
    authMode,
    user,
    pass,
    oauthClientId,
    oauthClientSecret,
    oauthRefreshToken,
    from,
    dailySendLimit,
    perMinuteLimit,
    missingFields,
  };
}
