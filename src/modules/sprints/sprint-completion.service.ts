import "server-only";
import { SprintStatus, TaskHistoryAction, TaskStatus } from "@prisma/client";
import { AppError, badRequestError, conflictError, notFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { assertPermission } from "@/modules/authorization/policy.service";
import {
  acquireSprintPlanningLock,
  assertProjectNotArchivedForSprintMutation,
  assertSprintManageAccess,
  loadSprintRecordOrThrow,
  lockProjectRowForSprintMutation,
  lockSprintTasksForUpdate,
  parseSprintId,
  parseSprintInput,
} from "@/modules/sprints/sprint.access";
import {
  sprintRepository,
  type SprintCompletionPreviewDTO,
  type SprintDetailDTO,
} from "@/modules/sprints/sprint.repository";
import { completeSprintSchema } from "@/modules/sprints/sprint.schema";
import {
  taskHistoryRepository,
  type AppendTaskHistoryInput,
} from "@/modules/tasks/task-history.repository";
import type { AuthContext } from "@/types/auth";

export async function getSprintCompletionPreviewService(
  actor: AuthContext,
  sprintId: string
): Promise<SprintCompletionPreviewDTO> {
  assertPermission(actor, PERMISSIONS.SPRINT_MANAGE);
  const validSprintId = parseSprintId(sprintId);

  await assertSprintManageAccess(actor, validSprintId);
  const preview = await sprintRepository.findCompletionPreviewData(validSprintId);
  if (!preview) {
    throw new AppError({
      statusCode: 404,
      code: "SPRINT_NOT_FOUND",
      message: "Không tìm thấy Sprint yêu cầu.",
    });
  }

  if (preview.sprint.status !== SprintStatus.ACTIVE) {
    throw conflictError(
      "INVALID_STATUS_TRANSITION",
      "Chỉ có thể xem trước hoặc hoàn thành Sprint đang ở trạng thái ACTIVE."
    );
  }

  return preview;
}

export async function completeSprintService(
  actor: AuthContext,
  sprintId: string,
  rawInput: unknown
): Promise<SprintDetailDTO> {
  assertPermission(actor, PERMISSIONS.SPRINT_MANAGE);
  const validSprintId = parseSprintId(sprintId);
  const input = parseSprintInput(
    completeSprintSchema,
    rawInput,
    "Dữ liệu hoàn thành Sprint không hợp lệ."
  );

  const dispositionMap = new Map<
    string,
    {
      taskId: string;
      action: "MOVE_TO_BACKLOG" | "MOVE_TO_SPRINT";
      targetSprintId?: string | null;
      expectedStatus?: TaskStatus;
    }
  >();

  for (const item of input.taskDispositions) {
    if (dispositionMap.has(item.taskId)) {
      throw badRequestError("Danh sách xử lý Task chưa hoàn thành bị trùng lặp Task.", [
        {
          field: "taskDispositions",
          message: `Task ${item.taskId} xuất hiện nhiều hơn một lần.`,
        },
      ]);
    }
    dispositionMap.set(item.taskId, item);
  }

  const completed = await prisma.$transaction(async (tx) => {
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
    if (sprint.status !== SprintStatus.ACTIVE) {
      throw conflictError(
        "INVALID_STATUS_TRANSITION",
        "Chỉ có thể hoàn thành (Complete) Sprint đang ở trạng thái ACTIVE."
      );
    }

    if (
      input.expectedUpdatedAt &&
      new Date(input.expectedUpdatedAt).getTime() !== sprint.updatedAt.getTime()
    ) {
      throw conflictError(
        "CONFLICT",
        "Thông tin Sprint đã thay đổi trong lúc bạn thao tác. Vui lòng tải lại bản xem trước."
      );
    }

    // Lock every task row currently assigned to this sprint to serialize against
    // concurrent Sprint 3 workflow updates (e.g. TODO -> REVIEW -> DONE).
    await lockSprintTasksForUpdate(sprint.id, tx);

    const sprintTasks = await tx.task.findMany({
      where: { sprintId: sprint.id, projectId: sprint.projectId },
      select: { id: true, title: true, status: true },
    });

    const doneTasks = sprintTasks.filter((task) => task.status === TaskStatus.DONE);
    const unfinishedTasks = sprintTasks.filter((task) => task.status !== TaskStatus.DONE);
    const unfinishedById = new Map(unfinishedTasks.map((task) => [task.id, task]));

    const missingDispositions = unfinishedTasks.filter((task) => !dispositionMap.has(task.id));
    if (missingDispositions.length > 0) {
      throw conflictError(
        "SPRINT_UNFINISHED_TASKS_REQUIRE_DISPOSITION",
        "Phải chọn hướng xử lý (chuyển về Backlog hoặc sang Sprint khác) cho toàn bộ Task chưa hoàn thành.",
        missingDispositions.map((task) => ({
          field: "taskDispositions",
          message: `Task "${task.title}" (${task.status}) chưa có hướng xử lý.`,
        }))
      );
    }

    const staleDispositions = Array.from(dispositionMap.values()).filter(
      (item) => !unfinishedById.has(item.taskId)
    );
    if (staleDispositions.length > 0) {
      throw conflictError(
        "CONFLICT",
        "Danh sách Task chưa hoàn thành đã thay đổi (có Task vừa chuyển DONE hoặc không còn nằm trong Sprint). Vui lòng tải lại bản xem trước.",
        staleDispositions.map((item) => ({
          field: "taskDispositions",
          message: `Task ${item.taskId} không còn ở trạng thái chưa hoàn thành trong Sprint.`,
        }))
      );
    }

    const statusChangedTasks = unfinishedTasks.filter((task) => {
      const disposition = dispositionMap.get(task.id);
      return disposition?.expectedStatus && disposition.expectedStatus !== task.status;
    });
    if (statusChangedTasks.length > 0) {
      throw conflictError(
        "CONFLICT",
        "Trạng thái của một hoặc nhiều Task đã thay đổi trong lúc bạn mở modal. Vui lòng tải lại bản xem trước.",
        statusChangedTasks.map((task) => ({
          field: "taskDispositions",
          message: `Task "${task.title}" hiện đang ở trạng thái ${task.status}.`,
        }))
      );
    }

    const moveToBacklogIds: string[] = [];
    const moveToSprintGroups = new Map<string, string[]>();

    for (const task of unfinishedTasks) {
      const disposition = dispositionMap.get(task.id)!;
      if (disposition.action === "MOVE_TO_BACKLOG") {
        moveToBacklogIds.push(task.id);
      } else {
        const targetId = disposition.targetSprintId!;
        if (targetId === sprint.id) {
          throw conflictError(
            "SPRINT_INVALID_DISPOSITION_TARGET",
            "Không thể chuyển Task chưa hoàn thành vào chính Sprint đang đóng.",
            [
              {
                field: "taskDispositions",
                message: `Task "${task.title}" đang chọn Sprint đích trùng với Sprint hiện tại.`,
              },
            ]
          );
        }
        const existingGroup = moveToSprintGroups.get(targetId) ?? [];
        existingGroup.push(task.id);
        moveToSprintGroups.set(targetId, existingGroup);
      }
    }

    const targetSprintIds = Array.from(moveToSprintGroups.keys());
    const targetSprintMap = new Map<
      string,
      { id: string; projectId: string; name: string; status: SprintStatus }
    >();

    if (targetSprintIds.length > 0) {
      const targetSprints = await tx.sprint.findMany({
        where: { id: { in: targetSprintIds } },
        select: { id: true, projectId: true, name: true, status: true },
      });

      for (const target of targetSprints) {
        targetSprintMap.set(target.id, target);
      }

      for (const targetId of targetSprintIds) {
        const target = targetSprintMap.get(targetId);
        if (
          !target ||
          target.projectId !== sprint.projectId ||
          (target.status !== SprintStatus.PLANNED && target.status !== SprintStatus.ACTIVE)
        ) {
          throw conflictError(
            "SPRINT_INVALID_DISPOSITION_TARGET",
            "Một hoặc nhiều Sprint đích không tồn tại, khác Project hoặc đã hoàn thành/hủy.",
            [
              {
                field: "taskDispositions",
                message: `Sprint đích ${target?.name ?? targetId} không hợp lệ để nhận Task.`,
              },
            ]
          );
        }
      }
    }

    const historyEntries: AppendTaskHistoryInput[] = [];

    if (moveToBacklogIds.length > 0) {
      const updatedBacklog = await tx.task.updateMany({
        where: {
          id: { in: moveToBacklogIds },
          projectId: sprint.projectId,
          sprintId: sprint.id,
          status: { not: TaskStatus.DONE },
        },
        data: { sprintId: null },
      });

      if (updatedBacklog.count !== moveToBacklogIds.length) {
        throw conflictError(
          "CONFLICT",
          "Không thể hoàn tất chuyển Task về Backlog do xung đột cập nhật đồng thời."
        );
      }

      for (const taskId of moveToBacklogIds) {
        historyEntries.push({
          taskId,
          actorId: actor.userId,
          action: TaskHistoryAction.SPRINT_REMOVED,
          oldValue: { sprintId: sprint.id, sprintName: sprint.name },
          newValue: { sprintId: null },
          metadata: {
            source: "SPRINT_COMPLETION",
            completedSprintId: sprint.id,
          },
        });
      }
    }

    for (const [targetSprintId, taskIds] of moveToSprintGroups.entries()) {
      const targetSprint = targetSprintMap.get(targetSprintId)!;
      const updatedTarget = await tx.task.updateMany({
        where: {
          id: { in: taskIds },
          projectId: sprint.projectId,
          sprintId: sprint.id,
          status: { not: TaskStatus.DONE },
        },
        data: { sprintId: targetSprint.id },
      });

      if (updatedTarget.count !== taskIds.length) {
        throw conflictError(
          "CONFLICT",
          "Không thể hoàn tất chuyển Task sang Sprint đích do xung đột cập nhật đồng thời."
        );
      }

      for (const taskId of taskIds) {
        historyEntries.push({
          taskId,
          actorId: actor.userId,
          action: TaskHistoryAction.SPRINT_MOVED,
          oldValue: { sprintId: sprint.id, sprintName: sprint.name },
          newValue: { sprintId: targetSprint.id, sprintName: targetSprint.name },
          metadata: {
            source: "SPRINT_COMPLETION",
            completedSprintId: sprint.id,
          },
        });
      }
    }

    if (historyEntries.length > 0) {
      await taskHistoryRepository.appendManyTaskHistories(historyEntries, tx);
    }

    const remainingUnfinishedCount = await tx.task.count({
      where: {
        sprintId: sprint.id,
        status: { not: TaskStatus.DONE },
      },
    });

    if (remainingUnfinishedCount > 0) {
      throw conflictError(
        "SPRINT_UNFINISHED_TASKS_REQUIRE_DISPOSITION",
        "Không thể đóng Sprint khi vẫn còn Task chưa DONE trong Sprint."
      );
    }

    const now = new Date();
    const closed = await tx.sprint.updateMany({
      where: {
        id: sprint.id,
        status: SprintStatus.ACTIVE,
      },
      data: {
        status: SprintStatus.COMPLETED,
        completedAt: now,
      },
    });

    if (closed.count !== 1) {
      throw conflictError(
        "INVALID_STATUS_TRANSITION",
        "Sprint không còn ở trạng thái ACTIVE để hoàn thành."
      );
    }

    const movedToSprintCount = unfinishedTasks.length - moveToBacklogIds.length;

    await tx.activityLog.create({
      data: {
        userId: actor.userId,
        action: "SPRINT_COMPLETED",
        entityType: "Sprint",
        entityId: sprint.id,
        description: `Hoàn thành Sprint "${sprint.name}": giữ ${doneTasks.length} Task DONE, chuyển ${moveToBacklogIds.length} Task về Backlog, chuyển ${movedToSprintCount} Task sang Sprint khác`,
        metadata: {
          projectId: sprint.projectId,
          doneTasksCount: doneTasks.length,
          movedToBacklogCount: moveToBacklogIds.length,
          movedToSprintCount,
          note: input.note ?? null,
        },
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: "SPRINT_COMPLETED",
        entityType: "Sprint",
        entityId: sprint.id,
        oldValue: { status: SprintStatus.ACTIVE },
        newValue: {
          status: SprintStatus.COMPLETED,
          completedAt: now.toISOString(),
          doneTasksCount: doneTasks.length,
          movedToBacklogCount: moveToBacklogIds.length,
          movedToSprintCount,
          note: input.note ?? null,
        },
      },
    });

    const refreshed = await sprintRepository.findDetailById(sprint.id, tx);
    if (!refreshed) {
      throw new AppError({
        statusCode: 404,
        code: "SPRINT_NOT_FOUND",
        message: "Không tìm thấy Sprint sau khi hoàn thành.",
      });
    }
    return refreshed;
  });

  logger.info("Sprint completed", {
    actorId: actor.userId,
    projectId: completed.projectId,
    sprintId: completed.id,
  });

  return completed;
}
