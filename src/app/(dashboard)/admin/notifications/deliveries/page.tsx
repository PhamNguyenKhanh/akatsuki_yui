import type { Metadata } from "next";
import { AdminDeliveryHistoryClient } from "@/components/features/notifications/admin-delivery-history-client";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { hasPermission } from "@/modules/authorization/policy.service";
import { requirePermissionOrRedirect } from "@/modules/authorization/require-auth";
import { listAdminNotificationDeliveriesService } from "@/modules/notifications/notification-delivery.service";

export const metadata: Metadata = {
  title: "Lịch sử Gửi Email Thông báo",
};

export default async function AdminNotificationDeliveriesPage() {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.NOTIFICATION_DELIVERY_READ);
  const deliveries = await listAdminNotificationDeliveriesService(actor, { pageSize: 100 });
  const canRetry = hasPermission(actor, PERMISSIONS.NOTIFICATION_DELIVERY_RETRY);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Giám sát Gửi Email Thông báo (Delivery Monitoring)
        </h1>
        <p className="text-sm text-muted-foreground">
          Quản trị lịch sử gửi email thông báo qua máy chủ SMTP (Nodemailer), theo dõi hạn mức 24h
          và chủ động kiểm tra / gửi lại các bản ghi lỗi chưa vượt quá 3 lần thử.
        </p>
      </div>

      <AdminDeliveryHistoryClient
        initialItems={deliveries.items}
        initialSummary={deliveries.summary}
        canRetry={canRetry}
      />
    </div>
  );
}
