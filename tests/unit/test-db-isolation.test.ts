import { describe, expect, it } from "vitest";
import {
  applyIsolatedTestDatabaseEnv,
  parseDatabaseIdentity,
  sanitizeDatabaseErrorText,
  validateTestDatabaseIsolation,
} from "../lib/test-db-isolation";

describe("DEC-066 Mandatory Test Database Isolation Guard", () => {
  it("fails fast when TEST_DATABASE_URL is missing or blank without falling back to DATABASE_URL", () => {
    const env: Record<string, string | undefined> = {
      DATABASE_URL: "postgresql://user:secret@localhost:5432/akatsuki_yui",
      DIRECT_URL: "postgresql://user:secret@localhost:5432/akatsuki_yui",
    };

    expect(() => validateTestDatabaseIsolation(env)).toThrow(/TEST_DATABASE_URL is required/i);

    env.TEST_DATABASE_URL = "   ";
    expect(() => validateTestDatabaseIsolation(env)).toThrow(/TEST_DATABASE_URL is required/i);
  });

  it("rejects TEST_DATABASE_URL matching DATABASE_URL or DIRECT_URL even via localhost alias", () => {
    const envExact: Record<string, string | undefined> = {
      DATABASE_URL: "postgresql://devuser:devpass@localhost:5432/akatsuki_yui",
      TEST_DATABASE_URL: "postgresql://devuser:devpass@localhost:5432/akatsuki_yui",
    };
    expect(() => validateTestDatabaseIsolation(envExact)).toThrow(/cannot match DATABASE_URL/i);

    const envLocalhostAlias: Record<string, string | undefined> = {
      DATABASE_URL: "postgresql://devuser:devpass@localhost:5432/akatsuki_yui",
      DIRECT_URL: "postgresql://directuser:dirpass@ep-cool.neon.tech:5432/neondb",
      TEST_DATABASE_URL: "postgresql://testuser:testpass@127.0.0.1:5432/akatsuki_yui?schema=public",
    };
    expect(() => validateTestDatabaseIsolation(envLocalhostAlias)).toThrow(
      /cannot match DATABASE_URL/i
    );

    const envDirectMatch: Record<string, string | undefined> = {
      DATABASE_URL: "postgresql://pooler:p@ep-pooler.neon.tech:5432/neondb?sslmode=require",
      DIRECT_URL: "postgresql://direct:p@ep-direct.neon.tech:5432/neondb?sslmode=require",
      TEST_DATABASE_URL: "postgresql://direct:p@ep-direct.neon.tech:5432/neondb",
    };
    expect(() => validateTestDatabaseIsolation(envDirectMatch)).toThrow(/cannot match DIRECT_URL/i);
  });

  it("never leaks connection strings or passwords in error messages or sanitized logs", () => {
    const secretDbUrl = "postgresql://admin:SuperSecretPass99@localhost:5432/akatsuki_yui";
    const env: Record<string, string | undefined> = {
      DATABASE_URL: secretDbUrl,
      TEST_DATABASE_URL: secretDbUrl,
    };

    try {
      validateTestDatabaseIsolation(env);
      expect.unreachable("Should have thrown");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      expect(msg).not.toContain("SuperSecretPass99");
      expect(msg).not.toContain("postgresql://");
      expect(msg).not.toContain("akatsuki_yui");
    }

    const scrubbed = sanitizeDatabaseErrorText(
      `Failed connecting to ${secretDbUrl} cleanly`
    );
    expect(scrubbed).toBe("Failed connecting to [REDACTED_DB_URL] cleanly");
  });

  it("accepts a distinct isolated TEST_DATABASE_URL and overrides DATABASE_URL/DIRECT_URL in memory", () => {
    const env: Record<string, string | undefined> = {
      DATABASE_URL: "postgresql://devuser:devpass@localhost:5432/akatsuki_yui",
      DIRECT_URL: "postgresql://devuser:devpass@localhost:5432/akatsuki_yui",
      TEST_DATABASE_URL: "postgresql://testuser:testpass@localhost:5432/akatsuki_yui_test",
    };

    const applied = applyIsolatedTestDatabaseEnv(env);
    expect(applied).toBe("postgresql://testuser:testpass@localhost:5432/akatsuki_yui_test");
    expect(env.DATABASE_URL).toBe(applied);
    expect(env.DIRECT_URL).toBe(applied);
  });

  it("parses valid URLs and rejects malformed or non-postgres URLs cleanly", () => {
    expect(parseDatabaseIdentity("mysql://u:p@localhost:3306/db")).toBeNull();
    expect(parseDatabaseIdentity("not-a-url")).toBeNull();
    expect(parseDatabaseIdentity("postgresql://u:p@localhost:5432/akatsuki_yui_test")).toEqual({
      protocol: "postgresql:",
      host: "localhost",
      port: "5432",
      dbName: "akatsuki_yui_test",
    });

    expect(() =>
      validateTestDatabaseIsolation({
        TEST_DATABASE_URL: "http://localhost:5432/akatsuki_yui_test",
      })
    ).toThrow(/redacted/i);
  });
});
