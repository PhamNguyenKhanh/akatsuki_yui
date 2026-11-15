import { NotificationDeliveryStatus, NotificationType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { prismaMock, sendEmailViaSmtpMock } = vi.hoisted(() => ({
  prismaMock: {
    notificationDelivery: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
  sendEmailViaSmtpMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/server/integrations/email", async () => {
  const actual = await vi.importActual<typeof import("@/server/integrations/email")>(
    "@/server/integrations/email"
  );
  return {
    ...actual,
    sendEmailViaSmtp: sendEmailViaSmtpMock,
  };
});

import { executeClaimedDelivery } from "@/modules/notifications/notification-delivery.service";

const DELIVERY_ID = "55555555-5555-4555-8555-555555555555";
const NOTIFICATION_ID = "44444444-4444-4444-8444-444444444444";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const LOCK_TOKEN = "lock-token-abc";

function makeLease(retryCount: number) {
  return {
    id: DELIVERY_ID,
    notificationId: NOTIFICATION_ID,
    recipientEmail: "member@akatsuki.local",
    status: NotificationDeliveryStatus.PENDING,
    retryCount,
    lockToken: LOCK_TOKEN,
    createdAt: new Date("2026-11-15T09:00:00.000Z"),
    notification: {
      type: NotificationType.TASK_ASSIGNED,
      title: "Task mới",
      message: "Bạn được giao Task kiểm thử",
      targetUrl: "/projects/1/tasks/2",
      user: {
        fullName: "Member Test",
      },
    },
  };
}

function mockFinalRecord(
  status: NotificationDeliveryStatus,
  retryCount: number,
  nextRetryAt: Date | null
) {
  const now = new Date("2026-11-15T10:00:00.000Z");
  return {
    id: DELIVERY_ID,
    notificationId: NOTIFICATION_ID,
    channel: "EMAIL" as const,
    recipientEmail: "member@akatsuki.local",
    status,
    provider: "SMTP",
    providerMessageId:
      status === NotificationDeliveryStatus.SENT
        ? `<notification-delivery-${DELIVERY_ID}@akatsuki.local>`
        : null,
    retryCount,
    lastAttemptAt: now,
    nextRetryAt,
    lockedAt: null,
    sentAt: status === NotificationDeliveryStatus.SENT ? now : null,
    failedAt: status === NotificationDeliveryStatus.FAILED || status === NotificationDeliveryStatus.UNKNOWN ? now : null,
    errorCode:
      status === NotificationDeliveryStatus.FAILED
        ? "SMTP_421"
        : status === NotificationDeliveryStatus.UNKNOWN
          ? "SMTP_DATA_TIMEOUT"
          : null,
    errorMessage:
      status === NotificationDeliveryStatus.FAILED
        ? "421 Try again later"
        : status === NotificationDeliveryStatus.UNKNOWN
          ? "[REQUIRES_REVIEW] Socket timed out in DATA phase"
          : null,
    createdAt: now,
    updatedAt: now,
    notification: {
      id: NOTIFICATION_ID,
      userId: USER_ID,
      type: NotificationType.TASK_ASSIGNED,
      title: "Task mới",
      message: "Bạn được giao Task kiểm thử",
      targetUrl: "/projects/1/tasks/2",
      entityType: "Task",
      entityId: "66666666-6666-4666-8666-666666666666",
      createdAt: now,
      user: {
        fullName: "Member Test",
      },
    },
  };
}

describe("Sprint 5/7 SMTP Email Worker — executeClaimedDelivery State Machine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.notificationDelivery.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.auditLog.create.mockResolvedValue({});
  });

  it("sends with deliveryId correlation and marks SENT on SMTP success", async () => {
    sendEmailViaSmtpMock.mockResolvedValueOnce({
      status: "SENT",
      provider: "SMTP",
      providerMessageId: `<notification-delivery-${DELIVERY_ID}@akatsuki.local>`,
    });
    prismaMock.notificationDelivery.findUnique.mockResolvedValueOnce(
      mockFinalRecord(NotificationDeliveryStatus.SENT, 0, null)
    );

    const dto = await executeClaimedDelivery(makeLease(0));

    expect(sendEmailViaSmtpMock).toHaveBeenCalledTimes(1);
    expect(sendEmailViaSmtpMock.mock.calls[0][0]).toMatchObject({
      to: "member@akatsuki.local",
      deliveryId: DELIVERY_ID,
    });

    const updateArgs = prismaMock.notificationDelivery.updateMany.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: DELIVERY_ID, lockToken: LOCK_TOKEN });
    expect(updateArgs.data).toMatchObject({
      status: NotificationDeliveryStatus.SENT,
      provider: "SMTP",
      providerMessageId: `<notification-delivery-${DELIVERY_ID}@akatsuki.local>`,
      nextRetryAt: null,
      lockedAt: null,
      lockToken: null,
    });
    expect(dto?.status).toBe(NotificationDeliveryStatus.SENT);
  });

  it("schedules +1m, +5m, +15m backoff on transient SMTP failure and clears nextRetryAt at terminal retryCount = 3", async () => {
    for (const [retryCount, expectedDelayMs] of [
      [0, 1 * 60 * 1000],
      [1, 5 * 60 * 1000],
      [2, 15 * 60 * 1000],
      [3, null],
    ] as const) {
      vi.clearAllMocks();
      prismaMock.notificationDelivery.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.auditLog.create.mockResolvedValue({});
      sendEmailViaSmtpMock.mockResolvedValueOnce({
        status: "FAILED",
        provider: "SMTP",
        errorCode: "SMTP_421",
        errorMessage: "421 Try again later",
        isPermanentFailure: false,
      });
      prismaMock.notificationDelivery.findUnique.mockResolvedValueOnce(
        mockFinalRecord(NotificationDeliveryStatus.FAILED, retryCount, null)
      );

      await executeClaimedDelivery(makeLease(retryCount));

      const updateData = prismaMock.notificationDelivery.updateMany.mock.calls[0][0].data;
      expect(updateData.status).toBe(NotificationDeliveryStatus.FAILED);
      if (expectedDelayMs === null) {
        expect(updateData.nextRetryAt).toBeNull();
      } else {
        const failedAt = updateData.failedAt as Date;
        const nextRetryAt = updateData.nextRetryAt as Date;
        expect(nextRetryAt.getTime() - failedAt.getTime()).toBe(expectedDelayMs);
      }
    }
  });

  it("marks immediate terminal FAILED (nextRetryAt = null) on permanent SMTP failure even at retryCount = 0", async () => {
    sendEmailViaSmtpMock.mockResolvedValueOnce({
      status: "FAILED",
      provider: "SMTP",
      errorCode: "SMTP_550",
      errorMessage: "550 5.1.1 User unknown",
      isPermanentFailure: true,
    });
    prismaMock.notificationDelivery.findUnique.mockResolvedValueOnce(
      mockFinalRecord(NotificationDeliveryStatus.FAILED, 0, null)
    );

    const dto = await executeClaimedDelivery(makeLease(0));

    const updateData = prismaMock.notificationDelivery.updateMany.mock.calls[0][0].data;
    expect(updateData).toMatchObject({
      status: NotificationDeliveryStatus.FAILED,
      nextRetryAt: null,
      errorCode: "SMTP_550",
    });
    expect(dto?.status).toBe(NotificationDeliveryStatus.FAILED);
  });

  it("marks UNKNOWN (no auto-retry, sets requiresReview) and records AuditLog when post-DATA SMTP outcome is uncertain", async () => {
    sendEmailViaSmtpMock.mockResolvedValueOnce({
      status: "UNKNOWN",
      provider: "SMTP",
      errorCode: "SMTP_DATA_TIMEOUT",
      errorMessage: "[REQUIRES_REVIEW] Socket timed out in DATA phase",
    });
    prismaMock.notificationDelivery.findUnique.mockResolvedValueOnce(
      mockFinalRecord(NotificationDeliveryStatus.UNKNOWN, 0, null)
    );

    const dto = await executeClaimedDelivery(makeLease(0));

    const updateData = prismaMock.notificationDelivery.updateMany.mock.calls[0][0].data;
    expect(updateData).toMatchObject({
      status: NotificationDeliveryStatus.UNKNOWN,
      nextRetryAt: null,
      errorCode: "SMTP_DATA_TIMEOUT",
    });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "EMAIL_DELIVERY_OUTCOME_UNKNOWN",
          entityId: DELIVERY_ID,
        }),
      })
    );
    expect(dto?.status).toBe(NotificationDeliveryStatus.UNKNOWN);
    expect(dto?.requiresReview).toBe(true);
    expect(dto?.canManualRetry).toBe(false);
  });
});
