import "server-only";
import { TaskHistoryAction, TaskStatus, type Prisma } from "@prisma/client";
import { acquireProjectShareLock } from "@/lib/db-locks";
import { badRequestError, conflictError, forbiddenError, notFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { assertPermission, hasPermission } from "@/modules/authorization/policy.service";
import { schedulePostCommitEmailDispatch } from "@/modules/notifications/notification-delivery.service";
import { recordTaskEventNotifications } from "@/modules/notifications/notification-domain-events";
import {
  assertProjectLeaderAccess,
  assertProjectReadAccess,
  parseProjectId,
} from "@/modules/projects/project.access";
import { validateEligibleTaskAssignees } from "@/modules/tasks/task-assignment.service";
import { emitTaskEventAfterCommit } from "@/modules/tasks/task-events";
import {
  taskHistoryRepository,
  type AppendTaskHistoryInput,
} from "@/modules/tasks/task-history.repository";
import {
  mapReferenceLinks,
  taskRepository,
  type MyAssignedTaskDTO,
  type ProjectTaskOptionDTO,
  type ProjectTaskSummaryStatsDTO,
  type TaskDetailDTO,
  type TaskSummaryDTO,
} from "@/modules/tasks/task.repository";
import {
  assertProjectNotArchivedForTaskMutation,
  assertTaskProgressOrReviewActorAccess,
  assertTaskReadAccess,
  parseTaskId,
} from "@/modules/tasks/task.access";
import {
  createTaskSchema,
  LEADER_ONLY_TASK_UPDATE_FIELDS,
  taskListQuerySchema,
  updateTaskSchema,
} from "@/modules/tasks/task.schema";
import type { AuthContext } from "@/types/auth";

function areStringArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, index) => item === b[index]);
}

function areNullableDatesEqual(a: Date | null, b: Date | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.getTime() === b.getTime();
}

export async function listProjectTasksService(
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
  const validProjectId = parseProjectId(projectId);

  const parsed = taskListQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    throw badRequestError(
      parsed.error.issues[0]?.message ?? "Tham số tìm kiếm Task không hợp lệ.",
      parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "query",
        message: issue.message,
      }))
    );
  }

  await assertProjectReadAccess(actor, validProjectId);
  return taskRepository.findManyByProjectPaginated(validProjectId, parsed.data);
}

export async function getProjectTaskStatsService(
  actor: AuthContext,
  projectId: string
): Promise<ProjectTaskSummaryStatsDTO> {
  assertPermission(actor, PERMISSIONS.TASK_READ);
  const validProjectId = parseProjectId(projectId);
  await assertProjectReadAccess(actor, validProjectId);
  return taskRepository.findProjectTaskStats(validProjectId);
}

export async function listProjectTaskOptionsService(
  actor: AuthContext,
  projectId: string,
  excludeTaskId?: string
): Promise<ProjectTaskOptionDTO[]> {
  assertPermission(actor, PERMISSIONS.TASK_READ);
  const validProjectId = parseProjectId(projectId);
  const validExcludeId = excludeTaskId ? parseTaskId(excludeTaskId) : undefined;
  await assertProjectReadAccess(actor, validProjectId);
  return taskRepository.listProjectTaskOptions(validProjectId, validExcludeId);
}

export async function listMyAssignedTasksService(
  actor: AuthContext,
  limit = 6
): Promise<MyAssignedTaskDTO[]> {
  if (!hasPermission(actor, PERMISSIONS.TASK_READ)) {
    return [];
  }
  return taskRepository.findMyAssignedTasks(actor.userId, limit);
}

export async function getTaskDetailService(
  actor: AuthContext,
  taskId: string
): Promise<TaskDetailDTO> {
  assertPermission(actor, PERMISSIONS.TASK_READ);
  const validTaskId = parseTaskId(taskId);
  await assertTaskReadAccess(actor, validTaskId);

  const detail = await taskRepository.findDetailById(validTaskId);
  if (!detail) {
    throw notFoundError("Không tìm thấy Task yêu cầu.");
  }

  return detail;
}

