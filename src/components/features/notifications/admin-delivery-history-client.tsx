"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { NotificationDeliveryStatus, NotificationType } from "@prisma/client";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MailCheck,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { NOTIFICATION_TYPE_LABELS } from "@/components/features/notifications/notification-center-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { manualRetryNotificationDeliveryAction } from "@/modules/notifications/notification.actions";
import type {
  NotificationDeliveryDTO,
  NotificationDeliverySummaryStatsDTO,
} from "@/modules/notifications/notification.types";

function formatDateTime(isoString: string | null): string {
  if (!isoString) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoString));
}

interface AdminDeliveryHistoryClientProps {
  initialItems: NotificationDeliveryDTO[];
  initialSummary: NotificationDeliverySummaryStatsDTO;
  canRetry: boolean;
}

export function AdminDeliveryHistoryClient({
  initialItems,
  initialSummary,
  canRetry,
}: AdminDeliveryHistoryClientProps) {
  const router = useRouter();
  const [items, setItems] = React.useState<NotificationDeliveryDTO[]>(initialItems);
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [typeFilter, setTypeFilter] = React.useState<string>("ALL");
  const [emailSearch, setEmailSearch] = React.useState<string>("");
  const [retryingId, setRetryingId] = React.useState<string | null>(null);
  const [feedbackError, setFeedbackError] = React.useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = React.useState<string | null>(null);

  const filteredItems = React.useMemo(() => {
    return items.filter((item) => {
      if (statusFilter === "PENDING" && item.status !== NotificationDeliveryStatus.PENDING) {
        return false;
      }
      if (statusFilter === "SENT" && item.status !== NotificationDeliveryStatus.SENT) {
        return false;
      }
      if (statusFilter === "FAILED" && item.status !== NotificationDeliveryStatus.FAILED) {
        return false;
      }
      if (
        statusFilter === "FAILED_RETRYABLE" &&
        !(item.status === NotificationDeliveryStatus.FAILED && !item.isTerminalFailure)
      ) {
        return false;
      }
      if (
        statusFilter === "FAILED_TERMINAL" &&
        !(item.status === NotificationDeliveryStatus.FAILED && item.isTerminalFailure)
      ) {
        return false;
      }

      if (typeFilter !== "ALL" && item.notification.type !== typeFilter) {
        return false;
      }

      if (emailSearch.trim()) {
        const q = emailSearch.trim().toLowerCase();
        const matchEmail = item.recipientEmail.toLowerCase().includes(q);
        const matchName = item.notification.recipientName.toLowerCase().includes(q);
        const matchTitle = item.notification.title.toLowerCase().includes(q);
        if (!matchEmail && !matchName && !matchTitle) {
          return false;
        }
      }

      return true;
    });
  }, [items, statusFilter, typeFilter, emailSearch]);

  async function handleManualRetry(delivery: NotificationDeliveryDTO) {
    setFeedbackError(null);
    setFeedbackSuccess(null);
    setRetryingId(delivery.id);
    try {
      const res = await manualRetryNotificationDeliveryAction(delivery.id);
      if (!res.ok) {
        setFeedbackError(res.error.message);
        return;
      }
      setItems((prev) => prev.map((d) => (d.id === res.data.id ? res.data : d)));
      setFeedbackSuccess(
        res.data.status === NotificationDeliveryStatus.SENT
          ? `Đã gửi lại email tới ${res.data.recipientEmail} thành công.`
          : `Đã thực hiện thử gửi lại tới ${res.data.recipientEmail} (trạng thái hiện tại: ${res.data.status}, lần thử ${res.data.retryCount}/${res.data.maxRetries}).`
      );
      router.refresh();
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-600" />
              <span>Đang chờ (PENDING)</span>
            </CardDescription>
            <CardTitle className="text-2xl font-bold">{initialSummary.pendingCount}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Đã gửi (SENT)</span>
            </CardDescription>
            <CardTitle className="text-2xl font-bold">{initialSummary.sentCount}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <span>Lỗi tạm thời (Retryable &lt; 3)</span>
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {initialSummary.retryableFailedCount}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <XCircle className="h-4 w-4 text-rose-600" />
              <span>Lỗi kết thúc (Terminal = 3)</span>
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {initialSummary.terminalFailedCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {feedbackError && (
        <Alert variant="destructive">
          <AlertDescription>{feedbackError}</AlertDescription>
        </Alert>
      )}

      {feedbackSuccess && (
        <Alert>
          <AlertDescription>{feedbackSuccess}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MailCheck className="h-5 w-5 text-slate-700" />
            <span>Nhật ký Gửi Email qua Resend ({filteredItems.length})</span>
          </CardTitle>
          <CardDescription>
            Theo dõi trạng thái gửi email thông báo toàn hệ thống và thực hiện thử gửi lại (Manual
            Retry) tối đa 3 lần (BR-NOTIF-008 / DEC-040).
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo email người nhận, tiêu đề..."
                value={emailSearch}
                onChange={(e) => setEmailSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Lọc theo trạng thái gửi"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PENDING">PENDING (Chờ gửi)</option>
              <option value="SENT">SENT (Đã gửi)</option>
              <option value="FAILED">FAILED (Tất cả lỗi)</option>
              <option value="FAILED_RETRYABLE">FAILED (Có thể thử lại &lt; 3)</option>
              <option value="FAILED_TERMINAL">FAILED (Hết lượt thử = 3)</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Lọc theo loại sự kiện"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="ALL">Tất cả sự kiện</option>
              {(Object.keys(NOTIFICATION_TYPE_LABELS) as NotificationType[]).map((t) => (
                <option key={t} value={t}>
                  {NOTIFICATION_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {filteredItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Không tìm thấy bản ghi gửi email nào phù hợp với bộ lọc.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Người nhận</TableHead>
                    <TableHead>Loại &amp; Nội dung</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Số lần thử</TableHead>
                    <TableHead>Thời gian</TableHead>
                    <TableHead>Chi tiết lỗi</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs">
                        <div className="font-medium text-slate-900">
                          {item.notification.recipientName}
                        </div>
                        <div className="text-muted-foreground">{item.recipientEmail}</div>
                      </TableCell>

                      <TableCell className="max-w-xs space-y-1 text-xs">
                        <Badge variant="outline" className="text-[11px]">
                          {NOTIFICATION_TYPE_LABELS[item.notification.type] ??
                            item.notification.type}
                        </Badge>
                        <div className="line-clamp-1 font-medium text-slate-800">
                          {item.notification.title}
                        </div>
                      </TableCell>

                      <TableCell>
                        {item.status === NotificationDeliveryStatus.SENT ? (
                          <Badge variant="default" className="bg-emerald-600 text-xs">
                            SENT
                          </Badge>
                        ) : item.status === NotificationDeliveryStatus.PENDING ? (
                          <Badge variant="secondary" className="text-xs">
                            PENDING
                          </Badge>
                        ) : item.isTerminalFailure ? (
                          <Badge variant="destructive" className="text-xs">
                            FAILED (Terminal)
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-amber-500 text-amber-700 text-xs"
                          >
                            FAILED (Retryable)
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="font-mono text-xs">
                        {item.retryCount} / {item.maxRetries}
                      </TableCell>

                      <TableCell className="space-y-0.5 text-xs text-muted-foreground">
                        <div>Tạo: {formatDateTime(item.createdAt)}</div>
                        {item.sentAt && <div>Gửi: {formatDateTime(item.sentAt)}</div>}
                        {item.nextRetryAt && (
                          <div className="text-amber-700">
                            Thử lại: {formatDateTime(item.nextRetryAt)}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="max-w-xs text-xs">
                        {item.errorMessage ? (
                          <div className="space-y-0.5 text-rose-700">
                            {item.errorCode && (
                              <div className="font-mono font-semibold">{item.errorCode}</div>
                            )}
                            <div className="line-clamp-2">{item.errorMessage}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        {canRetry && item.canManualRetry ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void handleManualRetry(item)}
                            disabled={retryingId === item.id}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span>{retryingId === item.id ? "Đang gửi..." : "Thử gửi lại"}</span>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
