import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { headers as nextHeaders } from "next/headers";
import { isAppError, rateLimitExceededError, serviceUnavailableError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const RATE_LIMIT_SCOPES = {
  AUTH_LOGIN_IP: "auth:login:ip",
  AUTH_LOGIN_FAIL: "auth:login:fail",
  AUTH_REGISTER_IP: "auth:register:ip",
  AUTH_PASSWORD_CHANGE_USER: "auth:password_change:user",
  ADMIN_DELIVERY_RETRY_USER: "admin:delivery_retry:user",
  API_WRITE_ACTOR: "api:write:actor",
} as const;

export type RateLimitScope = (typeof RATE_LIMIT_SCOPES)[keyof typeof RATE_LIMIT_SCOPES];

export interface RateLimitRule {
  scope: RateLimitScope;
  limit: number;
  windowMs: number;
  failClosed: boolean;
  blockMessage: string;
}

export const RATE_LIMIT_RULES: Record<RateLimitScope, RateLimitRule> = {
  [RATE_LIMIT_SCOPES.AUTH_LOGIN_IP]: {
    scope: RATE_LIMIT_SCOPES.AUTH_LOGIN_IP,
    limit: 20,
    windowMs: 15 * 60 * 1000,
    failClosed: true,
    blockMessage: "Quá nhiều yêu cầu đăng nhập từ địa chỉ mạng này. Vui lòng thử lại sau.",
  },
  [RATE_LIMIT_SCOPES.AUTH_LOGIN_FAIL]: {
    scope: RATE_LIMIT_SCOPES.AUTH_LOGIN_FAIL,
    limit: 5,
    windowMs: 15 * 60 * 1000,
    failClosed: true,
    blockMessage: "Bạn đã đăng nhập sai quá số lần cho phép. Vui lòng thử lại sau.",
  },
  [RATE_LIMIT_SCOPES.AUTH_REGISTER_IP]: {
    scope: RATE_LIMIT_SCOPES.AUTH_REGISTER_IP,
    limit: 10,
    windowMs: 15 * 60 * 1000,
    failClosed: true,
    blockMessage: "Quá nhiều yêu cầu đăng ký từ địa chỉ mạng này. Vui lòng thử lại sau.",
  },
  [RATE_LIMIT_SCOPES.AUTH_PASSWORD_CHANGE_USER]: {
    scope: RATE_LIMIT_SCOPES.AUTH_PASSWORD_CHANGE_USER,
    limit: 5,
    windowMs: 15 * 60 * 1000,
    failClosed: true,
    blockMessage: "Bạn đã yêu cầu đổi mật khẩu quá nhiều lần. Vui lòng thử lại sau.",
  },
  [RATE_LIMIT_SCOPES.ADMIN_DELIVERY_RETRY_USER]: {
    scope: RATE_LIMIT_SCOPES.ADMIN_DELIVERY_RETRY_USER,
    limit: 20,
    windowMs: 15 * 60 * 1000,
    failClosed: true,
    blockMessage: "Bạn đã thao tác gửi lại email quá nhanh. Vui lòng thử lại sau ít phút.",
  },
  [RATE_LIMIT_SCOPES.API_WRITE_ACTOR]: {
    scope: RATE_LIMIT_SCOPES.API_WRITE_ACTOR,
    limit: 60,
    windowMs: 60 * 1000,
    failClosed: false,
    blockMessage: "Tần suất gửi yêu cầu vượt giới hạn cho phép. Vui lòng thử lại sau.",
  },
};

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: Date;
}

type RateLimitMode = "check" | "consume" | "record";

const rateLimitExecutionStore = new AsyncLocalStorage<Map<string, RateLimitResult>>();

/**
 * Ensures any nested rate-limit evaluations inside the same logical request
 * (e.g., API Route -> Helper -> AuthProvider) are de-duplicated so each request
 * counts strictly once per (mode, scope, keyHash).
 */
export async function runWithRateLimitContext<T>(fn: () => Promise<T>): Promise<T> {
  const existing = rateLimitExecutionStore.getStore();
  if (existing) {
    return fn();
  }
  return rateLimitExecutionStore.run(new Map<string, RateLimitResult>(), fn);
}

function getRateLimitHmacSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (secret) {
    return secret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required for HMAC rate-limit key derivation in production.");
  }
  return "akatsuki-yui-dev-rate-limit-hmac-fallback";
}

