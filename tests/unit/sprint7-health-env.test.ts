import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRawMock } = vi.hoisted(() => ({
  queryRawMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: queryRawMock,
  },
}));

import { GET as getHealth } from "@/app/api/health/route";
import { GET as getV1Health } from "@/app/api/v1/health/route";
import { isPooledDatabaseUrl, validateRuntimeEnvironment } from "@/lib/env";

describe("Sprint 7 Healthcheck, Runtime Env & Deployment Config Guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with Cache-Control: no-store on /api/health and /api/v1/health when DB is reachable", async () => {
    queryRawMock
      .mockResolvedValueOnce([{ "?column?": 1 }])
      .mockResolvedValueOnce([{ "?column?": 1 }]);

    const res1 = await getHealth();
    expect(res1.status).toBe(200);
    expect(res1.headers.get("cache-control")).toContain("no-store");
    expect(await res1.json()).toMatchObject({ status: "ok", db: "up" });

    const res2 = await getV1Health();
    expect(res2.status).toBe(200);
    expect(res2.headers.get("cache-control")).toContain("no-store");
    expect(await res2.json()).toMatchObject({ status: "ok", db: "up" });
  });

  it("returns sanitized 503 without leaking connection strings or stack traces on DB failure", async () => {
    queryRawMock.mockRejectedValueOnce(
      new Error("connect ECONNREFUSED postgresql://secret:pass@db.neon.tech:5432/prod")
    );

    const res = await getHealth();
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const rawText = await res.text();
    expect(rawText).not.toContain("postgresql://");
    expect(rawText).not.toContain("secret");
    expect(JSON.parse(rawText)).toMatchObject({ status: "error", db: "down" });
  });

  it("validates runtime env without requiring DIRECT_URL and checks Neon pooler + SMTP config", () => {
    expect(
      isPooledDatabaseUrl(
        "postgresql://u:p@ep-cool-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
      )
    ).toBe(true);
    expect(
      isPooledDatabaseUrl(
        "postgresql://u:p@ep-cool.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
      )
    ).toBe(false);

    const validProd = validateRuntimeEnvironment({
      NODE_ENV: "production",
      DATABASE_URL:
        "postgresql://u:p@ep-cool-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
      AUTH_SECRET: "a-very-strong-random-production-secret-minimum-32-chars",
      AUTH_URL: "https://akatsuki-yui.vercel.app",
      CRON_SECRET: "cron-secret-key-minimum-32-chars",
      SMTP_HOST: "smtp.gmail.com",
      SMTP_PORT: "587",
      SMTP_AUTH_MODE: "password",
      SMTP_USER: "bot@akatsuki.example",
      SMTP_PASS: "app-password",
      SMTP_FROM: "Akatsuki Yui <bot@akatsuki.example>",
    });

    expect(validProd.valid).toBe(true);
    expect(validProd.missingRequired).toEqual([]);
    expect(validProd.warnings).toEqual([]);
    expect(validProd.smtpConfigured).toBe(true);

    const directNeonProd = validateRuntimeEnvironment({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://u:p@ep-direct.ap-southeast-1.aws.neon.tech/neondb",
      AUTH_SECRET: "replace-with-short",
    });

    expect(directNeonProd.valid).toBe(false);
    expect(directNeonProd.missingRequired).toContain("CRON_SECRET");
    expect(directNeonProd.warnings.some((w) => w.includes("-pooler"))).toBe(true);
  });

  it("pins Vercel sin1 region, single daily Cron schedule, and blank-value .env.example", () => {
    const vercelConfig = JSON.parse(
      readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")
    ) as {
      regions?: string[];
      crons?: Array<{ path: string; schedule: string }>;
    };
    expect(vercelConfig.regions).toEqual(["sin1"]);
    expect(vercelConfig.crons).toEqual([
      { path: "/api/internal/notifications/process", schedule: "0 1 * * *" },
    ]);

    const envExampleLines = readFileSync(path.join(process.cwd(), ".env.example"), "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));

    expect(envExampleLines.some((line) => line.startsWith("RESEND_"))).toBe(false);
    expect(envExampleLines).toContain("SMTP_HOST=");
    expect(envExampleLines).toContain("DIRECT_URL=");
    expect(envExampleLines).toContain("TEST_DATABASE_URL=");

    for (const line of envExampleLines) {
      expect(line).toMatch(/^[A-Z0-9_]+=$/);
    }
  });
});
