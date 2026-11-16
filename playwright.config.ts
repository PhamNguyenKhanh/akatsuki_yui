import { defineConfig, devices } from "@playwright/test";
import { loadTestEnvFiles, validateTestDatabaseIsolation } from "./tests/lib/test-db-isolation";

loadTestEnvFiles();

const isListOnlyCommand = process.argv.includes("--list");
const E2E_PORT = Number(process.env.E2E_PORT || "3100");
const E2E_BASE_URL = process.env.E2E_BASE_URL || `http://127.0.0.1:${E2E_PORT}`;

const isolatedTestDatabaseUrl = isListOnlyCommand
  ? process.env.TEST_DATABASE_URL?.trim() ||
    "postgresql://list-only:placeholder@127.0.0.1:5432/akatsuki_yui_test"
  : validateTestDatabaseIsolation(process.env);

const e2eAuthSecret =
  process.env.E2E_AUTH_SECRET || "e2e-only-test-secret-key-minimum-32-chars-0123456789";
const e2eCronSecret =
  process.env.E2E_CRON_SECRET || "e2e-only-cron-secret-key-minimum-32-chars-0123456789";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: E2E_BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${E2E_PORT}`,
    url: `${E2E_BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NODE_ENV: "production",
      DATABASE_URL: isolatedTestDatabaseUrl,
      DIRECT_URL: isolatedTestDatabaseUrl,
      TEST_DATABASE_URL: isolatedTestDatabaseUrl,
      AUTH_SECRET: e2eAuthSecret,
      AUTH_URL: E2E_BASE_URL,
      NEXT_PUBLIC_APP_URL: E2E_BASE_URL,
      AUTH_TRUST_HOST: "true",
      CRON_SECRET: e2eCronSecret,
      SMTP_HOST: process.env.E2E_SMTP_HOST || "127.0.0.1",
      SMTP_PORT: process.env.E2E_SMTP_PORT || "2525",
      SMTP_SECURE: "false",
      E2E_ALLOW_PLAINTEXT_LOOPBACK_SMTP: "1",
      SMTP_AUTH_MODE: "password",
      SMTP_USER: "e2e-user",
      SMTP_PASS: "e2e-pass",
      SMTP_FROM: "noreply@akatsuki.local",
      SMTP_DAILY_SEND_LIMIT: "50",
      SMTP_PER_MINUTE_LIMIT: "10",
    },
  },
});
