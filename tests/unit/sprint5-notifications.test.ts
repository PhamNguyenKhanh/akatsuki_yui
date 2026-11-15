import {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationType,
  UserStatus,
  type Prisma,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { verifyCronAuthorizationHeader } from "@/app/api/internal/notifications/process/route";
import { PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import {
  buildDeadlineReminderDedupKey,
  formatDateKeyInHoChiMinh,
} from "@/modules/notifications/notification-deadline.service";
import {
  computeRetryBackoffNextAt,
  listAdminNotificationDeliveriesService,
} from "@/modules/notifications/notification-delivery.service";
import {
  recordAccountRegisteredNotifications,
  recordAccountStatusDecisionNotifications,
} from "@/modules/notifications/notification-domain-events";
import { createNotificationsInTransaction } from "@/modules/notifications/notification.service";
import {
  buildDeliveryIdempotencyKey,
  classifyEmailProviderError,
} from "@/server/integrations/email";
import type { AuthContext } from "@/types/auth";

const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const USER_A_ID = "22222222-2222-4222-8222-222222222222";
const USER_B_ID = "33333333-3333-4333-8333-333333333333";
const ENTITY_ID = "44444444-4444-4444-8444-444444444444";
const DELIVERY_ID = "55555555-5555-4555-8555-555555555555";

function createTxMock(overrides?: {
  users?: Array<{ id: string; email: string; status: UserStatus }>;
}) {
  const createdNotifications: unknown[] = [];
  const createdDeliveries: unknown[] = [];

  const tx = {
    user: {
      findMany: vi.fn().mockResolvedValue(
        overrides?.users ?? [
          { id: USER_A_ID, email: "usera@akatsuki.local", status: UserStatus.ACTIVE },
          { id: USER_B_ID, email: "userb@akatsuki.local", status: UserStatus.REJECTED },
        ]
      ),
    },
    notification: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        const id = `notif-${createdNotifications.length + 1}`;
        createdNotifications.push({ id, ...data });
        return { id };
      }),
    },
    notificationDelivery: {
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        const id = `deliv-${createdDeliveries.length + 1}`;
        createdDeliveries.push({ id, ...data });
        return { id };
      }),
    },
  };

  return {
    tx: tx as unknown as Prisma.TransactionClient,
    createdNotifications,
    createdDeliveries,
  };
}

