import "server-only";
import { ReviewDecision, TaskHistoryAction, TaskStatus, type Prisma } from "@prisma/client";
import { badRequestError, conflictError, notFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { assertPermission } from "@/modules/authorization/policy.service";
import { schedulePostCommitEmailDispatch } from "@/modules/notifications/notification-delivery.service";
import { recordTaskEventNotifications } from "@/modules/notifications/notification-domain-events";
import { emitTaskEventAfterCommit } from "@/modules/tasks/task-events";
import { taskHistoryRepository } from "@/modules/tasks/task-history.repository";
import {
  mapReferenceLinks,
  taskRepository,
  type TaskDetailDTO,
} from "@/modules/tasks/task.repository";
import {
  assertProjectNotArchivedForTaskMutation,
  assertTaskLeaderAccess,
  assertTaskProgressOrReviewActorAccess,
  parseTaskId,
} from "@/modules/tasks/task.access";
import {
  formatTaskCode,
  reviewDecisionSchema,
  submitTaskReviewSchema,
  taskStatusSchema,
} from "@/modules/tasks/task.schema";
import { updateTaskService } from "@/modules/tasks/task.service";
import type { AuthContext } from "@/types/auth";

export async function updateTaskStatusService(
  actor: AuthContext,
  taskId: string,
  rawStatus: unknown
): Promise<TaskDetailDTO> {
  const parsed = taskStatusSchema.safeParse(rawStatus);
  if (!parsed.success) {
    throw badRequestError("Trạng thái Task không hợp lệ.", [
      { field: "status", message: "Trạng thái Task không hợp lệ." },
    ]);
  }

  return updateTaskService(actor, taskId, { status: parsed.data });
}

export async function submitTaskForReviewService(
  actor: AuthContext,
  taskId: string,
  rawInput: unknown = {}
): Promise<TaskDetailDTO> {
  assertPermission(actor, PERMISSIONS.TASK_SUBMIT_REVIEW);
  const validTaskId = parseTaskId(taskId);

  const parsed = submitTaskReviewSchema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    throw badRequestError(
      parsed.error.issues[0]?.message ?? "Dữ liệu gửi Review không hợp lệ.",
      parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "body",
        message: issue.message,
      }))
    );
  }

  const data = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const access = await assertTaskProgressOrReviewActorAccess(actor, validTaskId, tx);
    assertProjectNotArchivedForTaskMutation(access.project.status);

    if (access.task.status !== TaskStatus.IN_PROGRESS) {
      throw conflictError(
        "INVALID_STATUS_TRANSITION",
        "Chỉ có thể gửi Review khi Task đang ở trạng thái IN_PROGRESS."
      );
    }

    const updateData: Prisma.TaskUpdateManyMutationInput = {
      status: TaskStatus.REVIEW,
    };

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    const existingLinks = mapReferenceLinks(access.task.referenceLinks);

    if (
      data.referenceLinks !== undefined &&
      (data.referenceLinks.length !== existingLinks.length ||
        data.referenceLinks.some((item, idx) => item !== existingLinks[idx]))
    ) {
      updateData.referenceLinks = data.referenceLinks;
      oldValue.referenceLinks = existingLinks;
      newValue.referenceLinks = data.referenceLinks;
    }

    if (data.progressNotes !== undefined && data.progressNotes !== access.task.progressNotes) {
      updateData.progressNotes = data.progressNotes;
      oldValue.progressNotes = access.task.progressNotes;
      newValue.progressNotes = data.progressNotes;
    }

    const updated = await tx.task.updateMany({
      where: {
        id: validTaskId,
        status: TaskStatus.IN_PROGRESS,
      },
      data: updateData,
    });

    if (updated.count === 0) {
      throw conflictError(
        "INVALID_STATUS_TRANSITION",
        "Trạng thái Task vừa thay đổi bởi thao tác khác, không thể gửi Review."
      );
    }

    await taskHistoryRepository.appendTaskHistory(
      {
        taskId: validTaskId,
        actorId: actor.userId,
        action: TaskHistoryAction.REVIEW_SUBMITTED,
        fromStatus: TaskStatus.IN_PROGRESS,
        toStatus: TaskStatus.REVIEW,
        reason: data.note ?? null,
        oldValue:
          Object.keys(oldValue).length > 0 ? (oldValue as Prisma.InputJsonValue) : undefined,
        newValue:
          Object.keys(newValue).length > 0 ? (newValue as Prisma.InputJsonValue) : undefined,
        metadata: {
          submitterRole: access.isLeaderOrAdmin ? "LEADER_OR_ADMIN" : "ASSIGNEE",
        },
      },
      tx
    );

    const detail = await taskRepository.findDetailById(validTaskId, tx);
    if (!detail) {
      throw notFoundError("Không tìm thấy Task sau khi gửi Review.");
    }

    const recipientUserIds =
      access.project.leaderId === actor.userId ? [] : [access.project.leaderId];

    const notificationHandles = await recordTaskEventNotifications(tx, {
      type: "TASK_SUBMITTED_FOR_REVIEW",
      projectId: access.project.id,
      taskId: detail.id,
      taskTitle: detail.title,
      actorId: actor.userId,
      recipientUserIds,
      note: data.note ?? null,
    });

    return {
      detail,
      projectId: access.project.id,
      recipientUserIds,
      notificationHandles,
    };
  });

  await schedulePostCommitEmailDispatch(result.notificationHandles);

  await emitTaskEventAfterCommit({
    type: "TASK_SUBMITTED_FOR_REVIEW",
    projectId: result.projectId,
    taskId: result.detail.id,
    taskTitle: result.detail.title,
    actorId: actor.userId,
    recipientUserIds: result.recipientUserIds,
    note: data.note ?? null,
  });

  return result.detail;
}

