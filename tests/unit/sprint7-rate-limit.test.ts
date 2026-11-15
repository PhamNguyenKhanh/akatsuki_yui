import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "203.0.113.10" })),
}));

const { eventStore, prismaMock } = vi.hoisted(() => {
  const store: Array<{ keyHash: string; scope: string; createdAt: Date; expiresAt: Date }> = [];

  const txMock = {
    $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join("?");
      if (sql.includes('INSERT INTO "RateLimitEvent"')) {
        const [, keyHash, scope, createdAt, expiresAt] = values as [
          string,
          string,
          string,
          Date,
          Date,
        ];
        store.push({ keyHash, scope, createdAt, expiresAt });
        return 1;
      }
      return 0;
    }),
    $queryRaw: vi.fn(async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      const [keyHash, windowStart] = values as [string, Date];
      const active = store.filter(
        (ev) => ev.keyHash === keyHash && ev.createdAt.getTime() > windowStart.getTime()
      );
      const oldest =
        active.length > 0
          ? new Date(Math.min(...active.map((a) => a.createdAt.getTime())))
          : null;
      return [{ cnt: active.length, oldest }];
    }),
  };

  return {
    eventStore: store,
    prismaMock: {
      $transaction: vi.fn(async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock)),
      $queryRaw: txMock.$queryRaw,
      $executeRaw: txMock.$executeRaw,
      __tx: txMock,
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import {
  RATE_LIMIT_SCOPES,
  buildRateLimitKeyHash,
  checkRateLimit,
  consumeRateLimit,
  executeWithLoginRateLimit,
  runWithRateLimitContext,
} from "@/lib/rate-limit";

describe("Sprint 7 Security — PostgreSQL Sliding Window Rate Limiter (DEC-065)", () => {
  beforeEach(() => {
    eventStore.length = 0;
    vi.clearAllMocks();
  });

  it("derives distinct HMAC keys across scopes even for identical identifiers", () => {
    const hashLoginIp = buildRateLimitKeyHash(RATE_LIMIT_SCOPES.AUTH_LOGIN_IP, "203.0.113.10");
    const hashRegIp = buildRateLimitKeyHash(RATE_LIMIT_SCOPES.AUTH_REGISTER_IP, "203.0.113.10");
    expect(hashLoginIp).not.toBe(hashRegIp);
    expect(hashLoginIp).toHaveLength(64);

    // Normalizes casing and whitespace deterministically
    expect(buildRateLimitKeyHash(RATE_LIMIT_SCOPES.AUTH_LOGIN_FAIL, "  User@Akatsuki.Local ")).toBe(
      buildRateLimitKeyHash(RATE_LIMIT_SCOPES.AUTH_LOGIN_FAIL, "user@akatsuki.local")
    );
  });

  it("enforces true sliding window expiry without fixed-window reset spikes", async () => {
    const t0 = new Date("2026-11-15T10:00:00.000Z");

    // 3 requests allowed in 60s window for custom limit = 3
    for (let i = 0; i < 3; i++) {
      await consumeRateLimit({
        scope: RATE_LIMIT_SCOPES.AUTH_REGISTER_IP,
        identifier: "198.51.100.5",
        now: new Date(t0.getTime() + i * 1000),
        customRule: { limit: 3, windowMs: 60_000 },
      });
    }

    // At t0 + 30s, still 3 events inside sliding 60s window -> rejected 429
    await expect(
      consumeRateLimit({
        scope: RATE_LIMIT_SCOPES.AUTH_REGISTER_IP,
        identifier: "198.51.100.5",
        now: new Date(t0.getTime() + 30_000),
        customRule: { limit: 3, windowMs: 60_000 },
      })
    ).rejects.toMatchObject({
      statusCode: 429,
      code: "RATE_LIMIT_EXCEEDED",
    });

    // At t0 + 60.5s, the first event fell out of the 60s window -> 1 slot reopened cleanly
    const reopened = await consumeRateLimit({
      scope: RATE_LIMIT_SCOPES.AUTH_REGISTER_IP,
      identifier: "198.51.100.5",
      now: new Date(t0.getTime() + 60_500),
      customRule: { limit: 3, windowMs: 60_000 },
    });
    expect(reopened.allowed).toBe(true);
  });

  it("records login failures only on failed auth and never increments auth:login:fail on success", async () => {
    const reqHeaders = new Headers({ "x-forwarded-for": "192.0.2.50" });

    // Successful login: consumes 1 auth:login:ip event, records 0 auth:login:fail events
    await executeWithLoginRateLimit(
      { email: "Admin@Akatsuki.Local", headers: reqHeaders },
      async () => "ok"
    );

    expect(eventStore.filter((e) => e.scope === RATE_LIMIT_SCOPES.AUTH_LOGIN_IP)).toHaveLength(1);
    expect(eventStore.filter((e) => e.scope === RATE_LIMIT_SCOPES.AUTH_LOGIN_FAIL)).toHaveLength(0);

    // 5 failed attempts block the 6th attempt BEFORE invoking auth callback
    for (let i = 0; i < 5; i++) {
      await expect(
        executeWithLoginRateLimit(
          { email: "Admin@Akatsuki.Local", headers: reqHeaders },
          async () => {
            throw new Error("bad pass");
          }
        )
      ).rejects.toThrow("bad pass");
    }

    expect(eventStore.filter((e) => e.scope === RATE_LIMIT_SCOPES.AUTH_LOGIN_FAIL)).toHaveLength(5);

    const authFn = vi.fn();
    await expect(
      executeWithLoginRateLimit({ email: "admin@akatsuki.local", headers: reqHeaders }, authFn)
    ).rejects.toMatchObject({ statusCode: 429, code: "RATE_LIMIT_EXCEEDED" });
    expect(authFn).not.toHaveBeenCalled();

    // Check-only helper also remains non-destructive
    await expect(
      checkRateLimit({
        scope: RATE_LIMIT_SCOPES.AUTH_LOGIN_FAIL,
        identifier: "192.0.2.50:other@akatsuki.local",
      })
    ).resolves.toMatchObject({ allowed: true });
  });

  it("de-duplicates nested rate limit checks inside a single AsyncLocalStorage request context", async () => {
    await runWithRateLimitContext(async () => {
      await consumeRateLimit({
        scope: RATE_LIMIT_SCOPES.AUTH_REGISTER_IP,
        identifier: "198.51.100.9",
      });
      await consumeRateLimit({
        scope: RATE_LIMIT_SCOPES.AUTH_REGISTER_IP,
        identifier: "198.51.100.9",
      });
    });

    expect(eventStore).toHaveLength(1);
  });

  it("fails closed with 503 SERVICE_UNAVAILABLE on sensitive auth endpoints when DB fails", async () => {
    prismaMock.$transaction.mockRejectedValueOnce(new Error("Postgres connection lost"));

    await expect(
      consumeRateLimit({
        scope: RATE_LIMIT_SCOPES.AUTH_LOGIN_IP,
        identifier: "203.0.113.88",
      })
    ).rejects.toMatchObject({
      statusCode: 503,
      code: "SERVICE_UNAVAILABLE",
    });
  });
});
