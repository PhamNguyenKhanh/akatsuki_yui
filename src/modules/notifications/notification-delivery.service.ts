import "server-only";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { NotificationDeliveryStatus, type NotificationType } from "@prisma/client";
import { AppError, badRequestError, conflictError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { uuidSchema } from "@/lib/validations/common";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { assertPermission } from "@/modules/authorization/policy.service";
import { buildNotificationEmailContent } from "@/modules/notifications/notification-email.templates";
import {
  MAX_EMAIL_RETRIES,
  mapNotificationDeliveryToDTO,
  notificationDeliverySelect,
  notificationRepository,
} from "@/modules/notifications/notification.repository";
import { parseNotificationInput } from "@/modules/notifications/notification.service";
import type {
  CreatedNotificationDispatchHandle,
  NotificationDeliveryDTO,
  NotificationDeliveryListResponseDTO,
} from "@/modules/notifications/notification.types";
import {
  deliveryHistoryQuerySchema,
  type DeliveryHistoryQueryInput,
} from "@/modules/notifications/notification.validation";
import { buildDeliveryIdempotencyKey, sendEmailViaResend } from "@/server/integrations/email";
import type { AuthContext } from "@/types/auth";

export const LEASE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes stale worker lease timeout
export const RESEND_IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Exponential backoff schedule for failed email attempts (DEC-040):
 * - Initial failure (retryCount = 0) -> +1 minute
 * - Retry 1 failure (retryCount = 1) -> +5 minutes
 * - Retry 2 failure (retryCount = 2) -> +15 minutes
 * - Retry 3 failure (retryCount = 3) -> null (Terminal FAILED)
 */
export function computeRetryBackoffNextAt(retryCount: number, now: Date = new Date()): Date | null {
  if (retryCount === 0) {
    return new Date(now.getTime() + 1 * 60 * 1000);
  }
  if (retryCount === 1) {
    return new Date(now.getTime() + 5 * 60 * 1000);
  }
  if (retryCount === 2) {
    return new Date(now.getTime() + 15 * 60 * 1000);
  }
  return null;
}

export function parseDeliveryId(deliveryId: string): string {
  const parsed = uuidSchema.safeParse(deliveryId);
  if (!parsed.success) {
    throw badRequestError("Delivery ID không đúng định dạng UUID.", [
      { field: "deliveryId", message: "Delivery ID không hợp lệ." },
    ]);
  }
  return parsed.data;
}

interface ClaimedDeliveryLease {
  id: string;
  notificationId: string;
  recipientEmail: string;
  status: NotificationDeliveryStatus;
  retryCount: number;
  lockToken: string;
  createdAt: Date;
  notification: {
    type: NotificationType;
    title: string;
    message: string;
    targetUrl: string | null;
    user: {
      fullName: string;
    };
  };
}

/**
 * Atomically claims a single NotificationDelivery row using `FOR UPDATE SKIP LOCKED`
 * and sets `lockedAt`, `lockToken`, `lastAttemptAt`, and increments `retryCount` when retrying.
 */
export async function claimDeliveryLeaseById(
  deliveryId: string,
  options: { isManualRetry?: boolean } = {}
): Promise<ClaimedDeliveryLease | null> {
  const lockToken = randomUUID();
  const now = new Date();
  const staleThresholdIso = new Date(now.getTime() - LEASE_TIMEOUT_MS).toISOString();

  return prisma.$transaction(async (tx) => {
    const lockedRows = await tx.$queryRaw<
      Array<{
        id: string;
        status: NotificationDeliveryStatus;
        retryCount: number;
        nextRetryAt: Date | null;
        lockedAt: Date | null;
      }>
    >`
      SELECT "id", "status", "retryCount", "nextRetryAt", "lockedAt"
      FROM "NotificationDelivery"
      WHERE "id" = ${deliveryId}::uuid
        AND ("lockedAt" IS NULL OR "lockedAt" < ${staleThresholdIso}::timestamp)
      FOR UPDATE SKIP LOCKED
    `;

    if (!lockedRows || lockedRows.length === 0) {
      return null;
    }

    const row = lockedRows[0];
    if (row.status === NotificationDeliveryStatus.SENT) {
      return null;
    }

    if (row.status === NotificationDeliveryStatus.FAILED) {
      if (row.retryCount >= MAX_EMAIL_RETRIES) {
        return null;
      }
      if (!options.isManualRetry) {
        if (!row.nextRetryAt || row.nextRetryAt.getTime() > now.getTime()) {
          return null;
        }
      }
    }

    const nextRetryCount =
      row.status === NotificationDeliveryStatus.FAILED ? row.retryCount + 1 : row.retryCount;

    const updated = await tx.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        lockedAt: now,
        lockToken,
        lastAttemptAt: now,
        retryCount: nextRetryCount,
      },
      select: {
        id: true,
        notificationId: true,
        recipientEmail: true,
        status: true,
        retryCount: true,
        createdAt: true,
        notification: {
          select: {
            type: true,
            title: true,
            message: true,
            targetUrl: true,
            user: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    });

    return {
      ...updated,
      lockToken,
    };
  });
}

/**
 * Executes a claimed delivery outside of any DB transaction, then updates the
 * row only if `lockToken` still matches (`DEC-044`).
 */
export async function executeClaimedDelivery(
  lease: ClaimedDeliveryLease
): Promise<NotificationDeliveryDTO | null> {
  const emailContent = buildNotificationEmailContent({
    type: lease.notification.type,
    recipientName: lease.notification.user.fullName,
    title: lease.notification.title,
    message: lease.notification.message,
    targetUrl: lease.notification.targetUrl,
  });

  const idempotencyKey = buildDeliveryIdempotencyKey(lease.id);

  const sendResult = await sendEmailViaResend({
    to: lease.recipientEmail,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
    idempotencyKey,
  });

  const now = new Date();

  if (sendResult.status === "SENT") {
    const updateRes = await prisma.notificationDelivery.updateMany({
      where: {
        id: lease.id,
        lockToken: lease.lockToken,
      },
      data: {
        status: NotificationDeliveryStatus.SENT,
        provider: "RESEND",
        providerMessageId: sendResult.providerMessageId ?? null,
        sentAt: now,
        nextRetryAt: null,
        lockedAt: null,
        lockToken: null,
        errorCode: null,
        errorMessage: null,
      },
    });

    if (updateRes.count === 0) {
      return null;
    }
  } else {
    const isTerminal =
      Boolean(sendResult.isPermanentFailure) || lease.retryCount >= MAX_EMAIL_RETRIES;
    const nextRetryAt = isTerminal ? null : computeRetryBackoffNextAt(lease.retryCount, now);

    const updateRes = await prisma.notificationDelivery.updateMany({
      where: {
        id: lease.id,
        lockToken: lease.lockToken,
      },
      data: {
        status: NotificationDeliveryStatus.FAILED,
        provider: "RESEND",
        failedAt: now,
        nextRetryAt,
        lockedAt: null,
        lockToken: null,
        errorCode: sendResult.errorCode ?? "DELIVERY_FAILED",
        errorMessage: sendResult.errorMessage ?? "Không thể gửi email qua Resend.",
      },
    });

    if (updateRes.count === 0) {
      return null;
    }
  }

  const finalRecord = await prisma.notificationDelivery.findUnique({
    where: { id: lease.id },
    select: notificationDeliverySelect,
  });

  return finalRecord ? mapNotificationDeliveryToDTO(finalRecord) : null;
}

export async function processSingleNotificationDelivery(
  deliveryId: string,
  options: { isManualRetry?: boolean } = {}
): Promise<NotificationDeliveryDTO | null> {
  const lease = await claimDeliveryLeaseById(deliveryId, options);
  if (!lease) {
    return null;
  }
  return executeClaimedDelivery(lease);
}

/**
 * Claims and processes due PENDING and retryable FAILED email deliveries in batch (`DEC-044`).
 */
export async function processDueEmailDeliveriesBatch(limit = 25): Promise<{
  claimedCount: number;
  sentCount: number;
  failedCount: number;
}> {
  const now = new Date();
  const nowIso = now.toISOString();
  const staleThresholdIso = new Date(now.getTime() - LEASE_TIMEOUT_MS).toISOString();

  const dueIds = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "NotificationDelivery"
    WHERE "channel" = 'EMAIL'
      AND ("lockedAt" IS NULL OR "lockedAt" < ${staleThresholdIso}::timestamp)
      AND (
        "status" = 'PENDING'
        OR (
          "status" = 'FAILED'
          AND "retryCount" < ${MAX_EMAIL_RETRIES}
          AND "nextRetryAt" IS NOT NULL
          AND "nextRetryAt" <= ${nowIso}::timestamp
        )
      )
    ORDER BY "createdAt" ASC
    LIMIT ${limit}
  `;

  let claimedCount = 0;
  let sentCount = 0;
  let failedCount = 0;

  for (const row of dueIds) {
    const result = await processSingleNotificationDelivery(row.id);
    if (!result) continue;
    claimedCount += 1;
    if (result.status === NotificationDeliveryStatus.SENT) {
      sentCount += 1;
    } else {
      failedCount += 1;
    }
  }

  return {
    claimedCount,
    sentCount,
    failedCount,
  };
}

/**
 * Schedules immediate post-commit email delivery using Next.js `after()` when inside
 * a request context, with a safe non-blocking fallback in non-request/test contexts (`DEC-044`).
 */
export function schedulePostCommitEmailDispatch(
  handles: CreatedNotificationDispatchHandle[]
): void {
  const deliveryIds = handles.map((h) => h.deliveryId).filter((id): id is string => Boolean(id));

  if (deliveryIds.length === 0) {
    return;
  }

  // Skip automatic background Resend network calls during unit tests unless explicitly invoked
  if (process.env.NODE_ENV === "test") {
    return;
  }

  const runDispatch = async () => {
    for (const deliveryId of deliveryIds) {
      try {
        await processSingleNotificationDelivery(deliveryId);
      } catch (error) {
        logger.error("Post-commit email dispatch failed", {
          deliveryId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  };

  try {
    after(runDispatch);
  } catch {
    void runDispatch();
  }
}

export async function listAdminNotificationDeliveriesService(
  actor: AuthContext,
  rawQuery: Partial<DeliveryHistoryQueryInput> = {}
): Promise<NotificationDeliveryListResponseDTO> {
  assertPermission(actor, PERMISSIONS.NOTIFICATION_DELIVERY_READ);
  const query = parseNotificationInput(
    deliveryHistoryQuerySchema,
    rawQuery,
    "Tham số truy vấn lịch sử gửi email không hợp lệ."
  );

  return notificationRepository.findDeliveriesPaginated(query);
}

export async function manualRetryNotificationDeliveryService(
  actor: AuthContext,
  deliveryId: string
): Promise<NotificationDeliveryDTO> {
  assertPermission(actor, PERMISSIONS.NOTIFICATION_DELIVERY_RETRY);
  const validDeliveryId = parseDeliveryId(deliveryId);

  const existing = await prisma.notificationDelivery.findUnique({
    where: { id: validDeliveryId },
    select: notificationDeliverySelect,
  });

  if (!existing) {
    throw new AppError({
      statusCode: 404,
      code: "DELIVERY_NOT_FOUND",
      message: "Không tìm thấy bản ghi gửi email yêu cầu.",
    });
  }

  if (existing.status === NotificationDeliveryStatus.SENT) {
    throw conflictError(
      "DELIVERY_ALREADY_SENT",
      "Email này đã được gửi thành công, không thể thử gửi lại."
    );
  }

  if (existing.status === NotificationDeliveryStatus.PENDING) {
    throw conflictError(
      "DELIVERY_STILL_PENDING",
      "Email này đang ở trạng thái chờ xử lý (PENDING)."
    );
  }

  if (existing.retryCount >= MAX_EMAIL_RETRIES) {
    throw conflictError(
      "DELIVERY_RETRY_LIMIT_EXCEEDED",
      `Bản ghi email này đã vượt quá giới hạn tối đa ${MAX_EMAIL_RETRIES} lần thử lại (DEC-040).`
    );
  }

  const now = new Date();
  const isOutsideIdempotencyWindow =
    now.getTime() - existing.createdAt.getTime() > RESEND_IDEMPOTENCY_WINDOW_MS;

  const updated = await processSingleNotificationDelivery(validDeliveryId, {
    isManualRetry: true,
  });

  if (!updated) {
    throw conflictError(
      "DELIVERY_LOCKED_OR_INELIGIBLE",
      "Bản ghi email hiện đang được tiến trình khác xử lý hoặc không đủ điều kiện thử lại."
    );
  }

  await prisma.auditLog.create({
    data: {
      actorId: actor.userId,
      action: "NOTIFICATION_DELIVERY_MANUAL_RETRY",
      entityType: "NotificationDelivery",
      entityId: validDeliveryId,
      oldValue: {
        status: existing.status,
        retryCount: existing.retryCount,
        errorCode: existing.errorCode,
      },
      newValue: {
        status: updated.status,
        retryCount: updated.retryCount,
        providerMessageId: updated.providerMessageId,
        errorCode: updated.errorCode,
        isOutsideResend24hIdempotencyWindow: isOutsideIdempotencyWindow,
      },
    },
  });

  return updated;
}
