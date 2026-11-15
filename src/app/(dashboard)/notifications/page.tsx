import type { Metadata } from "next";
import { z } from "zod";
import { NotificationCenterClient } from "@/components/features/notifications/notification-center-client";
import {
  parsePositivePageParam,
  parseSafeQueryEnum,
  type RawSearchParams,
} from "@/lib/search-params";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { requirePermissionOrRedirect } from "@/modules/authorization/require-auth";
import { listUserNotificationsService } from "@/modules/notifications/notification.service";
import { notificationTypeSchema } from "@/modules/notifications/notification.validation";

export const metadata: Metadata = {
  title: "Trung tâm Thông báo",
};

const notificationStatusParamSchema = z.enum(["all", "unread", "read"]);

interface NotificationsPageProps {
  searchParams?: Promise<RawSearchParams>;
}

export default async function NotificationsPage({
  searchParams,
}: NotificationsPageProps = {}) {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.NOTIFICATION_READ);
  const resolved = (await searchParams) ?? {};

  const page = parsePositivePageParam(resolved.page, 1);
  const status = parseSafeQueryEnum(notificationStatusParamSchema, resolved.status) ?? "all";
  const type = parseSafeQueryEnum(notificationTypeSchema, resolved.type);

  const notificationList = await listUserNotificationsService(actor, {
    page,
    pageSize: 20,
    status,
    ...(type ? { type } : {}),
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Trung tâm Thông báo (Notification Center)
        </h1>
        <p className="text-sm text-muted-foreground">
          Quản lý tất cả thông báo cá nhân trong hệ thống, đánh dấu đã đọc/chưa đọc và điều hướng
          nhanh tới đối tượng liên quan.
        </p>
      </div>

      <NotificationCenterClient
        initialNotifications={notificationList.items}
        initialUnreadCount={notificationList.unreadCount}
        initialPagination={{
          page: notificationList.page,
          pageSize: notificationList.pageSize,
          totalItems: notificationList.totalItems,
          totalPages: notificationList.totalPages,
        }}
        initialFilters={{
          status,
          type: type ?? "ALL",
        }}
      />
    </div>
  );
}