describe("Sprint 5 — Notifications, Retry Backoff, Deadline Reminder & Cron Unit Tests", () => {
  describe("Transactional Notification Persistence & Filtering (DEC-037, DEC-038, DEC-044)", () => {
    it("excludes self-notifications (recipient === actor), deduplicates batch, and skips non-ACTIVE users", async () => {
      const { tx, createdNotifications, createdDeliveries } = createTxMock();

      const handles = await createNotificationsInTransaction(tx, [
        // Self-notification -> must be excluded
        {
          recipientUserId: ACTOR_ID,
          actorId: ACTOR_ID,
          type: NotificationType.TASK_ASSIGNED,
          title: "Self task",
          message: "Should be skipped",
          entityType: "Task",
          entityId: ENTITY_ID,
        },
        // Duplicate active recipient -> should only insert once
        {
          recipientUserId: USER_A_ID,
          actorId: ACTOR_ID,
          type: NotificationType.TASK_ASSIGNED,
          title: "Assigned task",
          message: "You have been assigned",
          entityType: "Task",
          entityId: ENTITY_ID,
        },
        {
          recipientUserId: USER_A_ID,
          actorId: ACTOR_ID,
          type: NotificationType.TASK_ASSIGNED,
          title: "Assigned task",
          message: "You have been assigned",
          entityType: "Task",
          entityId: ENTITY_ID,
        },
        // Non-ACTIVE recipient without allowNonActiveRecipient -> must be skipped
        {
          recipientUserId: USER_B_ID,
          actorId: ACTOR_ID,
          type: NotificationType.TASK_ASSIGNED,
          title: "Rejected user task",
          message: "Should be skipped",
          entityType: "Task",
          entityId: ENTITY_ID,
        },
      ]);

      expect(handles).toHaveLength(1);
      expect(handles[0].recipientUserId).toBe(USER_A_ID);
      expect(createdNotifications).toHaveLength(1);
      expect(createdDeliveries).toHaveLength(1);
      expect(createdDeliveries[0]).toMatchObject({
        channel: NotificationChannel.EMAIL,
        status: NotificationDeliveryStatus.PENDING,
        recipientEmail: "usera@akatsuki.local",
      });
    });

    it("persists ACCOUNT_REJECTED Notification parent + EMAIL Delivery for rejected user, and ignores SUSPEND/ACTIVATE (DEC-038)", async () => {
      const { tx, createdNotifications, createdDeliveries } = createTxMock();

      const rejectedHandles = await recordAccountStatusDecisionNotifications(tx, {
        actorId: ACTOR_ID,
        targetUserId: USER_B_ID,
        targetUserEmail: "userb@akatsuki.local",
        targetUserFullName: "Rejected Candidate",
        action: "REJECT",
      });

      expect(rejectedHandles).toHaveLength(1);
      expect(createdNotifications).toHaveLength(1);
      expect(createdDeliveries).toHaveLength(1);
      expect(createdNotifications[0]).toMatchObject({
        type: NotificationType.ACCOUNT_REJECTED,
        userId: USER_B_ID,
        targetUrl: null,
      });

      const suspendHandles = await recordAccountStatusDecisionNotifications(tx, {
        actorId: ACTOR_ID,
        targetUserId: USER_A_ID,
        targetUserEmail: "usera@akatsuki.local",
        targetUserFullName: "Suspended User",
        action: "SUSPEND",
      });
      expect(suspendHandles).toHaveLength(0);
    });

    it("succeeds cleanly when ACCOUNT_REGISTERED finds zero active Admins (DEC-038)", async () => {
      const { tx, createdNotifications } = createTxMock({ users: [] });

      const handles = await recordAccountRegisteredNotifications(tx, {
        newUserId: USER_A_ID,
        newUserEmail: "new@akatsuki.local",
        newUserFullName: "New Member",
      });

      expect(handles).toEqual([]);
      expect(createdNotifications).toHaveLength(0);
    });
  });

  describe("Email Retry Backoff & Resend Idempotency Key (DEC-040, DEC-045)", () => {
    it("computes +1m, +5m, +15m backoff for retryCount 0..2 and null at retryCount = 3", () => {
      const base = new Date("2026-11-15T10:00:00.000Z");

      const afterInitial = computeRetryBackoffNextAt(0, base);
      expect(afterInitial?.toISOString()).toBe("2026-11-15T10:01:00.000Z");

      const afterRetry1 = computeRetryBackoffNextAt(1, base);
      expect(afterRetry1?.toISOString()).toBe("2026-11-15T10:05:00.000Z");

      const afterRetry2 = computeRetryBackoffNextAt(2, base);
      expect(afterRetry2?.toISOString()).toBe("2026-11-15T10:15:00.000Z");

      const afterRetry3 = computeRetryBackoffNextAt(3, base);
      expect(afterRetry3).toBeNull();
    });

    it("builds stable Resend idempotency key without appending attempt number and classifies errors", () => {
      expect(buildDeliveryIdempotencyKey(DELIVERY_ID)).toBe(`notification-delivery:${DELIVERY_ID}`);

      expect(classifyEmailProviderError("validation_error", 422)).toBe(true);
      expect(classifyEmailProviderError("invalid_to_address", 400)).toBe(true);
      expect(classifyEmailProviderError("rate_limit_exceeded", 429)).toBe(false);
      expect(classifyEmailProviderError("internal_server_error", 500)).toBe(false);
    });
  });

  describe("Deadline Reminder Timezone & Deduplication Key (DEC-039)", () => {
    it("formats dateKey in Asia/Ho_Chi_Minh (UTC+7) and builds recipient-specific dedupKey", () => {
      // 2026-11-15T20:30:00Z is 2026-11-16 03:30:00 in Asia/Ho_Chi_Minh (UTC+7)
      const utcInstant = new Date("2026-11-15T20:30:00.000Z");
      const dateKey = formatDateKeyInHoChiMinh(utcInstant);
      expect(dateKey).toBe("2026-11-16");

      const dedupKey = buildDeadlineReminderDedupKey(ENTITY_ID, USER_A_ID, dateKey);
      expect(dedupKey).toBe(`deadline-reminder:${ENTITY_ID}:${USER_A_ID}:2026-11-16`);
    });
  });

  describe("Cron Authorization & Delivery Monitoring Permissions (DEC-042, DEC-044)", () => {
    it("validates CRON_SECRET bearer header in constant time and rejects invalid/missing tokens", () => {
      const secret = "super-secret-cron-token-123456";
      expect(verifyCronAuthorizationHeader(`Bearer ${secret}`, secret)).toBe(true);
      expect(verifyCronAuthorizationHeader("Bearer wrong-token", secret)).toBe(false);
      expect(verifyCronAuthorizationHeader(null, secret)).toBe(false);
      expect(verifyCronAuthorizationHeader(`Bearer ${secret}`, "")).toBe(false);
    });

    it("forbids non-ADMIN actors lacking notification.delivery.read from viewing delivery history", async () => {
      const leaderWithoutDeliveryPerm: AuthContext = {
        userId: ACTOR_ID,
        email: "leader@akatsuki.local",
        fullName: "Leader",
        status: UserStatus.ACTIVE,
        roles: [ROLES.LEADER],
        permissions: [PERMISSIONS.NOTIFICATION_READ],
      };

      await expect(
        listAdminNotificationDeliveriesService(leaderWithoutDeliveryPerm, {})
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "FORBIDDEN",
      });
    });
  });
});