async function processTaskReviewDecision(
  actor: AuthContext,
  taskId: string,
  rawInput: unknown,
  decision: ReviewDecision
): Promise<TaskDetailDTO> {
  assertPermission(actor, PERMISSIONS.TASK_REVIEW);
  const validTaskId = parseTaskId(taskId);

  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw badRequestError("Dữ liệu review Task không hợp lệ.", [
      { field: "body", message: "Body phải là một JSON object." },
    ]);
  }

  const rawReason = (rawInput as Record<string, unknown>).reason;
  if (
    rawReason === undefined ||
    rawReason === null ||
    (typeof rawReason === "string" && rawReason.trim().length === 0)
  ) {
    throw conflictError(
      "REVIEW_REASON_REQUIRED",
      "Bắt buộc phải nhập lý do khi duyệt (Approve) hoặc từ chối (Reject) Task.",
      [{ field: "reason", message: "Lý do review không được để trống." }]
    );
  }

  const parsed = reviewDecisionSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequestError(
      parsed.error.issues[0]?.message ?? "Lý do review không hợp lệ.",
      parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "reason",
        message: issue.message,
      }))
    );
  }

  const trimmedReason = parsed.data.reason;
  const isApprove = decision === ReviewDecision.APPROVED;
  const nextStatus = isApprove ? TaskStatus.DONE : TaskStatus.IN_PROGRESS;
  const historyAction = isApprove
    ? TaskHistoryAction.REVIEW_APPROVED
    : TaskHistoryAction.REVIEW_REJECTED;

  const result = await prisma.$transaction(async (tx) => {
    const { task, project } = await assertTaskLeaderAccess(actor, validTaskId, tx);
    assertProjectNotArchivedForTaskMutation(project.status);

    if (task.status !== TaskStatus.REVIEW) {
      throw conflictError(
        "INVALID_STATUS_TRANSITION",
        `Chỉ có thể ${isApprove ? "duyệt (Approve)" : "từ chối (Reject)"} khi Task đang ở trạng thái REVIEW.`
      );
    }

    if (isApprove) {
      const blockingDeps = await tx.taskDependency.findMany({
        where: {
          taskId: validTaskId,
          dependsOnTask: {
            status: { not: TaskStatus.DONE },
          },
        },
        select: {
          dependsOnTask: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
      });

      if (blockingDeps.length > 0) {
        throw conflictError(
          "TASK_DEPENDENCY_NOT_COMPLETED",
          "Không thể duyệt (Approve) Task vì vẫn còn Task tiền điều kiện chưa hoàn thành (DONE).",
          blockingDeps.map((dep) => ({
            field: "dependsOnTaskId",
            taskId: dep.dependsOnTask.id,
            taskTitle: dep.dependsOnTask.title,
            taskStatus: dep.dependsOnTask.status,
            message: `${formatTaskCode(dep.dependsOnTask.id)} ${dep.dependsOnTask.title} (${dep.dependsOnTask.status})`,
          }))
        );
      }
    }

    const latestSubmission = await tx.taskHistory.findFirst({
      where: {
        taskId: validTaskId,
        action: TaskHistoryAction.REVIEW_SUBMITTED,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { actorId: true },
    });

    const submittedById = latestSubmission?.actorId ?? null;
    const now = new Date();

    const updated = await tx.task.updateMany({
      where: {
        id: validTaskId,
        status: TaskStatus.REVIEW,
      },
      data: {
        status: nextStatus,
        completedAt: isApprove ? now : null,
      },
    });

    if (updated.count === 0) {
      throw conflictError(
        "INVALID_STATUS_TRANSITION",
        "Trạng thái Task vừa thay đổi bởi thao tác khác."
      );
    }

    const createdReview = await tx.taskReview.create({
      data: {
        taskId: validTaskId,
        submittedById,
        reviewerId: actor.userId,
        decision,
        reason: trimmedReason,
        reviewedAt: now,
      },
      select: { id: true },
    });

    await taskHistoryRepository.appendTaskHistory(
      {
        taskId: validTaskId,
        actorId: actor.userId,
        action: historyAction,
        fromStatus: TaskStatus.REVIEW,
        toStatus: nextStatus,
        reason: trimmedReason,
        metadata: {
          reviewId: createdReview.id,
          decision,
          selfReview: submittedById === actor.userId,
        },
      },
      tx
    );

    const activeAssignees = await tx.taskAssignee.findMany({
      where: {
        taskId: validTaskId,
        removedAt: null,
      },
      select: { userId: true },
    });

    const detail = await taskRepository.findDetailById(validTaskId, tx);
    if (!detail) {
      throw notFoundError("Không tìm thấy Task sau khi xử lý review.");
    }

    const baseRecipients =
      activeAssignees.length > 0
        ? activeAssignees.map((assignee) => assignee.userId)
        : submittedById
          ? [submittedById]
          : [task.createdById];

    const recipientUserIds = Array.from(
      new Set(baseRecipients.filter((userId) => Boolean(userId) && userId !== actor.userId))
    );

    const notificationHandles = await recordTaskEventNotifications(tx, {
      type: isApprove ? "TASK_REVIEW_APPROVED" : "TASK_REVIEW_REJECTED",
      projectId: project.id,
      taskId: detail.id,
      taskTitle: detail.title,
      actorId: actor.userId,
      recipientUserIds,
      reason: trimmedReason,
    });

    return {
      detail,
      projectId: project.id,
      recipientUserIds,
      notificationHandles,
    };
  });

  await schedulePostCommitEmailDispatch(result.notificationHandles);

  await emitTaskEventAfterCommit({
    type: isApprove ? "TASK_REVIEW_APPROVED" : "TASK_REVIEW_REJECTED",
    projectId: result.projectId,
    taskId: result.detail.id,
    taskTitle: result.detail.title,
    actorId: actor.userId,
    recipientUserIds: result.recipientUserIds,
    reason: trimmedReason,
  });

  return result.detail;
}

export async function approveTaskReviewService(
  actor: AuthContext,
  taskId: string,
  rawInput: unknown
): Promise<TaskDetailDTO> {
  return processTaskReviewDecision(actor, taskId, rawInput, ReviewDecision.APPROVED);
}

export async function rejectTaskReviewService(
  actor: AuthContext,
  taskId: string,
  rawInput: unknown
): Promise<TaskDetailDTO> {
  return processTaskReviewDecision(actor, taskId, rawInput, ReviewDecision.REJECTED);
}