export function normalizeRateLimitIdentifier(raw: string): string {
  return raw.trim().toLowerCase() || "unknown";
}

/**
 * Derives an irreversible keyed HMAC-SHA256 bucket hash that includes BOTH
 * `scope` and the normalized identifier to eliminate cross-scope key collisions.
 */
export function buildRateLimitKeyHash(scope: RateLimitScope, rawIdentifier: string): string {
  const normalized = normalizeRateLimitIdentifier(rawIdentifier);
  return createHmac("sha256", getRateLimitHmacSecret())
    .update(`${scope}:${normalized}`)
    .digest("hex");
}

function stripOptionalPortFromIp(candidate: string): string {
  if (candidate.startsWith("[")) {
    const closingBracket = candidate.indexOf("]");
    if (closingBracket > 1) {
      const inside = candidate.slice(1, closingBracket);
      const remainder = candidate.slice(closingBracket + 1);
      if (!remainder || /^:\d{1,5}$/.test(remainder)) {
        return inside;
      }
    }
    return candidate;
  }

  const firstColon = candidate.indexOf(":");
  if (firstColon !== -1 && candidate.indexOf(":", firstColon + 1) === -1) {
    const portPart = candidate.slice(firstColon + 1);
    if (/^\d{1,5}$/.test(portPart)) {
      return candidate.slice(0, firstColon);
    }
  }

  return candidate;
}

function sanitizeIpCandidate(rawValue: string | null | undefined): string | null {
  if (!rawValue) return null;
  if (/[\r\n\0]/.test(rawValue)) return null;
  const firstEntry = rawValue.split(",")[0]?.trim();
  if (!firstEntry || firstEntry.length > 64 || /\s/.test(firstEntry)) {
    return null;
  }
  const normalized = stripOptionalPortFromIp(firstEntry).toLowerCase();
  if (isIP(normalized) === 0) {
    return null;
  }
  return normalized;
}

export function extractClientIpFromHeaders(headerSource?: Headers | null): string {
  if (!headerSource || !Boolean(process.env.VERCEL)) {
    return "unknown";
  }

  return (
    sanitizeIpCandidate(headerSource.get("x-vercel-forwarded-for")) ||
    sanitizeIpCandidate(headerSource.get("x-real-ip")) ||
    "unknown"
  );
}

export async function getRequestClientIp(explicitHeaders?: Headers | null): Promise<string> {
  if (explicitHeaders) {
    return extractClientIpFromHeaders(explicitHeaders);
  }
  try {
    const hdrs = await nextHeaders();
    return extractClientIpFromHeaders(hdrs);
  } catch {
    return "unknown";
  }
}

function hasRealDatabasePrimitives(): boolean {
  const candidate = prisma as { $transaction?: unknown; $queryRaw?: unknown };
  return (
    typeof candidate.$transaction === "function" &&
    typeof candidate.$queryRaw === "function"
  );
}

interface SlidingWindowRow {
  cnt: number;
  oldest: Date | null;
}

