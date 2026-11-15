import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import nextEnv from "@next/env";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = nextEnv;

export function isPooledDatabaseConnection(databaseUrl) {
  if (!databaseUrl) return false;
  return /(^|[-.])pooler([-.]|$)|pgbouncer=true/i.test(databaseUrl);
}

/**
 * Normalizes DATABASE_URL / DIRECT_URL for Prisma CLI after Next.js env files
 * (.env.local > .env) are loaded. Mirrors direct local Postgres URL into DIRECT_URL
 * when unpooled, while rejecting pooled (-pooler) migration runs that omit DIRECT_URL.
 */
export function resolvePrismaCommandEnv(rawEnv, prismaArgs = []) {
  const nextEnvObj = { ...rawEnv };
  const databaseUrl = nextEnvObj.DATABASE_URL?.trim();
  const directUrl = nextEnvObj.DIRECT_URL?.trim();
  const subcommand = prismaArgs[0] ?? "";
  const needsDirectDbCheck =
    subcommand === "migrate" || subcommand === "db" || subcommand === "validate";

  if (!directUrl && databaseUrl) {
    if (isPooledDatabaseConnection(databaseUrl)) {
      if (needsDirectDbCheck) {
        return {
          ok: false,
          error:
            "DIRECT_URL is missing or empty while DATABASE_URL uses a connection pooler (-pooler / pgbouncer). Set the unpooled direct PostgreSQL URL in DIRECT_URL (.env.local or .env) before running Prisma migrations.",
        };
      }
    } else {
      nextEnvObj.DIRECT_URL = databaseUrl;
    }
  }

  return { ok: true, env: nextEnvObj };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: node scripts/run-prisma.mjs <prisma-args...>");
    process.exit(1);
  }

  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production", {
    info: (msg) => console.log(msg),
    error: (msg) => console.error(msg),
  });

  const resolved = resolvePrismaCommandEnv(process.env, args);
  if (!resolved.ok) {
    console.error(resolved.error);
    process.exit(1);
  }

  const prismaPkgPath = require.resolve("prisma/package.json");
  const prismaCliPath = path.join(path.dirname(prismaPkgPath), "build", "index.js");

  const child = spawnSync(process.execPath, [prismaCliPath, ...args], {
    stdio: "inherit",
    env: resolved.env,
  });

  if (child.error) {
    console.error(child.error.message);
    process.exit(1);
  }

  process.exit(child.status ?? 1);
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  main();
}
