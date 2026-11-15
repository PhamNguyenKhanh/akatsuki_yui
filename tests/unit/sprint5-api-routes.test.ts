import { NextRequest } from "next/server";
import {
  DocumentCategory,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationType,
  UserStatus,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AppError,
  badRequestError,
  conflictError,
  forbiddenError,
  unauthorizedError,
} from "@/lib/errors";
import { PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import type { AuthContext } from "@/types/auth";

vi.mock("server-only", () => ({}));

const {
  requireActiveUserMock,
  listGlobalDocumentsServiceMock,
  listProjectDocumentsServiceMock,
  createDocumentServiceMock,
  getDocumentDetailServiceMock,
  updateDocumentServiceMock,
  deleteDocumentServiceMock,
  listUserNotificationsServiceMock,
  getUserUnreadNotificationCountServiceMock,
  markNotificationReadStateServiceMock,
  markAllNotificationsReadServiceMock,
  listAdminNotificationDeliveriesServiceMock,
  manualRetryNotificationDeliveryServiceMock,
  runDeadlineReminderBatchMock,
  processDueEmailDeliveriesBatchMock,
} = vi.hoisted(() => ({
  requireActiveUserMock: vi.fn(),
  listGlobalDocumentsServiceMock: vi.fn(),
  listProjectDocumentsServiceMock: vi.fn(),
  createDocumentServiceMock: vi.fn(),
  getDocumentDetailServiceMock: vi.fn(),
  updateDocumentServiceMock: vi.fn(),
  deleteDocumentServiceMock: vi.fn(),
  listUserNotificationsServiceMock: vi.fn(),
  getUserUnreadNotificationCountServiceMock: vi.fn(),
  markNotificationReadStateServiceMock: vi.fn(),
  markAllNotificationsReadServiceMock: vi.fn(),
  listAdminNotificationDeliveriesServiceMock: vi.fn(),
  manualRetryNotificationDeliveryServiceMock: vi.fn(),
  runDeadlineReminderBatchMock: vi.fn(),
  processDueEmailDeliveriesBatchMock: vi.fn(),
}));

vi.mock("@/modules/authorization/require-auth", () => ({
  requireActiveUser: requireActiveUserMock,
}));

vi.mock("@/modules/documents/document.service", () => ({
  listGlobalDocumentsService: listGlobalDocumentsServiceMock,
  listProjectDocumentsService: listProjectDocumentsServiceMock,
  createDocumentService: createDocumentServiceMock,
  getDocumentDetailService: getDocumentDetailServiceMock,
  updateDocumentService: updateDocumentServiceMock,
  deleteDocumentService: deleteDocumentServiceMock,
}));

vi.mock("@/modules/notifications/notification.service", () => ({
  listUserNotificationsService: listUserNotificationsServiceMock,
  getUserUnreadNotificationCountService: getUserUnreadNotificationCountServiceMock,
  markNotificationReadStateService: markNotificationReadStateServiceMock,
  markAllNotificationsReadService: markAllNotificationsReadServiceMock,
}));

vi.mock("@/modules/notifications/notification-delivery.service", () => ({
  listAdminNotificationDeliveriesService: listAdminNotificationDeliveriesServiceMock,
  manualRetryNotificationDeliveryService: manualRetryNotificationDeliveryServiceMock,
  processDueEmailDeliveriesBatch: processDueEmailDeliveriesBatchMock,
}));

vi.mock("@/modules/notifications/notification-deadline.service", () => ({
  runDeadlineReminderBatch: runDeadlineReminderBatchMock,
}));

import { GET as globalDocumentsGet } from "@/app/api/v1/documents/route";
import {
  GET as projectDocumentsGet,
  POST as projectDocumentsPost,
} from "@/app/api/v1/projects/[projectId]/documents/route";
import {
  DELETE as documentDelete,
  GET as documentDetailGet,
  PATCH as documentPatch,
} from "@/app/api/v1/documents/[documentId]/route";
import { GET as notificationsGet } from "@/app/api/v1/notifications/route";
import { GET as notificationsUnreadCountGet } from "@/app/api/v1/notifications/unread-count/route";
import { PATCH as notificationReadPatch } from "@/app/api/v1/notifications/[notificationId]/read/route";
import { POST as notificationsMarkAllReadPost } from "@/app/api/v1/notifications/mark-all-read/route";
import { GET as adminDeliveriesGet } from "@/app/api/v1/admin/notifications/deliveries/route";
import { POST as adminDeliveryRetryPost } from "@/app/api/v1/admin/notifications/deliveries/[deliveryId]/retry/route";
import {
  GET as cronProcessGet,
  POST as cronProcessPost,
} from "@/app/api/internal/notifications/process/route";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const DOCUMENT_ID = "33333333-3333-4333-8333-333333333333";
const NOTIFICATION_ID = "44444444-4444-4444-8444-444444444444";
const DELIVERY_ID = "55555555-5555-4555-8555-555555555555";

const adminContext: AuthContext = {
  userId: ADMIN_ID,
  email: "admin@akatsuki.local",
  fullName: "Admin",
  status: UserStatus.ACTIVE,
  roles: [ROLES.ADMIN],
  permissions: Object.values(PERMISSIONS),
};

describe("Sprint 5 API Route Handlers Contract Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireActiveUserMock.mockResolvedValue(adminContext);
  });

  describe("Document Library REST Endpoints", () => {
    it("handles GET /api/v1/documents (401 unauth and 200 list)", async () => {
      requireActiveUserMock.mockRejectedValueOnce(unauthorizedError());
      const unauthRes = await globalDocumentsGet(
        new NextRequest("http://localhost/api/v1/documents")
      );
      expect(unauthRes.status).toBe(401);

      listGlobalDocumentsServiceMock.mockResolvedValue({
        items: [
          {
            id: DOCUMENT_ID,
            title: "SRS v1",
            category: DocumentCategory.SPECIFICATION,
            url: "https://docs.google.com/document/d/abc",
          },
        ],
        totalItems: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });

      const res = await globalDocumentsGet(
        new NextRequest("http://localhost/api/v1/documents?category=SPECIFICATION&search=SRS")
      );
      expect(res.status).toBe(200);
      expect(listGlobalDocumentsServiceMock).toHaveBeenCalledWith(adminContext, {
        category: "SPECIFICATION",
        search: "SRS",
      });
      const json = await res.json();
      expect(json.data.items).toHaveLength(1);
    });

    it("handles GET and POST /api/v1/projects/[projectId]/documents (200, 201, 400, 403, 409)", async () => {
      listProjectDocumentsServiceMock.mockResolvedValue({
        items: [],
        totalItems: 0,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
      const getRes = await projectDocumentsGet(
        new NextRequest(`http://localhost/api/v1/projects/${PROJECT_ID}/documents`),
        { params: Promise.resolve({ projectId: PROJECT_ID }) }
      );
      expect(getRes.status).toBe(200);

      createDocumentServiceMock.mockResolvedValueOnce({
        id: DOCUMENT_ID,
        title: "Design Doc",
        category: DocumentCategory.DESIGN,
        url: "https://drive.google.com/file/d/123/view",
      });
      const postRes = await projectDocumentsPost(
        new Request(`http://localhost/api/v1/projects/${PROJECT_ID}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Design Doc",
            url: "https://drive.google.com/file/d/123/view",
            category: DocumentCategory.DESIGN,
          }),
        }),
        { params: Promise.resolve({ projectId: PROJECT_ID }) }
      );
      expect(postRes.status).toBe(201);
      const postJson = await postRes.json();
      expect(postJson.data.id).toBe(DOCUMENT_ID);

      createDocumentServiceMock.mockRejectedValueOnce(
        conflictError("PROJECT_ARCHIVED", "Project đã lưu trữ.")
      );
      const archivedRes = await projectDocumentsPost(
        new Request(`http://localhost/api/v1/projects/${PROJECT_ID}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Blocked" }),
        }),
        { params: Promise.resolve({ projectId: PROJECT_ID }) }
      );
      expect(archivedRes.status).toBe(409);

      createDocumentServiceMock.mockRejectedValueOnce(
        forbiddenError("Không có quyền quản lý tài liệu.")
      );
      const forbidRes = await projectDocumentsPost(
        new Request(`http://localhost/api/v1/projects/${PROJECT_ID}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Denied" }),
        }),
        { params: Promise.resolve({ projectId: PROJECT_ID }) }
      );
      expect(forbidRes.status).toBe(403);

      const invalidJsonRes = await projectDocumentsPost(
        new Request(`http://localhost/api/v1/projects/${PROJECT_ID}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{bad-json",
        }),
        { params: Promise.resolve({ projectId: PROJECT_ID }) }
      );
      expect(invalidJsonRes.status).toBe(400);
    });

    it("handles GET, PATCH, DELETE /api/v1/documents/[documentId] (200, 404, 400)", async () => {
      getDocumentDetailServiceMock.mockResolvedValueOnce({ id: DOCUMENT_ID, title: "Spec" });
      const getRes = await documentDetailGet(
        new Request(`http://localhost/api/v1/documents/${DOCUMENT_ID}`),
        {
          params: Promise.resolve({ documentId: DOCUMENT_ID }),
        }
      );
      expect(getRes.status).toBe(200);

      getDocumentDetailServiceMock.mockRejectedValueOnce(
        new AppError({
          statusCode: 404,
          code: "DOCUMENT_NOT_FOUND",
          message: "Không tìm thấy tài liệu.",
        })
      );
      const missingRes = await documentDetailGet(
        new Request(`http://localhost/api/v1/documents/${DOCUMENT_ID}`),
        { params: Promise.resolve({ documentId: DOCUMENT_ID }) }
      );
      expect(missingRes.status).toBe(404);

      updateDocumentServiceMock.mockResolvedValueOnce({
        id: DOCUMENT_ID,
        title: "Spec v2",
      });
      const patchRes = await documentPatch(
        new Request(`http://localhost/api/v1/documents/${DOCUMENT_ID}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Spec v2" }),
        }),
        { params: Promise.resolve({ documentId: DOCUMENT_ID }) }
      );
      expect(patchRes.status).toBe(200);
      expect(updateDocumentServiceMock).toHaveBeenCalledWith(adminContext, DOCUMENT_ID, {
        title: "Spec v2",
      });

      updateDocumentServiceMock.mockRejectedValueOnce(badRequestError("URL không hợp lệ."));
      const badPatchRes = await documentPatch(
        new Request(`http://localhost/api/v1/documents/${DOCUMENT_ID}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: "http://evil.example.com" }),
        }),
        { params: Promise.resolve({ documentId: DOCUMENT_ID }) }
      );
      expect(badPatchRes.status).toBe(400);

      deleteDocumentServiceMock.mockResolvedValueOnce({
        id: DOCUMENT_ID,
        deletedAt: "2026-11-15T10:00:00.000Z",
      });
      const deleteRes = await documentDelete(
        new Request(`http://localhost/api/v1/documents/${DOCUMENT_ID}`, { method: "DELETE" }),
        { params: Promise.resolve({ documentId: DOCUMENT_ID }) }
      );
      expect(deleteRes.status).toBe(200);
      expect((await deleteRes.json()).data.deletedAt).toBeTruthy();
    });
  });

  describe("Notification Center REST Endpoints", () => {
    it("handles GET /notifications, GET /unread-count, PATCH /read (body + fallback), POST /mark-all-read", async () => {
      listUserNotificationsServiceMock.mockResolvedValue({
        items: [
          {
            id: NOTIFICATION_ID,
            type: NotificationType.TASK_ASSIGNED,
            title: "Task mới",
            isRead: false,
          },
        ],
        unreadCount: 1,
        totalItems: 1,
        page: 1,
        pageSize: 6,
        totalPages: 1,
      });

      const listRes = await notificationsGet(
        new NextRequest("http://localhost/api/v1/notifications?pageSize=6")
      );
      expect(listRes.status).toBe(200);
      expect((await listRes.json()).data.unreadCount).toBe(1);

      getUserUnreadNotificationCountServiceMock.mockResolvedValue({ unreadCount: 3 });
      const countRes = await notificationsUnreadCountGet();
      expect(countRes.status).toBe(200);
      expect((await countRes.json()).data).toEqual({ unreadCount: 3 });

      markNotificationReadStateServiceMock.mockResolvedValueOnce({
        id: NOTIFICATION_ID,
        isRead: false,
      });
      const unreadPatchRes = await notificationReadPatch(
        new Request(`http://localhost/api/v1/notifications/${NOTIFICATION_ID}/read`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isRead: false }),
        }),
        { params: Promise.resolve({ notificationId: NOTIFICATION_ID }) }
      );
      expect(unreadPatchRes.status).toBe(200);
      expect(markNotificationReadStateServiceMock).toHaveBeenCalledWith(
        adminContext,
        NOTIFICATION_ID,
        { isRead: false }
      );

      // Empty body falls back to { isRead: true }
      markNotificationReadStateServiceMock.mockResolvedValueOnce({
        id: NOTIFICATION_ID,
        isRead: true,
      });
      const emptyBodyPatchRes = await notificationReadPatch(
        new Request(`http://localhost/api/v1/notifications/${NOTIFICATION_ID}/read`, {
          method: "PATCH",
        }),
        { params: Promise.resolve({ notificationId: NOTIFICATION_ID }) }
      );
      expect(emptyBodyPatchRes.status).toBe(200);
      expect(markNotificationReadStateServiceMock).toHaveBeenLastCalledWith(
        adminContext,
        NOTIFICATION_ID,
        { isRead: true }
      );

      markNotificationReadStateServiceMock.mockRejectedValueOnce(
        new AppError({
          statusCode: 404,
          code: "NOTIFICATION_NOT_FOUND",
          message: "Không tìm thấy thông báo.",
        })
      );
      const missingNotifRes = await notificationReadPatch(
        new Request(`http://localhost/api/v1/notifications/${NOTIFICATION_ID}/read`, {
          method: "PATCH",
        }),
        { params: Promise.resolve({ notificationId: NOTIFICATION_ID }) }
      );
      expect(missingNotifRes.status).toBe(404);

      markAllNotificationsReadServiceMock.mockResolvedValue({ updatedCount: 5 });
      const markAllRes = await notificationsMarkAllReadPost();
      expect(markAllRes.status).toBe(200);
      expect((await markAllRes.json()).data).toEqual({ updatedCount: 5 });
    });
  });

  describe("Admin Delivery Monitoring & Internal Cron Endpoints", () => {
    it("handles GET /admin/notifications/deliveries and POST /retry (200, 403, 409)", async () => {
      listAdminNotificationDeliveriesServiceMock.mockResolvedValueOnce({
        items: [
          {
            id: DELIVERY_ID,
            channel: NotificationChannel.EMAIL,
            status: NotificationDeliveryStatus.FAILED,
          },
        ],
        totalItems: 1,
        summary: {
          pendingCount: 0,
          sentCount: 0,
          retryableFailedCount: 1,
          terminalFailedCount: 0,
        },
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });

      const listRes = await adminDeliveriesGet(
        new NextRequest("http://localhost/api/v1/admin/notifications/deliveries?status=FAILED")
      );
      expect(listRes.status).toBe(200);
      expect(listAdminNotificationDeliveriesServiceMock).toHaveBeenCalledWith(adminContext, {
        status: "FAILED",
      });

      listAdminNotificationDeliveriesServiceMock.mockRejectedValueOnce(
        forbiddenError("Admin only")
      );
      const forbidRes = await adminDeliveriesGet(
        new NextRequest("http://localhost/api/v1/admin/notifications/deliveries")
      );
      expect(forbidRes.status).toBe(403);

      manualRetryNotificationDeliveryServiceMock.mockResolvedValueOnce({
        id: DELIVERY_ID,
        status: NotificationDeliveryStatus.SENT,
        retryCount: 1,
      });
      const retryOkRes = await adminDeliveryRetryPost(
        new Request(`http://localhost/api/v1/admin/notifications/deliveries/${DELIVERY_ID}/retry`, {
          method: "POST",
        }),
        { params: Promise.resolve({ deliveryId: DELIVERY_ID }) }
      );
      expect(retryOkRes.status).toBe(200);
      expect((await retryOkRes.json()).data.status).toBe(NotificationDeliveryStatus.SENT);

      manualRetryNotificationDeliveryServiceMock.mockRejectedValueOnce(
        conflictError("DELIVERY_RETRY_LIMIT_EXCEEDED", "Đã vượt quá 3 lần thử.")
      );
      const retryCapRes = await adminDeliveryRetryPost(
        new Request(`http://localhost/api/v1/admin/notifications/deliveries/${DELIVERY_ID}/retry`, {
          method: "POST",
        }),
        { params: Promise.resolve({ deliveryId: DELIVERY_ID }) }
      );
      expect(retryCapRes.status).toBe(409);
      expect((await retryCapRes.json()).error.code).toBe("DELIVERY_RETRY_LIMIT_EXCEEDED");
    });

    it("guards GET & POST /api/internal/notifications/process with CRON_SECRET", async () => {
      const prevSecret = process.env.CRON_SECRET;
      process.env.CRON_SECRET = "cron-test-secret-0123456789";

      try {
        const unauthRes = await cronProcessGet(
          new Request("http://localhost/api/internal/notifications/process", {
            method: "GET",
            headers: { authorization: "Bearer wrong-secret" },
          })
        );
        expect(unauthRes.status).toBe(401);
        expect((await unauthRes.json()).error.code).toBe("CRON_UNAUTHORIZED");

        runDeadlineReminderBatchMock.mockResolvedValueOnce({
          dateKey: "2026-11-15",
          evaluatedTasks: 4,
          createdReminders: 2,
          dispatchHandles: [],
        });
        processDueEmailDeliveriesBatchMock.mockResolvedValueOnce({
          claimedCount: 3,
          sentCount: 3,
          failedCount: 0,
        });

        const cronRes = await cronProcessPost(
          new Request("http://localhost/api/internal/notifications/process", {
            method: "POST",
            headers: { authorization: "Bearer cron-test-secret-0123456789" },
          })
        );
        expect(cronRes.status).toBe(200);
        const cronJson = await cronRes.json();
        expect(cronJson.data.deadlineReminders).toEqual({
          dateKey: "2026-11-15",
          evaluatedTasks: 4,
          createdReminders: 2,
        });
        expect(cronJson.data.emailDeliveries).toEqual({
          claimedCount: 3,
          sentCount: 3,
          failedCount: 0,
        });
      } finally {
        if (prevSecret === undefined) {
          delete process.env.CRON_SECRET;
        } else {
          process.env.CRON_SECRET = prevSecret;
        }
      }
    });
  });
});