async function executeSlidingWindowOp(options: {
  scope: RateLimitScope;
  identifier: string;
  mode: RateLimitMode;
  now?: Date;
  customRule?: Partial<Pick<RateLimitRule, "limit" | "windowMs" | "failClosed" | "blockMessage">>;
}): Promise<RateLimitResult> {
  const baseRule = RATE_LIMIT_RULES[options.scope];
  const rule: RateLimitRule = {
    ...baseRule,
    ...options.customRule,
  };
  const now = options.now ?? new Date();

  const keyHash = buildRateLimitKeyHash(rule.scope, options.identifier);
  const store = rateLimitExecutionStore.getStore();
  const dedupSignature = `${options.mode}:${rule.scope}:${keyHash}`;

  const cachedOutcome = store?.get(dedupSignature);
  if (cachedOutcome) {
    if (!cachedOutcome.allowed && options.mode !== "record") {
      throw rateLimitExceededError(
        `${rule.blockMessage} (Thử lại sau khoảng ${cachedOutcome.retryAfterSeconds} giây).`,
        cachedOutcome.retryAfterSeconds
      );
    }
    return cachedOutcome;
  }

  // Unit tests that mock `@/lib/prisma` without SQL transaction primitives run cleanly without fake DB blocking,
  // unless an explicit rate-limit test supplies `$transaction` / `$queryRaw` to test DB failure behavior.
  if (process.env.NODE_ENV === "test" && !hasRealDatabasePrimitives()) {
    return {
      allowed: true,
      limit: rule.limit,
      remaining: rule.limit,
      retryAfterSeconds: 0,
      resetAt: new Date(now.getTime() + rule.windowMs),
    };
  }

  const windowStart = new Date(now.getTime() - rule.windowMs);
  const expiresAt = new Date(now.getTime() + rule.windowMs);

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      if (typeof (tx as { $executeRaw?: unknown }).$executeRaw === "function") {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`rl:${keyHash}`}))`;
      }

      const rows = await tx.$queryRaw<SlidingWindowRow[]>`
        SELECT COUNT(*)::int AS "cnt", (MIN("createdAt") AT TIME ZONE 'UTC') AS "oldest"
        FROM "RateLimitEvent"
        WHERE "keyHash" = ${keyHash}
          AND "createdAt" > (${windowStart}::timestamptz AT TIME ZONE 'UTC')
      `;

      const currentCount = Number(rows[0]?.cnt ?? 0);
      const oldestRaw = rows[0]?.oldest ? new Date(rows[0].oldest) : null;
      const computedResetAt = oldestRaw
        ? new Date(oldestRaw.getTime() + rule.windowMs)
        : new Date(now.getTime() + rule.windowMs);
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((computedResetAt.getTime() - now.getTime()) / 1000)
      );

      if (options.mode === "record") {
        const eventId = randomUUID();
        if (typeof (tx as { $executeRaw?: unknown }).$executeRaw === "function") {
          await tx.$executeRaw`
            INSERT INTO "RateLimitEvent" ("id", "keyHash", "scope", "createdAt", "expiresAt")
            VALUES (
              ${eventId}::uuid,
              ${keyHash},
              ${rule.scope},
              (${now}::timestamptz AT TIME ZONE 'UTC'),
              (${expiresAt}::timestamptz AT TIME ZONE 'UTC')
            )
          `;
        } else {
          await tx.rateLimitEvent.create({
            data: {
              id: eventId,
              keyHash,
              scope: rule.scope,
              createdAt: now,
              expiresAt,
            },
          });
        }
        const nextCount = currentCount + 1;
        return {
          allowed: nextCount <= rule.limit,
          limit: rule.limit,
          remaining: Math.max(0, rule.limit - nextCount),
          retryAfterSeconds,
          resetAt: computedResetAt,
        };
      }

      if (currentCount >= rule.limit) {
        return {
          allowed: false,
          limit: rule.limit,
          remaining: 0,
          retryAfterSeconds,
          resetAt: computedResetAt,
        };
      }

      if (options.mode === "consume") {
        const eventId = randomUUID();
        if (typeof (tx as { $executeRaw?: unknown }).$executeRaw === "function") {
          await tx.$executeRaw`
            INSERT INTO "RateLimitEvent" ("id", "keyHash", "scope", "createdAt", "expiresAt")
            VALUES (
              ${eventId}::uuid,
              ${keyHash},
              ${rule.scope},
              (${now}::timestamptz AT TIME ZONE 'UTC'),
              (${expiresAt}::timestamptz AT TIME ZONE 'UTC')
            )
          `;
        } else {
          await tx.rateLimitEvent.create({
            data: {
              id: eventId,
              keyHash,
              scope: rule.scope,
              createdAt: now,
              expiresAt,
            },
          });
        }
      }

      const effectiveCount = options.mode === "consume" ? currentCount + 1 : currentCount;
      return {
        allowed: true,
        limit: rule.limit,
        remaining: Math.max(0, rule.limit - effectiveCount),
        retryAfterSeconds: 0,
        resetAt: computedResetAt,
      };
    });

    store?.set(dedupSignature, outcome);

    if (!outcome.allowed && options.mode !== "record") {
      throw rateLimitExceededError(
        `${rule.blockMessage} (Thử lại sau khoảng ${outcome.retryAfterSeconds} giây).`,
        outcome.retryAfterSeconds
      );
    }

    return outcome;
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }

    logger.error("Rate limiter storage error", error, {
      scope: rule.scope,
      mode: options.mode,
      failClosed: rule.failClosed,
    });

    if (rule.failClosed) {
      throw serviceUnavailableError(
        "Dịch vụ xác thực tạm thời gián đoạn để bảo vệ an toàn hệ thống. Vui lòng thử lại sau."
      );
    }

    return {
      allowed: true,
      limit: rule.limit,
      remaining: rule.limit,
      retryAfterSeconds: 0,
      resetAt: expiresAt,
    };
  }
}

export async function consumeRateLimit(options: {
  scope: RateLimitScope;
  identifier: string;
  now?: Date;
  customRule?: Partial<Pick<RateLimitRule, "limit" | "windowMs" | "failClosed" | "blockMessage">>;
}): Promise<RateLimitResult> {
  return executeSlidingWindowOp({
    ...options,
    mode: "consume",
  });
}

export async function checkRateLimit(options: {
  scope: RateLimitScope;
  identifier: string;
  now?: Date;
  customRule?: Partial<Pick<RateLimitRule, "limit" | "windowMs" | "failClosed" | "blockMessage">>;
}): Promise<RateLimitResult> {
  return executeSlidingWindowOp({
    ...options,
    mode: "check",
  });
}

export async function recordRateLimitFailure(options: {
  scope: RateLimitScope;
  identifier: string;
  now?: Date;
}): Promise<RateLimitResult> {
  return executeSlidingWindowOp({
    ...options,
    mode: "record",
  });
}

export async function enforceApiWriteRateLimit(actorId: string): Promise<RateLimitResult> {
  return runWithRateLimitContext(() =>
    consumeRateLimit({
      scope: RATE_LIMIT_SCOPES.API_WRITE_ACTOR,
      identifier: actorId,
    })
  );
}

/**
 * Enforces Login rate limits in a single execution context:
 * - IP bucket (`auth:login:ip`): counts ALL attempts
 * - `(IP + normalizedEmail)` bucket (`auth:login:fail`): checked before credentials verification
 *   and incremented ONLY if authentication fails. Successful login never increments it.
 */
export async function executeWithLoginRateLimit<T>(
  options: {
    email: string;
    headers?: Headers | null;
    now?: Date;
  },
  fn: () => Promise<T>
): Promise<T> {
  return runWithRateLimitContext(async () => {
    const clientIp = await getRequestClientIp(options.headers);
    const normalizedEmail = normalizeRateLimitIdentifier(options.email);
    const failIdentifier = `${clientIp}:${normalizedEmail}`;

    // 1. Pre-check IP bucket (consumes 1 attempt immediately)
    await consumeRateLimit({
      scope: RATE_LIMIT_SCOPES.AUTH_LOGIN_IP,
      identifier: clientIp,
      now: options.now,
    });

    // 2. Pre-check (IP + Email) failure bucket READ-ONLY before password hashing
    await checkRateLimit({
      scope: RATE_LIMIT_SCOPES.AUTH_LOGIN_FAIL,
      identifier: failIdentifier,
      now: options.now,
    });

    try {
      return await fn();
    } catch (error) {
      // Only failed login attempts increment `auth:login:fail`
      try {
        await recordRateLimitFailure({
          scope: RATE_LIMIT_SCOPES.AUTH_LOGIN_FAIL,
          identifier: failIdentifier,
          now: options.now,
        });
      } catch (recordErr) {
        logger.warn("Failed to record login failure event after auth error", {
          error: recordErr instanceof Error ? recordErr.message : String(recordErr),
        });
      }
      throw error;
    }
  });
}

/**
 * Deletes up to `limit` expired `RateLimitEvent` rows using a PostgreSQL CTE
 * (PostgreSQL does not support `DELETE ... LIMIT` syntax directly).
 */
export async function cleanupExpiredRateLimitEventsBatch(limit = 200): Promise<number> {
  if (process.env.NODE_ENV === "test" && !hasRealDatabasePrimitives()) {
    return 0;
  }
  const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
  const cutoff = new Date();
  const deleted = await prisma.$executeRaw`
    WITH expired AS (
      SELECT "id"
      FROM "RateLimitEvent"
      WHERE "expiresAt" <= (${cutoff}::timestamptz AT TIME ZONE 'UTC')
      LIMIT ${safeLimit}
    )
    DELETE FROM "RateLimitEvent"
    WHERE "id" IN (SELECT "id" FROM expired)
  `;
  return Number(deleted ?? 0);
}
