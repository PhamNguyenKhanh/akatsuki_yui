import { NotificationDeliveryStatus, NotificationType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({
  after: vi.fn(),
}));

const { prismaMock, sendEmailViaResendMock } = vi.hoisted(() => ({
  prismaMock: {
    notificationDelivery: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
  sendEmailViaResendMock: vi.fn(),
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
    sendEmailViaResend: sendEmailViaResendMock,
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
    provider: "RESEND",
    providerMessageId: status === NotificationDeliveryStatus.SENT ? "re_msg_123" : null,
    retryCount,
    lastAttemptAt: now,
    nextRetryAt,
    lockedAt: null,
    sentAt: status === NotificationDeliveryStatus.SENT ? now : null,
    failedAt: status === NotificationDeliveryStatus.FAILED ? now : null,
    errorCode: status === NotificationDeliveryStatus.FAILED ? "rate_limit_exceeded" : null,
    errorMessage: status === NotificationDeliveryStatus.FAILED ? "Too many requests" : null,
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

describe("Sprint 5 Email Worker — executeClaimedDelivery State Machine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.notificationDelivery.updateMany.mockResolvedValue({ count: 1 });
  });

  it("sends with stable idempotencyKey and marks SENT on Resend success", async () => {
    sendEmailViaResendMock.mockResolvedValueOnce({
      status: "SENT",
      providerMessageId: "re_msg_123",
    });
    prismaMock.notificationDelivery.findUnique.mockResolvedValueOnce(
      mockFinalRecord(NotificationDeliveryStatus.SENT, 0, null)
    );

    const dto = await executeClaimedDelivery(makeLease(0));

    expect(sendEmailViaResendMock).toHaveBeenCalledTimes(1);
    expect(sendEmailViaResendMock.mock.calls[0][0]).toMatchObject({
      to: "member@akatsuki.local",
      idempotencyKey: `notification-delivery:${DELIVERY_ID}`,
    });

    const updateArgs = prismaMock.notificationDelivery.updateMany.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: DELIVERY_ID, lockToken: LOCK_TOKEN });
    expect(updateArgs.data).toMatchObject({
      status: NotificationDeliveryStatus.SENT,
      provider: "RESEND",
      providerMessageId: "re_msg_123",
      nextRetryAt: null,
      lockedAt: null,
      lockToken: null,
    });
    expect(dto?.status).toBe(NotificationDeliveryStatus.SENT);
  });

  it("schedules +1m, +5m, +15m backoff on transient failure and clears nextRetryAt at terminal retryCount = 3", async () => {
    for (const [retryCount, expectedDelayMs] of [
      [0, 1 * 60 * 1000],
      [1, 5 * 60 * 1000],
      [2, 15 * 60 * 1000],
      [3, null],
    ] as const) {
      vi.clearAllMocks();
      prismaMock.notificationDelivery.updateMany.mockResolvedValue({ count: 1 });
      sendEmailViaResendMock.mockResolvedValueOnce({
        status: "FAILED",
        errorCode: "rate_limit_exceeded",
        errorMessage: "Too many requests",
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

  it("marks immediate terminal FAILED (nextRetryAt = null) on permanent failure even at retryCount = 0", async () => {
    sendEmailViaResendMock.mockResolvedValueOnce({
      status: "FAILED",
      errorCode: "validation_error",
      errorMessage: "Invalid recipient email",
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
      errorCode: "validation_error",
    });
    expect(dto?.status).toBe(NotificationDeliveryStatus.FAILED);
  });
});
