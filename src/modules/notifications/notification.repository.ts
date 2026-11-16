import "server-only";
import { NotificationChannel, NotificationDeliveryStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sanitizeInternalTargetPath } from "@/lib/safe-url";
import type {
  NotificationDeliveryDTO,
  NotificationDeliveryListResponseDTO,
  NotificationDTO,
  NotificationListResponseDTO,
} from "@/modules/notifications/notification.types";
import type {
  ParsedDeliveryHistoryQuery,
  ParsedNotificationListQuery,
} from "@/modules/notifications/notification.validation";

export const MAX_EMAIL_RETRIES = 3;

export const notificationSelect = {
  id: true,
  userId: true,
  actorId: true,
  projectId: true,
  type: true,
  title: true,
  message: true,
  targetUrl: true,
  entityType: true,
  entityId: true,
  metadata: true,
  dedupKey: true,
  isRead: true,
  readAt: true,
  createdAt: true,
  actor: {
    select: {
      id: true,
      fullName: true,
      email: true,
      avatarUrl: true,
    },
  },
  project: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.NotificationSelect;

export type NotificationRecord = Prisma.NotificationGetPayload<{
  select: typeof notificationSelect;
}>;

export const notificationDeliverySelect = {
  id: true,
  notificationId: true,
  channel: true,
  recipientEmail: true,
  status: true,
  provider: true,
  providerMessageId: true,
  retryCount: true,
  lastAttemptAt: true,
  nextRetryAt: true,
  lockedAt: true,
  lockToken: true,
  sentAt: true,
  failedAt: true,
  errorCode: true,
  errorMessage: true,
  createdAt: true,
  updatedAt: true,
  notification: {
    select: {
      id: true,
      userId: true,
      type: true,
      title: true,
      message: true,
      targetUrl: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      user: {
        select: {
          fullName: true,
        },
      },
    },
  },
} satisfies Prisma.NotificationDeliverySelect;

export type NotificationDeliveryRecord = Prisma.NotificationDeliveryGetPayload<{
  select: typeof notificationDeliverySelect;
}>;

export function mapNotificationToDTO(record: NotificationRecord): NotificationDTO {
  return {
    id: record.id,
    userId: record.userId,
    actorId: record.actorId,
    projectId: record.projectId,
    type: record.type,
    title: record.title,
    message: record.message,
    targetUrl: sanitizeInternalTargetPath(record.targetUrl),
    entityType: record.entityType,
    entityId: record.entityId,
    metadata:
      record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
        ? (record.metadata as Record<string, unknown>)
        : null,
    dedupKey: record.dedupKey,
    isRead: record.isRead,
    readAt: record.readAt ? record.readAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    actor: record.actor
      ? {
          id: record.actor.id,
          fullName: record.actor.fullName,
          email: record.actor.email,
          avatarUrl: record.actor.avatarUrl,
        }
      : null,
    project: record.project
      ? {
          id: record.project.id,
          name: record.project.name,
        }
      : null,
  };
}

export function mapNotificationDeliveryToDTO(
  record: NotificationDeliveryRecord
): NotificationDeliveryDTO {
  const requiresReview = record.status === NotificationDeliveryStatus.UNKNOWN;

  const isTerminalFailure =
    record.status === NotificationDeliveryStatus.FAILED &&
    (record.retryCount >= MAX_EMAIL_RETRIES || record.nextRetryAt === null);

  const canManualRetry =
    record.status === NotificationDeliveryStatus.FAILED &&
    record.retryCount < MAX_EMAIL_RETRIES &&
    record.lockedAt === null;

  return {
    id: record.id,
    notificationId: record.notificationId,
    channel: record.channel,
    recipientEmail: record.recipientEmail,
    status: record.status,
    provider: record.provider,
    providerMessageId: record.providerMessageId,
    retryCount: record.retryCount,
    maxRetries: MAX_EMAIL_RETRIES,
    isTerminalFailure,
    requiresReview,
    canManualRetry,
    lastAttemptAt: record.lastAttemptAt ? record.lastAttemptAt.toISOString() : null,
    nextRetryAt: record.nextRetryAt ? record.nextRetryAt.toISOString() : null,
    lockedAt: record.lockedAt ? record.lockedAt.toISOString() : null,
    sentAt: record.sentAt ? record.sentAt.toISOString() : null,
    failedAt: record.failedAt ? record.failedAt.toISOString() : null,
    errorCode: record.errorCode,
    errorMessage: record.errorMessage,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    notification: {
      id: record.notification.id,
      userId: record.notification.userId,
      type: record.notification.type,
      title: record.notification.title,
      message: record.notification.message,
      targetUrl: sanitizeInternalTargetPath(record.notification.targetUrl),
      entityType: record.notification.entityType,
      entityId: record.notification.entityId,
      createdAt: record.notification.createdAt.toISOString(),
      recipientName: record.notification.user.fullName,
    },
  };
}

export const notificationRepository = {
  async findById(
    notificationId: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<NotificationRecord | null> {
    return tx.notification.findUnique({
      where: { id: notificationId },
      select: notificationSelect,
    });
  },

  async countUnreadByUser(userId: string, tx: Prisma.TransactionClient = prisma): Promise<number> {
    return tx.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  },

  async findManyByUserPaginated(
    userId: string,
    query: ParsedNotificationListQuery,
    tx: Prisma.TransactionClient = prisma
  ): Promise<NotificationListResponseDTO> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.status === "unread"
        ? { isRead: false }
        : query.status === "read"
          ? { isRead: true }
          : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
    };

    const skip = (query.page - 1) * query.pageSize;

    const [records, totalItems, unreadCount] = await Promise.all([
      tx.notification.findMany({
        where,
        select: notificationSelect,
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: query.pageSize,
      }),
      tx.notification.count({ where }),
      tx.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      items: records.map(mapNotificationToDTO),
      totalItems,
      unreadCount,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(totalItems / query.pageSize)),
    };
  },

  async findDeliveriesPaginated(
    query: ParsedDeliveryHistoryQuery,
    tx: Prisma.TransactionClient = prisma
  ): Promise<NotificationDeliveryListResponseDTO> {
    const andConditions: Prisma.NotificationDeliveryWhereInput[] = [
      { channel: NotificationChannel.EMAIL },
    ];

    if (query.status === "PENDING") {
      andConditions.push({ status: NotificationDeliveryStatus.PENDING });
    } else if (query.status === "SENT") {
      andConditions.push({ status: NotificationDeliveryStatus.SENT });
    } else if (query.status === "FAILED") {
      andConditions.push({ status: NotificationDeliveryStatus.FAILED });
    } else if (query.status === "FAILED_RETRYABLE") {
      andConditions.push({
        status: NotificationDeliveryStatus.FAILED,
        retryCount: { lt: MAX_EMAIL_RETRIES },
        nextRetryAt: { not: null },
      });
    } else if (query.status === "FAILED_TERMINAL") {
      andConditions.push({
        status: NotificationDeliveryStatus.FAILED,
        OR: [{ retryCount: { gte: MAX_EMAIL_RETRIES } }, { nextRetryAt: null }],
      });
    } else if (query.status === "UNKNOWN") {
      andConditions.push({ status: NotificationDeliveryStatus.UNKNOWN });
    }

    if (query.type) {
      andConditions.push({
        notification: {
          type: query.type,
        },
      });
    }

    if (query.recipientEmail) {
      andConditions.push({
        recipientEmail: {
          contains: query.recipientEmail,
          mode: "insensitive",
        },
      });
    }

    const where: Prisma.NotificationDeliveryWhereInput = { AND: andConditions };
    const skip = (query.page - 1) * query.pageSize;

    const [
      records,
      totalItems,
      pendingCount,
      sentCount,
      retryableFailedCount,
      terminalFailedCount,
      unknownReviewCount,
    ] = await Promise.all([
      tx.notificationDelivery.findMany({
        where,
        select: notificationDeliverySelect,
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: query.pageSize,
      }),
      tx.notificationDelivery.count({ where }),
      tx.notificationDelivery.count({
        where: { channel: NotificationChannel.EMAIL, status: NotificationDeliveryStatus.PENDING },
      }),
      tx.notificationDelivery.count({
        where: { channel: NotificationChannel.EMAIL, status: NotificationDeliveryStatus.SENT },
      }),
      tx.notificationDelivery.count({
        where: {
          channel: NotificationChannel.EMAIL,
          status: NotificationDeliveryStatus.FAILED,
          retryCount: { lt: MAX_EMAIL_RETRIES },
          nextRetryAt: { not: null },
        },
      }),
      tx.notificationDelivery.count({
        where: {
          channel: NotificationChannel.EMAIL,
          status: NotificationDeliveryStatus.FAILED,
          OR: [{ retryCount: { gte: MAX_EMAIL_RETRIES } }, { nextRetryAt: null }],
        },
      }),
      tx.notificationDelivery.count({
        where: {
          channel: NotificationChannel.EMAIL,
          status: NotificationDeliveryStatus.UNKNOWN,
        },
      }),
    ]);

    return {
      items: records.map(mapNotificationDeliveryToDTO),
      totalItems,
      summary: {
        pendingCount,
        sentCount,
        retryableFailedCount,
        terminalFailedCount,
        unknownReviewCount,
      },
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(totalItems / query.pageSize)),
    };
  },
};
