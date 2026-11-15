import type { Metadata } from "next";
import { NotificationCenterClient } from "@/components/features/notifications/notification-center-client";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { requirePermissionOrRedirect } from "@/modules/authorization/require-auth";
import { listUserNotificationsService } from "@/modules/notifications/notification.service";

export const metadata: Metadata = {
  title: "Trung tâm Thông báo",
};

export default async function NotificationsPage() {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.NOTIFICATION_READ);
  const notificationList = await listUserNotificationsService(actor, { pageSize: 100 });

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
      />
    </div>
  );
}
