import "server-only";
import { ProjectMemberRole, ProjectStatus, TaskStatus, type Prisma } from "@prisma/client";
import {
  acquireAdvisoryXactLock,
  acquireProjectShareLock,
  acquireTaskUpdateLock,
} from "@/lib/db-locks";
import { badRequestError, conflictError, forbiddenError, notFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { uuidSchema } from "@/lib/validations/common";
import {
  assertProjectLeaderAccess,
  assertProjectReadAccess,
  isWorkspaceAdmin,
} from "@/modules/projects/project.access";
import type { AuthContext } from "@/types/auth";

export function parseTaskId(taskId: string): string {
  const parsed = uuidSchema.safeParse(taskId);
  if (!parsed.success) {
    throw badRequestError("Task ID không đúng định dạng UUID.", [
      { field: "taskId", message: "Task ID không hợp lệ." },
    ]);
  }
  return parsed.data;
}

export function parseTaskScopedUserId(userId: string, fieldName = "userId"): string {
  const parsed = uuidSchema.safeParse(userId);
  if (!parsed.success) {
    throw badRequestError("User ID không đúng định dạng UUID.", [
      { field: fieldName, message: "User ID không hợp lệ." },
    ]);
  }
  return parsed.data;
}

export function assertProjectNotArchivedForTaskMutation(projectStatus: ProjectStatus): void {
  if (projectStatus === ProjectStatus.ARCHIVED) {
    throw conflictError(
      "PROJECT_ARCHIVED",
      "Project đã ở trạng thái ARCHIVED, chỉ được xem dữ liệu Task."
    );
  }
}

export function assertTaskNotDoneForMutation(taskStatus: TaskStatus): void {
  if (taskStatus === TaskStatus.DONE) {
    throw conflictError(
      "TASK_ALREADY_COMPLETED",
      "Task đã hoàn thành (DONE) và bị khóa chỉnh sửa hoàn toàn."
    );
  }
}

export interface TaskMutationLockOptions {
  lockForMutation?: boolean;
  advisoryLockKey?: (projectId: string) => string;
}

async function lockProjectAndTaskForMutation(
  tx: Prisma.TransactionClient,
  taskId: string,
  options?: TaskMutationLockOptions
): Promise<void> {
  if (!options?.lockForMutation) {
    return;
  }

  const rawTx = tx as { $queryRaw?: unknown };
  if (typeof rawTx.$queryRaw !== "function") {
    return;
  }

  const metaRows = await tx.$queryRaw<Array<{ projectId: string }>>`
    SELECT "projectId" FROM "Task" WHERE "id" = ${taskId}::uuid
  `;
  const projectId = Array.isArray(metaRows) ? metaRows[0]?.projectId : undefined;
  if (!projectId) {
    return;
  }

  // Deterministic lock hierarchy: Project SHARE -> optional advisory lock -> Task UPDATE
  await acquireProjectShareLock(tx, projectId);
  if (options.advisoryLockKey) {
    await acquireAdvisoryXactLock(tx, options.advisoryLockKey(projectId));
  }
  await acquireTaskUpdateLock(tx, taskId);
}

export function isProjectLeaderOrAdmin(
  actor: AuthContext,
  project: {
    leaderId: string;
    members: { projectRole: ProjectMemberRole }[];
  }
): boolean {
  if (isWorkspaceAdmin(actor)) return true;
  if (project.leaderId === actor.userId) return true;
  return project.members.some((member) => member.projectRole === ProjectMemberRole.LEADER);
}

export function isProjectReviewerOrLeaderOrAdmin(
  actor: AuthContext,
  project: {
    leaderId: string;
    members: { projectRole: ProjectMemberRole }[];
  }
): boolean {
  if (isProjectLeaderOrAdmin(actor, project)) return true;
  return project.members.some((member) => member.projectRole === ProjectMemberRole.REVIEWER);
}

export async function isActiveTaskAssignee(
  taskId: string,
  userId: string,
  tx: Prisma.TransactionClient = prisma
): Promise<boolean> {
  const assignment = await tx.taskAssignee.findFirst({
    where: {
      taskId,
      userId,
      removedAt: null,
    },
    select: { id: true },
  });
  return assignment !== null;
}

export async function loadTaskRecordOrThrow(taskId: string, tx: Prisma.TransactionClient = prisma) {
  const task = await tx.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      projectId: true,
      createdById: true,
      title: true,
      description: true,
      priority: true,
      status: true,
      startDate: true,
      deadline: true,
      estimateHours: true,
      referenceLinks: true,
      progressNotes: true,
      completedAt: true,
      updatedAt: true,
    },
  });

  if (!task) {
    throw notFoundError("Không tìm thấy Task yêu cầu.");
  }

  return task;
}

export async function assertTaskReadAccess(
  actor: AuthContext,
  taskId: string,
  tx: Prisma.TransactionClient = prisma
) {
  const task = await loadTaskRecordOrThrow(taskId, tx);
  const project = await assertProjectReadAccess(actor, task.projectId, tx);
  return { task, project };
}

export async function assertTaskLeaderAccess(
  actor: AuthContext,
  taskId: string,
  tx: Prisma.TransactionClient = prisma,
  options?: TaskMutationLockOptions
) {
  await lockProjectAndTaskForMutation(tx, taskId, options);
  const task = await loadTaskRecordOrThrow(taskId, tx);
  const project = await assertProjectLeaderAccess(actor, task.projectId, tx);
  return { task, project };
}

export async function assertTaskReviewAccess(
  actor: AuthContext,
  taskId: string,
  tx: Prisma.TransactionClient = prisma,
  options?: TaskMutationLockOptions
) {
  await lockProjectAndTaskForMutation(tx, taskId, options);
  const { task, project } = await assertTaskReadAccess(actor, taskId, tx);
  if (!isProjectReviewerOrLeaderOrAdmin(actor, project)) {
    throw forbiddenError(
      "Chỉ Project Leader, Reviewer của Project hoặc Admin mới có quyền duyệt / từ chối Task."
    );
  }
  return { task, project };
}

export async function assertTaskProgressOrReviewActorAccess(
  actor: AuthContext,
  taskId: string,
  tx: Prisma.TransactionClient = prisma,
  options?: TaskMutationLockOptions
) {
  await lockProjectAndTaskForMutation(tx, taskId, options);
  const { task, project } = await assertTaskReadAccess(actor, taskId, tx);
  const leaderOrAdmin = isProjectLeaderOrAdmin(actor, project);
  if (leaderOrAdmin) {
    return { task, project, isLeaderOrAdmin: true, isAssignedMember: false };
  }

  const assigned = await isActiveTaskAssignee(task.id, actor.userId, tx);
  if (!assigned) {
    throw forbiddenError(
      "Chỉ thành viên đang được phân công vào Task hoặc Project Leader mới được thực hiện thao tác này."
    );
  }

  return { task, project, isLeaderOrAdmin: false, isAssignedMember: true };
}
