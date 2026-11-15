import "server-only";
import { NotificationType, ProjectStatus, TaskStatus, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createNotificationsInTransaction } from "@/modules/notifications/notification.service";
import type {
  CreatedNotificationDispatchHandle,
  CreateTransactionalNotificationInput,
} from "@/modules/notifications/notification.types";

export const BUSINESS_TIMEZONE = "Asia/Ho_Chi_Minh";
export const DEADLINE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Formats a Date into `YYYY-MM-DD` in `Asia/Ho_Chi_Minh` (`DEC-039`).
 */
export function formatDateKeyInHoChiMinh(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

/**
 * Recipient-specific daily deduplication key (`DEC-039`):
 * `deadline-reminder:${taskId}:${recipientUserId}:${YYYY-MM-DD}`
 */
export function buildDeadlineReminderDedupKey(
  taskId: string,
  recipientUserId: string,
  dateKey: string
): string {
  return `deadline-reminder:${taskId}:${recipientUserId}:${dateKey}`;
}

function formatDeadlineDisplayVi(deadline: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: BUSINESS_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(deadline);
}

export interface DeadlineReminderBatchResult {
  dateKey: string;
  evaluatedTasks: number;
  createdReminders: number;
  handles: CreatedNotificationDispatchHandle[];
}

/**
 * Scans non-DONE Tasks in ACTIVE Projects whose deadline is either:
 * - Approaching within `[now, now + 24h]`, OR
 * - Recently overdue within `[now - 24h, now]`
 * and creates deduplicated `TASK_DEADLINE_REMINDER` notifications for active assignees (`DEC-039`).
 */
export async function runDeadlineReminderBatch(
  now: Date = new Date()
): Promise<DeadlineReminderBatchResult> {
  const dateKey = formatDateKeyInHoChiMinh(now);
  const windowStart = new Date(now.getTime() - DEADLINE_WINDOW_MS);
  const windowEnd = new Date(now.getTime() + DEADLINE_WINDOW_MS);

  const candidateTasks = await prisma.task.findMany({
    where: {
      status: { not: TaskStatus.DONE },
      project: {
        status: ProjectStatus.ACTIVE,
      },
      deadline: {
        gte: windowStart,
        lte: windowEnd,
      },
      assignees: {
        some: {
          removedAt: null,
          user: {
            status: UserStatus.ACTIVE,
          },
        },
      },
    },
    select: {
      id: true,
      projectId: true,
      title: true,
      status: true,
      deadline: true,
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      assignees: {
        where: {
          removedAt: null,
          user: {
            status: UserStatus.ACTIVE,
          },
        },
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (candidateTasks.length === 0) {
    return {
      dateKey,
      evaluatedTasks: 0,
      createdReminders: 0,
      handles: [],
    };
  }

  const notificationInputs: CreateTransactionalNotificationInput[] = [];

  for (const task of candidateTasks) {
    const isOverdue = task.deadline.getTime() < now.getTime();
    const formattedDeadline = formatDeadlineDisplayVi(task.deadline);
    const windowType = isOverdue ? "RECENTLY_OVERDUE" : "UPCOMING_24H";

    const title = isOverdue
      ? `Task đã quá hạn Deadline: "${task.title}"`
      : `Nhắc hạn Task sắp đến hạn (24h): "${task.title}"`;

    const message = isOverdue
      ? `Task "${task.title}" thuộc Project "${task.project.name}" đã quá hạn vào lúc ${formattedDeadline} (trạng thái hiện tại: ${task.status}). Vui lòng cập nhật tiến độ hoặc gửi Review.`
      : `Task "${task.title}" thuộc Project "${task.project.name}" sẽ đến hạn vào lúc ${formattedDeadline} (trạng thái hiện tại: ${task.status}).`;

    for (const assignee of task.assignees) {
      if (assignee.user.status !== UserStatus.ACTIVE) {
        continue;
      }

      const dedupKey = buildDeadlineReminderDedupKey(task.id, assignee.userId, dateKey);

      notificationInputs.push({
        recipientUserId: assignee.userId,
        recipientEmail: assignee.user.email,
        actorId: null,
        projectId: task.projectId,
        type: NotificationType.TASK_DEADLINE_REMINDER,
        title,
        message,
        targetUrl: `/projects/${task.projectId}/tasks/${task.id}`,
        entityType: "Task",
        entityId: task.id,
        metadata: {
          taskId: task.id,
          taskTitle: task.title,
          projectId: task.projectId,
          projectName: task.project.name,
          deadline: task.deadline.toISOString(),
          windowType,
          dateKey,
        },
        dedupKey,
        sendEmail: true,
      });
    }
  }

  const handles = await prisma.$transaction(async (tx) => {
    return createNotificationsInTransaction(tx, notificationInputs);
  });

  return {
    dateKey,
    evaluatedTasks: candidateTasks.length,
    createdReminders: handles.length,
    handles,
  };
}
