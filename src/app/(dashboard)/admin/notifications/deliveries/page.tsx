import type { Metadata } from "next";
import { z } from "zod";
import { AdminDeliveryHistoryClient } from "@/components/features/notifications/admin-delivery-history-client";
import {
  parsePositivePageParam,
  parseSafeQueryEnum,
  pickSingleSearchParam,
  type RawSearchParams,
} from "@/lib/search-params";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { hasPermission } from "@/modules/authorization/policy.service";
import { requirePermissionOrRedirect } from "@/modules/authorization/require-auth";
import { listAdminNotificationDeliveriesService } from "@/modules/notifications/notification-delivery.service";
import { notificationTypeSchema } from "@/modules/notifications/notification.validation";

export const metadata: Metadata = {
  title: "Lịch sử Gửi Email Thông báo",
};

const deliveryStatusParamSchema = z.enum([
  "ALL",
  "PENDING",
  "SENT",
  "FAILED",
  "FAILED_RETRYABLE",
  "FAILED_TERMINAL",
  "UNKNOWN",
]);

interface AdminNotificationDeliveriesPageProps {
  searchParams?: Promise<RawSearchParams>;
}

export default async function AdminNotificationDeliveriesPage({
  searchParams,
}: AdminNotificationDeliveriesPageProps = {}) {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.NOTIFICATION_DELIVERY_READ);
  const resolved = (await searchParams) ?? {};

  const page = parsePositivePageParam(resolved.page, 1);
  const status = parseSafeQueryEnum(deliveryStatusParamSchema, resolved.status) ?? "ALL";
  const type = parseSafeQueryEnum(notificationTypeSchema, resolved.type);
  const recipientEmail = pickSingleSearchParam(resolved.recipientEmail)?.slice(0, 255);

  const deliveries = await listAdminNotificationDeliveriesService(actor, {
    page,
    pageSize: 20,
    status,
    ...(type ? { type } : {}),
    ...(recipientEmail ? { recipientEmail } : {}),
  });
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
        initialPagination={{
          page: deliveries.page,
          pageSize: deliveries.pageSize,
          totalItems: deliveries.totalItems,
          totalPages: deliveries.totalPages,
        }}
        initialFilters={{
          status,
          type: type ?? "ALL",
          recipientEmail: recipientEmail ?? "",
        }}
      />
    </div>
  );
}
