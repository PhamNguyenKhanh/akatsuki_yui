import { config as loadDotenv } from "dotenv";
import { beforeAll, expect, vi } from "vitest";
import { applyIsolatedTestDatabaseEnv } from "./lib/test-db-isolation";

vi.mock("server-only", () => ({}));

// Load .env quietly so any configured DATABASE_URL / DIRECT_URL can be checked
// against TEST_DATABASE_URL, never silently used by integration tests.
loadDotenv({ quiet: true });

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
  applyIsolatedTestDatabaseEnv(process.env);
} else {
  // Unit tests must never connect to a real .env database unintentionally.
  delete process.env.DATABASE_URL;
  delete process.env.DIRECT_URL;
}

beforeAll(() => {
  const path = getCurrentTestPath();
  if (isIntegrationTestPath(path)) {
    applyIsolatedTestDatabaseEnv(process.env);
  }
});
