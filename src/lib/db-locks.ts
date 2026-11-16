import "server-only";
import type { Prisma } from "@prisma/client";

/**
 * Acquires a PostgreSQL transaction-scoped advisory lock when executing against
 * a real Prisma transaction client. Safely no-ops for unit-test transaction mocks
 * that omit `$executeRaw`.
 */
export async function acquireAdvisoryXactLock(
  tx: Prisma.TransactionClient,
  lockKey: string
): Promise<void> {
  const rawTx = tx as { $executeRaw?: unknown };
  if (typeof rawTx.$executeRaw === "function") {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
  }
}

/**
 * Acquires a PostgreSQL `FOR SHARE` row lock on `Project` inside task/dependency
 * creation transactions so concurrent `archiveProjectService` (`FOR UPDATE`) cannot
 * race past `assertProjectNotArchivedForTaskMutation`.
 */
export async function acquireProjectShareLock(
  tx: Prisma.TransactionClient,
  projectId: string
): Promise<void> {
  const rawTx = tx as { $queryRaw?: unknown };
  if (typeof rawTx.$queryRaw === "function") {
    await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${projectId}::uuid FOR SHARE`;
  }
}

export async function acquireProjectUpdateLock(
  tx: Prisma.TransactionClient,
  projectId: string
): Promise<void> {
  const rawTx = tx as { $queryRaw?: unknown };
  if (typeof rawTx.$queryRaw === "function") {
    await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${projectId}::uuid FOR UPDATE`;
  }
}

export async function acquireTaskUpdateLock(
  tx: Prisma.TransactionClient,
  taskId: string
): Promise<void> {
  const rawTx = tx as { $queryRaw?: unknown };
  if (typeof rawTx.$queryRaw === "function") {
    await tx.$queryRaw`SELECT "id" FROM "Task" WHERE "id" = ${taskId}::uuid FOR UPDATE`;
  }
}
