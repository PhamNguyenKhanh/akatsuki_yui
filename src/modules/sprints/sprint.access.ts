import "server-only";
import { ProjectStatus, type Prisma } from "@prisma/client";
import { type ZodType } from "zod";
import { AppError, badRequestError, conflictError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { uuidSchema } from "@/lib/validations/common";
import {
  assertProjectLeaderAccess,
  assertProjectReadAccess,
} from "@/modules/projects/project.access";
import type { AuthContext } from "@/types/auth";

export function parseSprintInput<T>(
  schema: ZodType<T>,
  rawInput: unknown,
  fallbackMessage: string
): T {
  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequestError(
      parsed.error.issues[0]?.message ?? fallbackMessage,
      parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "body",
        message: issue.message,
      }))
    );
  }
  return parsed.data;
}

export function parseSprintId(sprintId: string): string {
  const parsed = uuidSchema.safeParse(sprintId);
  if (!parsed.success) {
    throw badRequestError("ID Sprint không đúng định dạng UUID.");
  }
  return parsed.data;
}

export async function lockProjectRowForSprintMutation(
  projectId: string,
  tx: Prisma.TransactionClient
): Promise<void> {
  if (typeof (tx as { $queryRaw?: unknown }).$queryRaw === "function") {
    await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${projectId}::uuid FOR SHARE`;
  }
}

export async function acquireSprintPlanningLock(
  projectId: string,
  tx: Prisma.TransactionClient
): Promise<void> {
  if (typeof (tx as { $queryRaw?: unknown }).$queryRaw === "function") {
    const lockKey = `sprint_plan:${projectId}`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text AS locked`;
  }
}

export async function lockSprintTasksForUpdate(
  sprintId: string,
  tx: Prisma.TransactionClient
): Promise<void> {
  if (typeof (tx as { $queryRaw?: unknown }).$queryRaw === "function") {
    await tx.$queryRaw`SELECT "id", "status", "updatedAt" FROM "Task" WHERE "sprintId" = ${sprintId}::uuid ORDER BY "id" FOR UPDATE`;
  }
}

export async function lockSingleTaskForUpdate(
  taskId: string,
  tx: Prisma.TransactionClient
): Promise<void> {
  if (typeof (tx as { $queryRaw?: unknown }).$queryRaw === "function") {
    await tx.$queryRaw`SELECT "id", "status", "sprintId", "updatedAt" FROM "Task" WHERE "id" = ${taskId}::uuid FOR UPDATE`;
  }
}

export function assertProjectNotArchivedForSprintMutation(status: ProjectStatus): void {
  if (status === ProjectStatus.ARCHIVED) {
    throw conflictError(
      "PROJECT_ARCHIVED",
      "Project đã ở trạng thái ARCHIVED. Toàn bộ thao tác chỉnh sửa Sprint và Planning đang bị khóa."
    );
  }
}

export function assertProjectActiveForSprintActivation(status: ProjectStatus): void {
  assertProjectNotArchivedForSprintMutation(status);
  if (status !== ProjectStatus.ACTIVE) {
    throw conflictError(
      "INVALID_STATUS_TRANSITION",
      "Chỉ có thể kích hoạt Sprint khi Project đang ở trạng thái ACTIVE."
    );
  }
}

export async function loadSprintRecordOrThrow(
  sprintId: string,
  tx: Prisma.TransactionClient = prisma
) {
  const sprint = await tx.sprint.findUnique({
    where: { id: sprintId },
    select: {
      id: true,
      projectId: true,
      createdById: true,
      name: true,
      goal: true,
      startDate: true,
      endDate: true,
      status: true,
      activatedAt: true,
      completedAt: true,
      cancelledAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!sprint) {
    throw new AppError({
      statusCode: 404,
      code: "SPRINT_NOT_FOUND",
      message: "Không tìm thấy Sprint yêu cầu.",
    });
  }

  return sprint;
}

export async function assertSprintReadAccess(
  actor: AuthContext,
  sprintId: string,
  tx: Prisma.TransactionClient = prisma
) {
  const sprint = await loadSprintRecordOrThrow(sprintId, tx);
  const project = await assertProjectReadAccess(actor, sprint.projectId, tx);
  return { sprint, project };
}

export async function assertSprintManageAccess(
  actor: AuthContext,
  sprintId: string,
  tx: Prisma.TransactionClient = prisma
) {
  const sprint = await loadSprintRecordOrThrow(sprintId, tx);
  const project = await assertProjectLeaderAccess(actor, sprint.projectId, tx);
  assertProjectNotArchivedForSprintMutation(project.status);
  return { sprint, project };
}
