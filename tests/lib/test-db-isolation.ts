export interface ParsedDatabaseIdentity {
  protocol: string;
  host: string;
  port: string;
  dbName: string;
}

const DB_URL_REGEX = /postgres(?:ql)?:\/\/[^\s"'`]+/gi;

export function sanitizeDatabaseErrorText(message: string): string {
  return message.replace(DB_URL_REGEX, "[REDACTED_DB_URL]");
}

function normalizeHost(hostname: string): string {
  const lower = hostname.trim().toLowerCase();
  if (lower === "127.0.0.1" || lower === "::1" || lower === "[::1]") {
    return "localhost";
  }
  return lower;
}

export function parseDatabaseIdentity(rawUrl: string): ParsedDatabaseIdentity | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== "postgresql:" && protocol !== "postgres:") {
      return null;
    }

    const dbName = decodeURIComponent(parsed.pathname.replace(/^\/+/, "")).trim();
    if (!parsed.hostname || !dbName) {
      return null;
    }

    return {
      protocol,
      host: normalizeHost(parsed.hostname),
      port: parsed.port || "5432",
      dbName: dbName.toLowerCase(),
    };
  } catch {
    return null;
  }
}

export function areSameDatabaseTargets(urlA: string | undefined, urlB: string | undefined): boolean {
  if (!urlA?.trim() || !urlB?.trim()) {
    return false;
  }

  if (urlA.trim() === urlB.trim()) {
    return true;
  }

  const idA = parseDatabaseIdentity(urlA);
  const idB = parseDatabaseIdentity(urlB);
  if (!idA || !idB) {
    return false;
  }

  return idA.host === idB.host && idA.port === idB.port && idA.dbName === idB.dbName;
}

/**
 * Validates strict TEST_DATABASE_URL isolation (DEC-066):
 * - TEST_DATABASE_URL must be explicitly provided and non-empty.
 * - Zero fallback to DATABASE_URL or DIRECT_URL (even on localhost).
 * - Rejects TEST_DATABASE_URL matching DATABASE_URL or DIRECT_URL.
 * - Never embeds raw DB credentials/URLs in thrown errors.
 */
export function validateTestDatabaseIsolation(env: Record<string, string | undefined>): string {
  const rawTestUrl = env.TEST_DATABASE_URL?.trim();
  if (!rawTestUrl) {
    throw new Error(
      "TEST_DATABASE_URL is required for PostgreSQL integration tests (DEC-066). Refusing to fall back to DATABASE_URL or DIRECT_URL."
    );
  }

  const parsedTest = parseDatabaseIdentity(rawTestUrl);
  if (!parsedTest) {
    throw new Error(
      "TEST_DATABASE_URL has an invalid PostgreSQL connection string format (details redacted)."
    );
  }

  if (areSameDatabaseTargets(rawTestUrl, env.DATABASE_URL)) {
    throw new Error(
      "TEST_DATABASE_URL must point to an isolated test database and cannot match DATABASE_URL (connection details redacted)."
    );
  }

  if (areSameDatabaseTargets(rawTestUrl, env.DIRECT_URL)) {
    throw new Error(
      "TEST_DATABASE_URL must point to an isolated test database and cannot match DIRECT_URL (connection details redacted)."
    );
  }

  return rawTestUrl;
}

export function applyIsolatedTestDatabaseEnv(env: Record<string, string | undefined>): string {
  const isolatedUrl = validateTestDatabaseIsolation(env);
  env.DATABASE_URL = isolatedUrl;
  env.DIRECT_URL = isolatedUrl;
  return isolatedUrl;
}
