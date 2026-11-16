import { beforeAll, expect, vi } from "vitest";
import { applyIsolatedTestDatabaseEnv, loadTestEnvFiles } from "./lib/test-db-isolation";

vi.mock("server-only", () => ({}));

// Load .env.local > .env quietly so any configured DATABASE_URL / DIRECT_URL can be checked
// against TEST_DATABASE_URL, never silently used by integration tests.
loadTestEnvFiles();

// Prevent Vitest unit/integration tests from ever sending real outbound SMTP emails
// using credentials loaded from .env / .env.local. Tests that verify SMTP behavior
// set explicit per-test values or mocks.
const SMTP_ENV_KEYS_TO_CLEAR = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_AUTH_MODE",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_OAUTH_CLIENT_ID",
  "SMTP_OAUTH_CLIENT_SECRET",
  "SMTP_OAUTH_REFRESH_TOKEN",
  "SMTP_FROM",
] as const;

// Assign empty string (rather than deleting) so Prisma Client's internal `.env` auto-loader
// does not re-hydrate SMTP_* credentials from `.env` at runtime during Vitest runs.
function clearExternalSmtpEnv(): void {
  for (const key of SMTP_ENV_KEYS_TO_CLEAR) {
    process.env[key] = "";
  }
}

clearExternalSmtpEnv();

const INITIAL_DB_ENV_SYMBOL = Symbol.for("akatsuki.initialDbEnvSnapshot");
type DbEnvSnapshot = {
  DATABASE_URL?: string;
  DIRECT_URL?: string;
  TEST_DATABASE_URL?: string;
};

function getInitialDbEnvSnapshot(): DbEnvSnapshot {
  const proc = process as unknown as Record<symbol, DbEnvSnapshot | undefined>;
  if (!proc[INITIAL_DB_ENV_SYMBOL]) {
    proc[INITIAL_DB_ENV_SYMBOL] = {
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
    };
  }
  return proc[INITIAL_DB_ENV_SYMBOL]!;
}

function applySafeIntegrationIsolation(): void {
  const snapshot = getInitialDbEnvSnapshot();
  const validationEnv: Record<string, string | undefined> = {
    DATABASE_URL: snapshot.DATABASE_URL,
    DIRECT_URL: snapshot.DIRECT_URL,
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? snapshot.TEST_DATABASE_URL,
  };
  const isolatedUrl = applyIsolatedTestDatabaseEnv(validationEnv);
  process.env.DATABASE_URL = isolatedUrl;
  process.env.DIRECT_URL = isolatedUrl;
}

getInitialDbEnvSnapshot();

function isIntegrationTestPath(testPath: string | undefined): boolean {
  if (!testPath) return false;
  return testPath.replace(/\\/g, "/").includes("/tests/integration/");
}

function getCurrentTestPath(): string | undefined {
  try {
    return expect.getState().testPath;
  } catch {
    return undefined;
  }
}

const argvRequestsIntegration = process.argv.some((arg) =>
  arg.replace(/\\/g, "/").includes("tests/integration")
);
const explicitIntegrationFlag = process.env.VITEST_INTEGRATION_GUARD === "1";
const currentPath = getCurrentTestPath();

if (isIntegrationTestPath(currentPath) || argvRequestsIntegration || explicitIntegrationFlag) {
  applySafeIntegrationIsolation();
} else {
  // Unit tests must never connect to a real .env database unintentionally.
  delete process.env.DATABASE_URL;
  delete process.env.DIRECT_URL;
}

beforeAll(() => {
  const path = getCurrentTestPath();
  if (isIntegrationTestPath(path)) {
    clearExternalSmtpEnv();
    applySafeIntegrationIsolation();
  }
});