export async function createTaskService(
  actor: AuthContext,
  projectId: string,
  rawInput: unknown
): Promise<TaskDetailDTO> {
  assertPermission(actor, PERMISSIONS.TASK_CREATE);
  const validProjectId = parseProjectId(projectId);

  const parsed = createTaskSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequestError(
      parsed.error.issues[0]?.message ?? "Dữ liệu tạo Task không hợp lệ.",
      parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "body",
        message: issue.message,
      }))
    );
  }

  const data = parsed.data;
  if (data.assigneeIds.length > 0) {
    assertPermission(actor, PERMISSIONS.TASK_ASSIGN);
  }

  const result = await prisma.$transaction(async (tx) => {
    await acquireProjectShareLock(tx, validProjectId);
    const project = await assertProjectLeaderAccess(actor, validProjectId, tx);
    assertProjectNotArchivedForTaskMutation(project.status);

    if (data.assigneeIds.length > 0) {
      await validateEligibleTaskAssignees(
        tx,
        project.id,
        project.leaderId,
        data.assigneeIds,
        "assigneeIds"
      );
    }

    const createdTask = await tx.task.create({
      data: {
        projectId: project.id,
        createdById: actor.userId,
        title: data.title,
        description: data.description ?? null,
        priority: data.priority,
        status: TaskStatus.TODO,
        startDate: data.startDate ?? null,
        deadline: data.deadline,
        estimateHours: data.estimateHours ?? null,
        referenceLinks: data.referenceLinks,
      },
      select: { id: true, title: true },
    });

    if (data.assigneeIds.length > 0) {
      await tx.taskAssignee.createMany({
        data: data.assigneeIds.map((userId) => ({
          taskId: createdTask.id,
          userId,
          assignedById: actor.userId,
        })),
      });
    }

    await taskHistoryRepository.appendTaskHistory(
      {
        taskId: createdTask.id,
        actorId: actor.userId,
        action: TaskHistoryAction.CREATED,
        toStatus: TaskStatus.TODO,
        newValue: {
          title: data.title,
          priority: data.priority,
          startDate: data.startDate ? data.startDate.toISOString() : null,
          deadline: data.deadline.toISOString(),
          estimateHours: data.estimateHours ?? null,
          referenceLinks: data.referenceLinks,
          assigneeIds: data.assigneeIds,
        },
        metadata: {
          projectStatusAtCreation: project.status,
        },
      },
      tx
    );

    const detail = await taskRepository.findDetailById(createdTask.id, tx);
    if (!detail) {
      throw notFoundError("Không thể tải lại thông tin Task vừa tạo.");
    }

    const notificationHandles =
      data.assigneeIds.length > 0
        ? await recordTaskEventNotifications(tx, {
            type: "TASK_ASSIGNED",
            projectId: project.id,
            taskId: detail.id,
            taskTitle: detail.title,
            actorId: actor.userId,
            recipientUserIds: data.assigneeIds,
          })
        : [];

    return {
      detail,
      projectId: project.id,
      assigneeIds: data.assigneeIds,
      notificationHandles,
    };
  });

  await schedulePostCommitEmailDispatch(result.notificationHandles);

  if (result.assigneeIds.length > 0) {
    await emitTaskEventAfterCommit({
      type: "TASK_ASSIGNED",
      projectId: result.projectId,
      taskId: result.detail.id,
      taskTitle: result.detail.title,
      actorId: actor.userId,
      recipientUserIds: result.assigneeIds,
    });
  }

  return result.detail;
}

