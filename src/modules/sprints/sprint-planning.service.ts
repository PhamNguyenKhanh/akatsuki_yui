import "server-only";
import { Prisma, SprintStatus, TaskHistoryAction, TaskStatus } from "@prisma/client";
import { AppError, badRequestError, conflictError, notFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { assertPermission } from "@/modules/authorization/policy.service";
import { assertProjectReadAccess, parseProjectId } from "@/modules/projects/project.access";
import {
  acquireSprintPlanningLock,
  assertProjectNotArchivedForSprintMutation,
  assertSprintManageAccess,
  loadSprintRecordOrThrow,
  lockProjectRowForSprintMutation,
  lockSingleTaskForUpdate,
  parseSprintId,
  parseSprintInput,
} from "@/modules/sprints/sprint.access";
import { moveSprintTaskSchema, sprintPlanningAssignSchema } from "@/modules/sprints/sprint.schema";
import { parseTaskId } from "@/modules/tasks/task.access";
import { taskHistoryRepository } from "@/modules/tasks/task-history.repository";
import {
  mapTaskSummary,
  taskRepository,
  taskSummarySelect,
  type TaskDetailDTO,
  type TaskSummaryDTO,
} from "@/modules/tasks/task.repository";
import { taskListQuerySchema } from "@/modules/tasks/task.schema";
import type { AuthContext } from "@/types/auth";

export async function listBacklogTasksService(
  actor: AuthContext,
  projectId: string,
  rawQuery: Record<string, unknown> = {}
): Promise<{
  items: TaskSummaryDTO[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}> {
  assertPermission(actor, PERMISSIONS.TASK_READ);
  assertPermission(actor, PERMISSIONS.SPRINT_READ);
  const validProjectId = parseProjectId(projectId);

  const normalizedInput = {
    ...rawQuery,
    backlogOnly: true,
  };
  const query = parseSprintInput(
    taskListQuerySchema,
    normalizedInput,
    "Tham số tìm kiếm Product Backlog không hợp lệ."
  );

  await assertProjectReadAccess(actor, validProjectId);
  return taskRepository.findManyByProjectPaginated(validProjectId, query);
}

/**
 * Loads up to 100 backlog candidates across 50-item pages so Sprint planning UI
 * stays within the `taskListQuerySchema` `pageSize <= 50` API limit.
 */
export async function listSprintBacklogCandidatesService(
  actor: AuthContext,
  projectId: string
): Promise<{
  items: TaskSummaryDTO[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}> {
  const firstPage = await listBacklogTasksService(actor, projectId, {
    page: 1,
    pageSize: 50,
  });

  if (firstPage.totalPages <= 1) {
    return firstPage;
  }

  const secondPage = await listBacklogTasksService(actor, projectId, {
    page: 2,
    pageSize: 50,
  });

  return {
    ...firstPage,
    items: [...firstPage.items, ...secondPage.items],
  };
}

export async function assignTasksToSprintService(
  actor: AuthContext,
  sprintId: string,
  rawInput: unknown
): Promise<{
  sprintId: string;
  addedCount: number;
  tasks: TaskSummaryDTO[];
}> {
  assertPermission(actor, PERMISSIONS.SPRINT_MANAGE);
  const validSprintId = parseSprintId(sprintId);
  const input = parseSprintInput(
    sprintPlanningAssignSchema,
    rawInput,
    "Dữ liệu đưa Task vào Sprint không hợp lệ."
  );

  const result = await prisma.$transaction(async (tx) => {
    const initial = await assertSprintManageAccess(actor, validSprintId, tx);
    await lockProjectRowForSprintMutation(initial.project.id, tx);
    await acquireSprintPlanningLock(initial.project.id, tx);

    const liveProject = await tx.project.findUnique({
      where: { id: initial.project.id },
      select: { status: true },
    });
    if (!liveProject) {
      throw notFoundError("Không tìm thấy Project yêu cầu.");
    }
    assertProjectNotArchivedForSprintMutation(liveProject.status);

    const sprint = await loadSprintRecordOrThrow(validSprintId, tx);
    if (sprint.status !== SprintStatus.PLANNED && sprint.status !== SprintStatus.ACTIVE) {
      throw conflictError(
        "SPRINT_NOT_PLANNING_ELIGIBLE",
        "Chỉ có thể đưa Task vào Sprint đang ở trạng thái PLANNED hoặc ACTIVE."
      );
    }

    const sortedTaskIds = [...input.taskIds].sort();
    if (
      sortedTaskIds.length > 0 &&
      typeof (tx as { $queryRaw?: unknown }).$queryRaw === "function"
    ) {
      await tx.$queryRaw`
        SELECT "id"
        FROM "Task"
        WHERE "id" IN (${Prisma.join(sortedTaskIds.map((id) => Prisma.sql`${id}::uuid`))})
        ORDER BY "id"
        FOR UPDATE
      `;
    }

    const tasks = await tx.task.findMany({
      where: { id: { in: input.taskIds } },
      select: {
        id: true,
        projectId: true,
        sprintId: true,
        title: true,
        status: true,
        estimateHours: true,
        sprint: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (tasks.length !== input.taskIds.length) {
      const foundIds = new Set(tasks.map((task) => task.id));
      const missingIds = input.taskIds.filter((id) => !foundIds.has(id));
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Không tìm thấy một hoặc nhiều Task được chọn.",
        details: missingIds.map((id) => ({
          field: "taskIds",
          message: `Task ${id} không tồn tại.`,
        })),
      });
    }

    const wrongProjectTasks = tasks.filter((task) => task.projectId !== sprint.projectId);
    if (wrongProjectTasks.length > 0) {
      throw badRequestError(
        "Không thể đưa Task thuộc Project khác vào Sprint này.",
        wrongProjectTasks.map((task) => ({
          field: "taskIds",
          message: `Task "${task.title}" (${task.id}) không thuộc cùng Project.`,
        }))
      );
    }

    const completedTasks = tasks.filter((task) => task.status === TaskStatus.DONE);
    if (completedTasks.length > 0) {
      throw conflictError(
        "TASK_ALREADY_COMPLETED",
        "Không thể đưa Task đã hoàn thành (DONE) vào Sprint Planning.",
        completedTasks.map((task) => ({
          field: "taskIds",
          message: `Task "${task.title}" đã ở trạng thái DONE.`,
        }))
      );
    }

    const assignedElsewhere = tasks.filter(
      (task) => task.sprintId !== null && task.sprintId !== sprint.id
    );
    if (assignedElsewhere.length > 0) {
      throw conflictError(
        "SPRINT_TASK_ALREADY_ASSIGNED",
        "Một hoặc nhiều Task đã được gán vào Sprint khác.",
        assignedElsewhere.map((task) => ({
          field: "taskIds",
          message: `Task "${task.title}" đang thuộc Sprint "${task.sprint?.name ?? task.sprintId}".`,
        }))
      );
    }

    const eligibleTasks = tasks.filter((task) => task.sprintId === null);
    const eligibleIds = eligibleTasks.map((task) => task.id);

    if (eligibleIds.length > 0) {
      const updated = await tx.task.updateMany({
        where: {
          id: { in: eligibleIds },
          projectId: sprint.projectId,
          sprintId: null,
          status: { not: TaskStatus.DONE },
        },
        data: {
          sprintId: sprint.id,
        },
      });

      if (updated.count !== eligibleIds.length) {
        throw conflictError(
          "CONFLICT",
          "Trạng thái một số Task vừa thay đổi đồng thời. Vui lòng tải lại Product Backlog."
        );
      }

      await taskHistoryRepository.appendManyTaskHistories(
        eligibleTasks.map((task) => ({
          taskId: task.id,
          actorId: actor.userId,
          action: TaskHistoryAction.SPRINT_ASSIGNED,
          oldValue: { sprintId: null },
          newValue: { sprintId: sprint.id, sprintName: sprint.name },
          metadata: {
            source: "PLANNING",
            sprintStatus: sprint.status,
            estimateHoursSnapshot: task.estimateHours ?? null,
          },
        })),
        tx
      );

      await tx.activityLog.create({
        data: {
          userId: actor.userId,
          projectId: sprint.projectId,
          action: "SPRINT_TASKS_ASSIGNED",
          entityType: "Sprint",
          entityId: sprint.id,
          description: `Đưa ${eligibleIds.length} Task từ Backlog vào Sprint "${sprint.name}"`,
          metadata: {
            projectId: sprint.projectId,
            taskIds: eligibleIds,
            addedCount: eligibleIds.length,
          },
        },
      });
    }

    const now = new Date();
    const assignedRows = await tx.task.findMany({
      where: {
        id: { in: input.taskIds },
        projectId: sprint.projectId,
        sprintId: sprint.id,
      },
      orderBy: [{ deadline: "asc" }, { priority: "desc" }],
      select: taskSummarySelect,
    });

    return {
      sprintId: sprint.id,
      addedCount: eligibleIds.length,
      tasks: assignedRows.map((row) => mapTaskSummary(row, now)),
    };
  });

  logger.info("Tasks assigned to sprint", {
    actorId: actor.userId,
    sprintId: validSprintId,
    addedCount: result.addedCount,
  });

  return result;
}

export async function moveSprintTaskService(
  actor: AuthContext,
  sprintId: string,
  taskId: string,
  rawInput: unknown
): Promise<TaskDetailDTO> {
  assertPermission(actor, PERMISSIONS.SPRINT_MANAGE);
  const validSprintId = parseSprintId(sprintId);
  const validTaskId = parseTaskId(taskId);
  const input = parseSprintInput(
    moveSprintTaskSchema,
    rawInput,
    "Dữ liệu di chuyển Task không hợp lệ."
  );

  const detail = await prisma.$transaction(async (tx) => {
    const initial = await assertSprintManageAccess(actor, validSprintId, tx);
    await lockProjectRowForSprintMutation(initial.project.id, tx);
    await acquireSprintPlanningLock(initial.project.id, tx);

    const liveProject = await tx.project.findUnique({
      where: { id: initial.project.id },
      select: { status: true },
    });
    if (!liveProject) {
      throw notFoundError("Không tìm thấy Project yêu cầu.");
    }
    assertProjectNotArchivedForSprintMutation(liveProject.status);

    const sourceSprint = await loadSprintRecordOrThrow(validSprintId, tx);
    if (
      sourceSprint.status !== SprintStatus.PLANNED &&
      sourceSprint.status !== SprintStatus.ACTIVE
    ) {
      throw conflictError(
        "SPRINT_NOT_PLANNING_ELIGIBLE",
        "Không thể gỡ hoặc chuyển Task khỏi Sprint đã hoàn thành hoặc đã hủy."
      );
    }

    await lockSingleTaskForUpdate(validTaskId, tx);

    const task = await tx.task.findUnique({
      where: { id: validTaskId },
      select: {
        id: true,
        projectId: true,
        sprintId: true,
        title: true,
        status: true,
        estimateHours: true,
      },
    });

    if (!task) {
      throw notFoundError("Không tìm thấy Task yêu cầu.");
    }
    if (task.projectId !== sourceSprint.projectId) {
      throw badRequestError("Task không thuộc cùng Project với Sprint này.");
    }
    if (task.sprintId !== sourceSprint.id) {
      throw conflictError("CONFLICT", "Task hiện không nằm trong Sprint nguồn được chỉ định.");
    }
    if (task.status === TaskStatus.DONE) {
      throw conflictError(
        "TASK_ALREADY_COMPLETED",
        "Không thể gỡ hoặc di chuyển Task đã hoàn thành (DONE) ra khỏi Sprint."
      );
    }

    if (input.targetSprintId === null) {
      const removed = await tx.task.updateMany({
        where: {
          id: task.id,
          projectId: sourceSprint.projectId,
          sprintId: sourceSprint.id,
          status: { not: TaskStatus.DONE },
        },
        data: { sprintId: null },
      });
      if (removed.count !== 1) {
        throw conflictError("CONFLICT", "Không thể gỡ Task về Backlog do xung đột dữ liệu.");
      }

      await taskHistoryRepository.appendTaskHistory(
        {
          taskId: task.id,
          actorId: actor.userId,
          action: TaskHistoryAction.SPRINT_REMOVED,
          oldValue: { sprintId: sourceSprint.id, sprintName: sourceSprint.name },
          newValue: { sprintId: null },
          metadata: {
            source: "PLANNING",
            sprintStatus: sourceSprint.status,
            estimateHoursSnapshot: task.estimateHours ?? null,
          },
        },
        tx
      );

      await tx.activityLog.create({
        data: {
          userId: actor.userId,
          projectId: sourceSprint.projectId,
          action: "SPRINT_TASK_REMOVED",
          entityType: "Sprint",
          entityId: sourceSprint.id,
          description: `Chuyển Task "${task.title}" từ Sprint "${sourceSprint.name}" về Product Backlog`,
          metadata: {
            projectId: sourceSprint.projectId,
            taskId: task.id,
          },
        },
      });
    } else {
      if (input.targetSprintId === sourceSprint.id) {
        throw conflictError(
          "SPRINT_INVALID_DISPOSITION_TARGET",
          "Sprint đích phải khác Sprint nguồn."
        );
      }

      const targetSprint = await tx.sprint.findUnique({
        where: { id: input.targetSprintId },
        select: { id: true, projectId: true, name: true, status: true },
      });

      if (
        !targetSprint ||
        targetSprint.projectId !== sourceSprint.projectId ||
        (targetSprint.status !== SprintStatus.PLANNED &&
          targetSprint.status !== SprintStatus.ACTIVE)
      ) {
        throw conflictError(
          "SPRINT_INVALID_DISPOSITION_TARGET",
          "Sprint đích không tồn tại, khác Project hoặc không ở trạng thái PLANNED/ACTIVE."
        );
      }

      const moved = await tx.task.updateMany({
        where: {
          id: task.id,
          projectId: sourceSprint.projectId,
          sprintId: sourceSprint.id,
          status: { not: TaskStatus.DONE },
        },
        data: { sprintId: targetSprint.id },
      });
      if (moved.count !== 1) {
        throw conflictError("CONFLICT", "Không thể chuyển Task sang Sprint đích.");
      }

      await taskHistoryRepository.appendTaskHistory(
        {
          taskId: task.id,
          actorId: actor.userId,
          action: TaskHistoryAction.SPRINT_MOVED,
          oldValue: { sprintId: sourceSprint.id, sprintName: sourceSprint.name },
          newValue: { sprintId: targetSprint.id, sprintName: targetSprint.name },
          metadata: {
            source: "PLANNING",
            sourceSprintStatus: sourceSprint.status,
            targetSprintStatus: targetSprint.status,
            estimateHoursSnapshot: task.estimateHours ?? null,
          },
        },
        tx
      );

      await tx.activityLog.create({
        data: {
          userId: actor.userId,
          projectId: sourceSprint.projectId,
          action: "SPRINT_TASK_MOVED",
          entityType: "Sprint",
          entityId: sourceSprint.id,
          description: `Chuyển Task "${task.title}" từ Sprint "${sourceSprint.name}" sang Sprint "${targetSprint.name}"`,
          metadata: {
            projectId: sourceSprint.projectId,
            taskId: task.id,
            targetSprintId: targetSprint.id,
          },
        },
      });
    }

    const updatedDetail = await taskRepository.findDetailById(task.id, tx);
    if (!updatedDetail) {
      throw notFoundError("Không tìm thấy Task sau khi cập nhật Sprint.");
    }
    return updatedDetail;
  });

  logger.info("Sprint task moved", {
    actorId: actor.userId,
    sourceSprintId: validSprintId,
    taskId: validTaskId,
    targetSprintId: input.targetSprintId,
  });

  return detail;
}
