import "server-only";
import { randomUUID } from "node:crypto";
import {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationType,
  type Prisma,
} from "@prisma/client";
import { getUserNotificationsChannel, PUSHER_EVENTS } from "@/lib/pusher-channels";
import { triggerPusherEvent } from "@/lib/pusher-server";
import { getSmtpConfigFromEnv } from "@/lib/env";
import { conflictError, notFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { RATE_LIMIT_SCOPES, consumeRateLimit } from "@/lib/rate-limit";
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
import type {
  CreatedNotificationDispatchHandle,
  NotificationDeliveryDTO,
  NotificationDeliveryListResponseDTO,
  SmtpQuotaSummaryDTO,
} from "@/modules/notifications/notification.types";
import { deliveryHistoryQuerySchema } from "@/modules/notifications/notification.validation";
import { EMAIL_PROVIDER_NAME, sendEmailViaSmtp } from "@/server/integrations/email";
import type { AuthContext } from "@/types/auth";

export const LEASE_TIMEOUT_MS = 2 * 60 * 1000;
export const MAX_IMMEDIATE_DISPATCH_PER_REQUEST = 5;
export const MAX_CRON_EMAIL_BATCH = 10;
export const MAX_SMTP_CONCURRENCY = 2;

const RETRY_DELAYS_MS = [1 * 60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000] as const;

export function computeRetryBackoffNextAt(
  retryCount: number,
  fromDate: Date = new Date()
): Date | null {
  if (retryCount < 0 || retryCount >= MAX_EMAIL_RETRIES) {
    return null;
  }
  const delayMs = RETRY_DELAYS_MS[retryCount] ?? null;
  if (!delayMs) return null;
  return new Date(fromDate.getTime() + delayMs);
}

export interface ClaimedDeliveryLease {
  id: string;
  notificationId: string;
  recipientEmail: string;
  status: NotificationDeliveryStatus;
  retryCount: number;
  lockToken: string;
  createdAt: Date;
  notification: {
    type: NotificationDeliveryDTO["notification"]["type"];
    title: string;
    message: string;
    targetUrl: string | null;
    user: {
      fullName: string;
    };
  };
}

interface QuotaCheckResult {
  allowed: boolean;
  reason?: "SMTP_DAILY_QUOTA_EXCEEDED" | "SMTP_BURST_LIMIT_EXCEEDED";
  usedLast24h: number;
  dailyLimit: number;
  usedLastMinute: number;
  perMinuteLimit: number;
}

function hasRealQuotaDatabase(): boolean {
  const candidate = prisma as { $transaction?: unknown; $queryRaw?: unknown };
  return (
    typeof candidate.$transaction === "function" &&
    typeof candidate.$queryRaw === "function"
  );
}

export async function getSmtpQuotaStatus(now: Date = new Date()): Promise<SmtpQuotaSummaryDTO> {
  const config = getSmtpConfigFromEnv();
  const dailyLimit = config.dailySendLimit;

  if (process.env.NODE_ENV === "test" && !hasRealQuotaDatabase()) {
    return {
      usedLast24h: 0,
      dailyLimit,
      remainingLast24h: dailyLimit,
      isNearLimit: false,
      isQuotaExceeded: false,
    };
  }

  const windowStart24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const rows = await prisma.$queryRaw<{ cnt: number }[]>`
    SELECT COUNT(*)::int AS "cnt"
    FROM "SmtpQuotaAttempt"
    WHERE "createdAt" >= (${windowStart24h}::timestamptz AT TIME ZONE 'UTC')
  `;
  const usedLast24h = Number(rows[0]?.cnt ?? 0);
  const remainingLast24h = Math.max(0, dailyLimit - usedLast24h);

  return {
    usedLast24h,
    dailyLimit,
    remainingLast24h,
    isNearLimit: usedLast24h >= Math.floor(dailyLimit * 0.8),
    isQuotaExceeded: usedLast24h >= dailyLimit,
  };
}

/**
 * Atomically checks and reserves 1 SMTP send attempt under a PostgreSQL transaction advisory lock
 * across rolling 24h (`SMTP_DAILY_SEND_LIMIT`, default 50) and 1-minute burst (`10`) windows
 * BEFORE any network connection to the SMTP server is opened.
 */
export async function reserveSmtpQuotaSlot(
  deliveryId: string,
  now: Date = new Date()
): Promise<QuotaCheckResult> {
  const config = getSmtpConfigFromEnv();
  const dailyLimit = config.dailySendLimit;
  const perMinuteLimit = config.perMinuteLimit;

  if (process.env.NODE_ENV === "test" && !hasRealQuotaDatabase()) {
    return {
      allowed: true,
      usedLast24h: 0,
      dailyLimit,
      usedLastMinute: 0,
      perMinuteLimit,
    };
  }

  const window24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const window1m = new Date(now.getTime() - 60 * 1000);

  return prisma.$transaction(async (tx) => {
    if (typeof (tx as { $executeRaw?: unknown }).$executeRaw === "function") {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('smtp:global:quota'))`;
    }

    const counts = await tx.$queryRaw<{ day_cnt: number; min_cnt: number }[]>`
      SELECT
        COUNT(*) FILTER (WHERE "createdAt" >= (${window24h}::timestamptz AT TIME ZONE 'UTC'))::int AS "day_cnt",
        COUNT(*) FILTER (WHERE "createdAt" >= (${window1m}::timestamptz AT TIME ZONE 'UTC'))::int AS "min_cnt"
      FROM "SmtpQuotaAttempt"
      WHERE "createdAt" >= (${window24h}::timestamptz AT TIME ZONE 'UTC')
    `;

    const usedLast24h = Number(counts[0]?.day_cnt ?? 0);
    const usedLastMinute = Number(counts[0]?.min_cnt ?? 0);

    if (usedLast24h >= dailyLimit) {
      return {
        allowed: false,
        reason: "SMTP_DAILY_QUOTA_EXCEEDED",
        usedLast24h,
        dailyLimit,
        usedLastMinute,
        perMinuteLimit,
      };
    }

    if (usedLastMinute >= perMinuteLimit) {
      return {
        allowed: false,
        reason: "SMTP_BURST_LIMIT_EXCEEDED",
        usedLast24h,
        dailyLimit,
        usedLastMinute,
        perMinuteLimit,
      };
    }

    const attemptId = randomUUID();
    await tx.$executeRaw`
      INSERT INTO "SmtpQuotaAttempt" ("id", "deliveryId", "createdAt")
      VALUES (${attemptId}::uuid, ${deliveryId}::uuid, (${now}::timestamptz AT TIME ZONE 'UTC'))
    `;

    return {
      allowed: true,
      usedLast24h: usedLast24h + 1,
      dailyLimit,
      usedLastMinute: usedLastMinute + 1,
      perMinuteLimit,
    };
  });
}

export async function runWithBoundedConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function runWorker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) {
        break;
      }
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

export async function claimDeliveryLeaseById(
  deliveryId: string,
  options?: { allowFailedWithoutNextRetryAt?: boolean; allowUnknownReviewOverride?: boolean }
): Promise<ClaimedDeliveryLease | null> {
  const now = new Date();
  const staleLeaseBefore = new Date(now.getTime() - LEASE_TIMEOUT_MS);
  const lockToken = randomUUID();

  return prisma.$transaction(async (tx) => {
    const existing = await tx.notificationDelivery.findUnique({
      where: { id: deliveryId },
      select: {
        id: true,
        status: true,
        retryCount: true,
        nextRetryAt: true,
        lockedAt: true,
      },
    });

    if (!existing) {
      return null;
    }

    const leaseAvailableFilter: Prisma.NotificationDeliveryWhereInput = {
      OR: [{ lockedAt: null }, { lockedAt: { lt: staleLeaseBefore } }],
    };

    const isPending = existing.status === NotificationDeliveryStatus.PENDING;
    const isUnknownAllowed =
      existing.status === NotificationDeliveryStatus.UNKNOWN &&
      Boolean(options?.allowUnknownReviewOverride);
    const isEligibleRetry =
      existing.status === NotificationDeliveryStatus.FAILED &&
      existing.retryCount < MAX_EMAIL_RETRIES &&
      (Boolean(options?.allowFailedWithoutNextRetryAt) ||
        (existing.nextRetryAt !== null && existing.nextRetryAt <= now));

    if (!isPending && !isEligibleRetry && !isUnknownAllowed) {
      return null;
    }

    const updated = await tx.notificationDelivery.updateMany({
      where: {
        id: existing.id,
        status: existing.status,
        retryCount: existing.retryCount,
        ...leaseAvailableFilter,
      },
      data: {
        lockedAt: now,
        lockToken,
        provider: EMAIL_PROVIDER_NAME,
        ...(isEligibleRetry || isUnknownAllowed
          ? {
              retryCount: existing.retryCount + 1,
            }
          : {}),
      },
    });

    if (updated.count === 0) {
      return null;
    }

    const leaseRow = await tx.notificationDelivery.findUnique({
      where: { id: existing.id },
      select: {
        id: true,
        notificationId: true,
        recipientEmail: true,
        status: true,
        retryCount: true,
        lockToken: true,
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

    if (!leaseRow || leaseRow.lockToken !== lockToken) {
      return null;
    }

    return leaseRow as ClaimedDeliveryLease;
  });
}

export async function executeClaimedDelivery(
  lease: ClaimedDeliveryLease
): Promise<NotificationDeliveryDTO | null> {
  const now = new Date();
  const quota = await reserveSmtpQuotaSlot(lease.id, now);

  if (!quota.allowed) {
    const quotaDelayMs = quota.reason === "SMTP_BURST_LIMIT_EXCEEDED" ? 2 * 60 * 1000 : 60 * 60 * 1000;
    const deferUntil = new Date(now.getTime() + quotaDelayMs);
    const quotaMessage =
      quota.reason === "SMTP_DAILY_QUOTA_EXCEEDED"
        ? `Đã đạt giới hạn gửi email 24h (${quota.usedLast24h}/${quota.dailyLimit}). Bản ghi được giữ chờ Cron xử lý sau.`
        : `Tần suất gửi email tạm đạt ngưỡng phút (${quota.usedLastMinute}/${quota.perMinuteLimit}). Tự động chờ gửi lại.`;

    await prisma.notificationDelivery.updateMany({
      where: {
        id: lease.id,
        lockToken: lease.lockToken,
      },
      data: {
        status: NotificationDeliveryStatus.PENDING,
        provider: EMAIL_PROVIDER_NAME,
        nextRetryAt: deferUntil,
        lockedAt: null,
        lockToken: null,
        errorCode: quota.reason ?? "SMTP_QUOTA_EXCEEDED",
        errorMessage: quotaMessage,
      },
    });

    logger.warn("SMTP send deferred before connect due to DB quota guard", {
      deliveryId: lease.id,
      reason: quota.reason,
      usedLast24h: quota.usedLast24h,
      dailyLimit: quota.dailyLimit,
    });

    const deferred = await prisma.notificationDelivery.findUnique({
      where: { id: lease.id },
      select: notificationDeliverySelect,
    });
    return deferred ? mapNotificationDeliveryToDTO(deferred) : null;
  }

  const email = buildNotificationEmailContent({
    type: lease.notification.type,
    recipientName: lease.notification.user.fullName,
    title: lease.notification.title,
    message: lease.notification.message,
    targetUrl: lease.notification.targetUrl,
  });

  const sendResult = await sendEmailViaSmtp({
    to: lease.recipientEmail,
    subject: email.subject,
    html: email.html,
    text: email.text,
    deliveryId: lease.id,
  });

  if (sendResult.status === "SENT") {
    await prisma.notificationDelivery.updateMany({
      where: {
        id: lease.id,
        lockToken: lease.lockToken,
      },
      data: {
        status: NotificationDeliveryStatus.SENT,
        provider: EMAIL_PROVIDER_NAME,
        providerMessageId: sendResult.providerMessageId,
        lastAttemptAt: now,
        sentAt: now,
        nextRetryAt: null,
        lockedAt: null,
        lockToken: null,
        errorCode: null,
        errorMessage: null,
      },
    });

    logger.info("Email notification delivered via SMTP", {
      deliveryId: lease.id,
      notificationId: lease.notificationId,
      recipientEmail: lease.recipientEmail,
      providerMessageId: sendResult.providerMessageId,
    });
  } else if (sendResult.status === "UNKNOWN") {
    await prisma.notificationDelivery.updateMany({
      where: {
        id: lease.id,
        lockToken: lease.lockToken,
      },
      data: {
        status: NotificationDeliveryStatus.UNKNOWN,
        provider: EMAIL_PROVIDER_NAME,
        lastAttemptAt: now,
        failedAt: now,
        nextRetryAt: null,
        lockedAt: null,
        lockToken: null,
        errorCode: sendResult.errorCode,
        errorMessage: sendResult.errorMessage,
      },
    });

    await prisma.auditLog
      .create({
        data: {
          actorId: null,
          action: "EMAIL_DELIVERY_OUTCOME_UNKNOWN",
          entityType: "NotificationDelivery",
          entityId: lease.id,
          newValue: {
            notificationId: lease.notificationId,
            recipientEmail: lease.recipientEmail,
            status: NotificationDeliveryStatus.UNKNOWN,
            errorCode: sendResult.errorCode,
            errorMessage: sendResult.errorMessage,
          },
        },
      })
      .catch(() => undefined);

    logger.warn("Email delivery ended with UNKNOWN SMTP outcome (requires review)", {
      deliveryId: lease.id,
      notificationId: lease.notificationId,
      recipientEmail: lease.recipientEmail,
      errorCode: sendResult.errorCode,
    });
  } else {
    const nextRetryAt = sendResult.isPermanentFailure
      ? null
      : computeRetryBackoffNextAt(lease.retryCount, now);

    await prisma.notificationDelivery.updateMany({
      where: {
        id: lease.id,
        lockToken: lease.lockToken,
      },
      data: {
        status: NotificationDeliveryStatus.FAILED,
        provider: EMAIL_PROVIDER_NAME,
        lastAttemptAt: now,
        failedAt: now,
        nextRetryAt,
        lockedAt: null,
        lockToken: null,
        errorCode: sendResult.errorCode,
        errorMessage: sendResult.errorMessage,
      },
    });

    logger.warn("Email delivery failed via SMTP", {
      deliveryId: lease.id,
      notificationId: lease.notificationId,
      recipientEmail: lease.recipientEmail,
      retryCount: lease.retryCount,
      isPermanentFailure: sendResult.isPermanentFailure,
      nextRetryAt: nextRetryAt ? nextRetryAt.toISOString() : null,
      errorCode: sendResult.errorCode,
    });

    if (!nextRetryAt) {
      await prisma.auditLog
        .create({
          data: {
            actorId: null,
            action: "EMAIL_DELIVERY_TERMINAL_FAILURE",
            entityType: "NotificationDelivery",
            entityId: lease.id,
            newValue: {
              notificationId: lease.notificationId,
              recipientEmail: lease.recipientEmail,
              retryCount: lease.retryCount,
              isPermanentFailure: sendResult.isPermanentFailure,
              errorCode: sendResult.errorCode,
              errorMessage: sendResult.errorMessage,
            },
          },
        })
        .catch(() => undefined);
    }
  }

  const finalRecord = await prisma.notificationDelivery.findUnique({
    where: { id: lease.id },
    select: notificationDeliverySelect,
  });

  return finalRecord ? mapNotificationDeliveryToDTO(finalRecord) : null;
}

export async function dispatchDeliveryById(
  deliveryId: string,
  options?: { allowFailedWithoutNextRetryAt?: boolean; allowUnknownReviewOverride?: boolean }
): Promise<NotificationDeliveryDTO | null> {
  const lease = await claimDeliveryLeaseById(deliveryId, options);
  if (!lease) {
    return null;
  }
  return executeClaimedDelivery(lease);
}

/**
 * Executes awaited bounded post-commit SMTP dispatch after the business transaction commits:
 * - Never executes outside an active awaited promise (`after()` removed per free-tier SMTP guarantee)
 * - Caps per-request immediate dispatch at `MAX_IMMEDIATE_DISPATCH_PER_REQUEST` (5)
 * - Limits parallel SMTP connections to `MAX_SMTP_CONCURRENCY` (2)
 * - Swallows transport exceptions so email downtime never rolls back or breaks business flows
 */
const REALTIME_NOTIFICATION_TYPES = new Set<NotificationType>([
  NotificationType.TASK_ASSIGNED,
  NotificationType.TASK_SUBMITTED_FOR_REVIEW,
  NotificationType.TASK_REVIEW_APPROVED,
  NotificationType.TASK_REVIEW_REJECTED,
  NotificationType.TASK_DEADLINE_REMINDER,
  NotificationType.ACCOUNT_REGISTERED,
  NotificationType.ACCOUNT_APPROVED,
  NotificationType.ACCOUNT_REJECTED,
]);

export async function schedulePostCommitEmailDispatch(
  handles: CreatedNotificationDispatchHandle[]
): Promise<void> {
  const realtimeHandles = handles.filter((handle) =>
    REALTIME_NOTIFICATION_TYPES.has(handle.type)
  );
  if (realtimeHandles.length > 0) {
    await Promise.allSettled(
      realtimeHandles.map((handle) =>
        triggerPusherEvent(
          getUserNotificationsChannel(handle.recipientUserId),
          PUSHER_EVENTS.NOTIFICATION_CREATED,
          {
            notificationId: handle.notificationId,
            title: handle.title ?? "Bạn có thông báo mới",
            message: handle.message ?? "",
            targetUrl: handle.targetUrl ?? null,
          }
        )
      )
    );
  }

  const deliveryIds = handles
    .map((handle) => handle.deliveryId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (deliveryIds.length === 0) {
    return;
  }

  const immediateIds = deliveryIds.slice(0, MAX_IMMEDIATE_DISPATCH_PER_REQUEST);
  const deferredCount = deliveryIds.length - immediateIds.length;
  if (deferredCount > 0) {
    logger.info("Deferring excess post-commit emails beyond per-request cap to daily Cron", {
      immediateCount: immediateIds.length,
      deferredCount,
      cap: MAX_IMMEDIATE_DISPATCH_PER_REQUEST,
    });
  }

  try {
    await runWithBoundedConcurrency(immediateIds, MAX_SMTP_CONCURRENCY, async (id) => {
      try {
        return await dispatchDeliveryById(id);
      } catch (err) {
        logger.error("Post-commit SMTP dispatch item failed", err, { deliveryId: id });
        return null;
      }
    });
  } catch (err) {
    logger.error("Post-commit SMTP dispatch batch failed", err);
  }
}

/**
 * Processes due PENDING & retryable FAILED email deliveries during daily Cron execution.
 * Strictly capped at `MAX_CRON_EMAIL_BATCH` (10) and bounded to `MAX_SMTP_CONCURRENCY` (2).
 * Never auto-retries `UNKNOWN` rows (`REQUIRES_REVIEW`).
 */
export async function processDueEmailDeliveriesBatch(limit = MAX_CRON_EMAIL_BATCH): Promise<{
  claimed: number;
  sent: number;
  failed: number;
  unknown: number;
  deferredByQuota: number;
}> {
  const safeBatchLimit = Math.max(1, Math.min(limit, MAX_CRON_EMAIL_BATCH));
  const now = new Date();
  const staleLeaseBefore = new Date(now.getTime() - LEASE_TIMEOUT_MS);

  const candidates = await prisma.notificationDelivery.findMany({
    where: {
      channel: NotificationChannel.EMAIL,
      AND: [
        {
          OR: [{ lockedAt: null }, { lockedAt: { lt: staleLeaseBefore } }],
        },
        {
          OR: [
            {
              status: NotificationDeliveryStatus.PENDING,
              OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
            },
            {
              status: NotificationDeliveryStatus.FAILED,
              retryCount: { lt: MAX_EMAIL_RETRIES },
              nextRetryAt: { not: null, lte: now },
            },
          ],
        },
      ],
    },
    select: { id: true },
    orderBy: [{ createdAt: "asc" }],
    take: safeBatchLimit,
  });

  const outcomes = await runWithBoundedConcurrency(
    candidates,
    MAX_SMTP_CONCURRENCY,
    async (candidate) => dispatchDeliveryById(candidate.id)
  );

  let claimed = 0;
  let sent = 0;
  let failed = 0;
  let unknown = 0;
  let deferredByQuota = 0;

  for (const outcome of outcomes) {
    if (!outcome) continue;
    claimed += 1;
    if (outcome.status === NotificationDeliveryStatus.SENT) {
      sent += 1;
    } else if (outcome.status === NotificationDeliveryStatus.UNKNOWN) {
      unknown += 1;
    } else if (outcome.status === NotificationDeliveryStatus.PENDING) {
      deferredByQuota += 1;
    } else if (outcome.status === NotificationDeliveryStatus.FAILED) {
      failed += 1;
    }
  }

  return { claimed, sent, failed, unknown, deferredByQuota };
}

export async function listAdminNotificationDeliveriesService(
  actor: AuthContext,
  rawQuery?: unknown
): Promise<NotificationDeliveryListResponseDTO> {
  assertPermission(actor, PERMISSIONS.NOTIFICATION_DELIVERY_READ);
  const query = deliveryHistoryQuerySchema.parse(rawQuery ?? {});
  const [pageResult, quota] = await Promise.all([
    notificationRepository.findDeliveriesPaginated(query),
    getSmtpQuotaStatus().catch(() => undefined),
  ]);

  return {
    ...pageResult,
    summary: {
      ...pageResult.summary,
      ...(quota ? { quota } : {}),
    },
  };
}

export async function manualRetryNotificationDeliveryService(
  actor: AuthContext,
  deliveryId: string,
  options?: { confirmUnknownResend?: boolean }
): Promise<NotificationDeliveryDTO> {
  assertPermission(actor, PERMISSIONS.NOTIFICATION_DELIVERY_RETRY);

  const validDeliveryId = uuidSchema.parse(deliveryId);
  await consumeRateLimit({
    scope: RATE_LIMIT_SCOPES.ADMIN_DELIVERY_RETRY_USER,
    identifier: actor.userId,
  });

  const existing = await prisma.notificationDelivery.findUnique({
    where: { id: validDeliveryId },
    select: notificationDeliverySelect,
  });

  if (!existing) {
    throw notFoundError("Không tìm thấy bản ghi gửi email thông báo.");
  }

  if (existing.status === NotificationDeliveryStatus.SENT) {
    throw conflictError(
      "DELIVERY_ALREADY_SENT",
      "Email này đã được gửi thành công (SENT), không thể gửi lại."
    );
  }

  if (existing.status === NotificationDeliveryStatus.PENDING) {
    throw conflictError(
      "DELIVERY_STILL_PENDING",
      "Email này đang ở trạng thái chờ gửi (PENDING)."
    );
  }

  if (
    existing.status === NotificationDeliveryStatus.UNKNOWN &&
    !options?.confirmUnknownResend
  ) {
    throw conflictError(
      "DELIVERY_REQUIRES_REVIEW",
      "Bản ghi gửi email đang ở trạng thái UNKNOWN (máy chủ SMTP ngắt kết nối ở pha DATA). Vui lòng xác nhận kiểm tra thủ công trước khi gửi lại để tránh trùng email."
    );
  }

  if (existing.retryCount >= MAX_EMAIL_RETRIES) {
    throw conflictError(
      "DELIVERY_RETRY_LIMIT_EXCEEDED",
      `Bản ghi đã vượt quá giới hạn tối đa ${MAX_EMAIL_RETRIES} lần thử lại.`
    );
  }

  const retried = await dispatchDeliveryById(validDeliveryId, {
    allowFailedWithoutNextRetryAt: true,
    allowUnknownReviewOverride: Boolean(options?.confirmUnknownResend),
  });

  if (!retried) {
    throw conflictError(
      "DELIVERY_LOCKED_OR_INELIGIBLE",
      "Bản ghi gửi email đang được xử lý bởi tiến trình khác hoặc không còn đủ điều kiện thử lại."
    );
  }

  await prisma.auditLog
    .create({
      data: {
        actorId: actor.userId,
        action: "EMAIL_DELIVERY_MANUAL_RETRY_TRIGGERED",
        entityType: "NotificationDelivery",
        entityId: validDeliveryId,
        oldValue: {
          status: existing.status,
          retryCount: existing.retryCount,
        },
        newValue: {
          status: retried.status,
          retryCount: retried.retryCount,
          providerMessageId: retried.providerMessageId,
          confirmedUnknownOverride: Boolean(options?.confirmUnknownResend),
        },
      },
    })
    .catch(() => undefined);

  return retried;
}

/**
 * Deletes expired `SmtpQuotaAttempt` rows older than 25 hours using a PostgreSQL CTE (`LIMIT 200`).
 */
export async function cleanupOldSmtpQuotaAttemptsBatch(limit = 200): Promise<number> {
  if (process.env.NODE_ENV === "test" && !hasRealQuotaDatabase()) {
    return 0;
  }
  const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
  const cutoff = new Date(Date.now() - 25 * 60 * 60 * 1000);
  const deleted = await prisma.$executeRaw`
    WITH expired AS (
      SELECT "id"
      FROM "SmtpQuotaAttempt"
      WHERE "createdAt" < (${cutoff}::timestamptz AT TIME ZONE 'UTC')
      LIMIT ${safeLimit}
    )
    DELETE FROM "SmtpQuotaAttempt"
    WHERE "id" IN (SELECT "id" FROM expired)
  `;
  return Number(deleted ?? 0);
}