export async function updateTaskService(
  actor: AuthContext,
  taskId: string,
  rawInput: unknown
): Promise<TaskDetailDTO> {
  assertPermission(actor, PERMISSIONS.TASK_UPDATE);
  const validTaskId = parseTaskId(taskId);

  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw badRequestError("Dữ liệu cập nhật Task không hợp lệ.", [
      { field: "body", message: "Body phải là một JSON object." },
    ]);
  }

  const rawRecord = rawInput as Record<string, unknown>;

  return prisma.$transaction(async (tx) => {
    const access = await assertTaskProgressOrReviewActorAccess(actor, validTaskId, tx);
    assertProjectNotArchivedForTaskMutation(access.project.status);

    // DEC-015: Assigned Members cannot mutate Leader-only metadata fields (strict 403, never silent strip).
    if (!access.isLeaderOrAdmin) {
      for (const [key, value] of Object.entries(rawRecord)) {
        if (value !== undefined && LEADER_ONLY_TASK_UPDATE_FIELDS.has(key)) {
          throw forbiddenError(
            "Member chỉ được phép cập nhật trạng thái TODO -> IN_PROGRESS, liên kết tham chiếu và ghi chú tiến độ (DEC-015)."
          );
        }
      }
    }

    const parsed = updateTaskSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw badRequestError(
        parsed.error.issues[0]?.message ?? "Dữ liệu cập nhật Task không hợp lệ.",
        parsed.error.issues.map((issue) => ({
          field: issue.path.join(".") || "body",
          message: issue.message,
        }))
      );
    }

    const data = parsed.data;
    const task = access.task;

    if (
      data.expectedUpdatedAt !== undefined &&
      new Date(data.expectedUpdatedAt).getTime() !== task.updatedAt.getTime()
    ) {
      throw conflictError(
        "CONFLICT",
        "Task đã được cập nhật bởi thành viên khác. Vui lòng tải lại dữ liệu mới nhất."
      );
    }

    const effectiveStartDate = data.startDate !== undefined ? data.startDate : task.startDate;
    const effectiveDeadline = data.deadline !== undefined ? data.deadline : task.deadline;
    if (effectiveStartDate && effectiveDeadline.getTime() < effectiveStartDate.getTime()) {
      throw badRequestError("Deadline phải lớn hơn hoặc bằng ngày bắt đầu.", [
        { field: "deadline", message: "Deadline phải lớn hơn hoặc bằng ngày bắt đầu." },
      ]);
    }

    const isStatusChanging = data.status !== undefined && data.status !== task.status;
    if (isStatusChanging) {
      if (task.status !== TaskStatus.TODO || data.status !== TaskStatus.IN_PROGRESS) {
        if (task.status === TaskStatus.REVIEW && data.status === TaskStatus.IN_PROGRESS) {
          throw conflictError(
            "INVALID_STATUS_TRANSITION",
            "Không thể chuyển trực tiếp từ REVIEW về IN_PROGRESS; hãy sử dụng thao tác Reject Review."
          );
        }
        throw conflictError(
          "INVALID_STATUS_TRANSITION",
          `Không thể chuyển trạng thái Task từ ${task.status} sang ${data.status} qua thao tác cập nhật.`
        );
      }
    }

    const updateData: Prisma.TaskUpdateManyMutationInput = {};
    const infoOld: Record<string, unknown> = {};
    const infoNew: Record<string, unknown> = {};
    const progressOld: Record<string, unknown> = {};
    const progressNew: Record<string, unknown> = {};

    if (data.title !== undefined && data.title !== task.title) {
      updateData.title = data.title;
      infoOld.title = task.title;
      infoNew.title = data.title;
    }
    if (data.description !== undefined && data.description !== task.description) {
      updateData.description = data.description;
      infoOld.description = task.description;
      infoNew.description = data.description;
    }
    if (data.priority !== undefined && data.priority !== task.priority) {
      updateData.priority = data.priority;
      infoOld.priority = task.priority;
      infoNew.priority = data.priority;
    }
    if (data.startDate !== undefined && !areNullableDatesEqual(data.startDate, task.startDate)) {
      updateData.startDate = data.startDate;
      infoOld.startDate = task.startDate ? task.startDate.toISOString() : null;
      infoNew.startDate = data.startDate ? data.startDate.toISOString() : null;
    }
    if (data.deadline !== undefined && data.deadline.getTime() !== task.deadline.getTime()) {
      updateData.deadline = data.deadline;
      infoOld.deadline = task.deadline.toISOString();
      infoNew.deadline = data.deadline.toISOString();
    }
    if (data.estimateHours !== undefined && data.estimateHours !== task.estimateHours) {
      updateData.estimateHours = data.estimateHours;
      infoOld.estimateHours = task.estimateHours;
      infoNew.estimateHours = data.estimateHours;
    }

    const existingLinks = mapReferenceLinks(task.referenceLinks);
    if (
      data.referenceLinks !== undefined &&
      !areStringArraysEqual(data.referenceLinks, existingLinks)
    ) {
      updateData.referenceLinks = data.referenceLinks;
      progressOld.referenceLinks = existingLinks;
      progressNew.referenceLinks = data.referenceLinks;
    }

    if (data.progressNotes !== undefined && data.progressNotes !== task.progressNotes) {
      updateData.progressNotes = data.progressNotes;
      progressOld.progressNotes = task.progressNotes;
      progressNew.progressNotes = data.progressNotes;
    }

    if (isStatusChanging) {
      updateData.status = TaskStatus.IN_PROGRESS;
    }

    const hasInfoChange = Object.keys(infoNew).length > 0;
    const hasProgressChange = Object.keys(progressNew).length > 0;

    if (!hasInfoChange && !hasProgressChange && !isStatusChanging) {
      const unchanged = await taskRepository.findDetailById(task.id, tx);
      if (!unchanged) {
        throw notFoundError("Không tìm thấy Task yêu cầu.");
      }
      return unchanged;
    }

    if (isStatusChanging) {
      const updated = await tx.task.updateMany({
        where: {
          id: task.id,
          status: TaskStatus.TODO,
        },
        data: updateData,
      });

      if (updated.count === 0) {
        throw conflictError(
          "INVALID_STATUS_TRANSITION",
          "Trạng thái Task vừa bị thay đổi bởi một thao tác khác."
        );
      }
    } else {
      await tx.task.update({
        where: { id: task.id },
        data: updateData,
        select: { id: true },
      });
    }

    const historyEntries: AppendTaskHistoryInput[] = [];
    if (hasInfoChange) {
      historyEntries.push({
        taskId: task.id,
        actorId: actor.userId,
        action: TaskHistoryAction.INFO_UPDATED,
        oldValue: infoOld as Prisma.InputJsonValue,
        newValue: infoNew as Prisma.InputJsonValue,
      });
    }
    if (hasProgressChange) {
      historyEntries.push({
        taskId: task.id,
        actorId: actor.userId,
        action: TaskHistoryAction.PROGRESS_UPDATED,
        oldValue: progressOld as Prisma.InputJsonValue,
        newValue: progressNew as Prisma.InputJsonValue,
      });
    }
    if (isStatusChanging) {
      historyEntries.push({
        taskId: task.id,
        actorId: actor.userId,
        action: TaskHistoryAction.STATUS_CHANGED,
        fromStatus: TaskStatus.TODO,
        toStatus: TaskStatus.IN_PROGRESS,
      });
    }

    await taskHistoryRepository.appendManyTaskHistories(historyEntries, tx);

    const detail = await taskRepository.findDetailById(task.id, tx);
    if (!detail) {
      throw notFoundError("Không tìm thấy Task sau khi cập nhật.");
    }

    return detail;
  });
}
