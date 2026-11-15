import { describe, expect, it } from "vitest";
import { isPooledDatabaseConnection, resolvePrismaCommandEnv } from "../../scripts/run-prisma.mjs";

describe("Prisma CLI Next.js Env Wrapper (scripts/run-prisma.mjs)", () => {
  it("falls back DIRECT_URL to DATABASE_URL for unpooled local PostgreSQL when DIRECT_URL is empty", () => {
    const result = resolvePrismaCommandEnv(
      {
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/akatsuki_yui",
        DIRECT_URL: "",
      },
      ["migrate", "deploy"]
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.env.DIRECT_URL).toBe(
        "postgresql://postgres:postgres@localhost:5432/akatsuki_yui"
      );
    }
  });

  it("blocks pooled (-pooler / pgbouncer) migration runs that omit DIRECT_URL", () => {
    expect(
      isPooledDatabaseConnection(
        "postgresql://u:p@ep-cool-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
      )
    ).toBe(true);

    const pooledMissingDirect = resolvePrismaCommandEnv(
      {
        DATABASE_URL:
          "postgresql://u:p@ep-cool-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
        DIRECT_URL: "",
      },
      ["migrate", "deploy"]
    );

    expect(pooledMissingDirect.ok).toBe(false);
    if (!pooledMissingDirect.ok) {
      expect(pooledMissingDirect.error).toContain("DIRECT_URL");
    }

    const pooledGenerate = resolvePrismaCommandEnv(
      {
        DATABASE_URL:
          "postgresql://u:p@ep-cool-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
      },
      ["generate"]
    );
    expect(pooledGenerate.ok).toBe(true);
  });

  it("preserves an explicit DIRECT_URL unchanged", () => {
    const result = resolvePrismaCommandEnv(
      {
        DATABASE_URL: "postgresql://u:p@ep-pooler.neon.tech/neondb",
        DIRECT_URL: "postgresql://u:p@ep-direct.neon.tech/neondb",
      },
      ["migrate", "status"]
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.env.DIRECT_URL).toBe("postgresql://u:p@ep-direct.neon.tech/neondb");
    }
  });
});
