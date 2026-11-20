"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { NotificationDeliveryStatus, NotificationType } from "@prisma/client";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  MailCheck,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { NOTIFICATION_TYPE_LABELS } from "@/components/features/notifications/notification-center-client";
import { UrlPaginationControls } from "@/components/shared/url-pagination-controls";
import { buildUpdatedQueryUrl } from "@/lib/search-params";
import { usePropSyncedState } from "@/lib/use-prop-synced-state";
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
  initialPagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  initialFilters?: {
    status: string;
    type: string;
    recipientEmail: string;
  };
}

export function AdminDeliveryHistoryClient({
  initialItems,
  initialSummary,
  canRetry,
  initialPagination,
  initialFilters,
}: AdminDeliveryHistoryClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, startTransition] = React.useTransition();
  const [items, setItems] = usePropSyncedState<NotificationDeliveryDTO[]>(initialItems);
  const [statusFilter, setStatusFilter] = usePropSyncedState<string>(
    initialFilters?.status ?? "ALL"
  );
  const [typeFilter, setTypeFilter] = usePropSyncedState<string>(initialFilters?.type ?? "ALL");
  const [emailSearch, setEmailSearch] = React.useState<string>(
    initialFilters?.recipientEmail ?? ""
  );
  const [retryingId, setRetryingId] = React.useState<string | null>(null);
  const [feedbackError, setFeedbackError] = React.useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = React.useState<string | null>(null);

  const navigateWithQuery = React.useCallback(
    (overrides?: { page?: number; status?: string; type?: string; recipientEmail?: string }) => {
      const nextPage = overrides?.page ?? 1;
      const nextStatus = overrides?.status ?? statusFilter;
      const nextType = overrides?.type ?? typeFilter;
      const nextRecipientEmail = (overrides?.recipientEmail ?? emailSearch).trim();

      const targetUrl = buildUpdatedQueryUrl(pathname, {
        page: nextPage > 1 ? nextPage : undefined,
        status: nextStatus !== "ALL" ? nextStatus : undefined,
        type: nextType !== "ALL" ? nextType : undefined,
        recipientEmail: nextRecipientEmail || undefined,
      });

      startTransition(() => {
        router.push(targetUrl);
      });
    },
    [pathname, router, statusFilter, typeFilter, emailSearch]
  );

  React.useEffect(() => {
    if (!initialFilters) return;
    const trimmedCurrent = emailSearch.trim();
    const trimmedInitial = initialFilters.recipientEmail.trim();
    if (trimmedCurrent === trimmedInitial) return;

    const timer = window.setTimeout(() => {
      navigateWithQuery({ page: 1, recipientEmail: trimmedCurrent });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [emailSearch, initialFilters, navigateWithQuery]);

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
      if (statusFilter === "UNKNOWN" && item.status !== NotificationDeliveryStatus.UNKNOWN) {
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

  async function handleManualRetry(
    delivery: NotificationDeliveryDTO,
    confirmUnknownResend = false
  ) {
    setFeedbackError(null);
    setFeedbackSuccess(null);
    setRetryingId(delivery.id);
    try {
      const res = await manualRetryNotificationDeliveryAction(delivery.id, {
        confirmUnknownResend,
      });
      if (!res.ok) {
        setFeedbackError(res.error.message);
        toast.error(res.error.message);
        return;
      }
      setItems((prev) => prev.map((d) => (d.id === res.data.id ? res.data : d)));
      const successMsg =
        res.data.status === NotificationDeliveryStatus.SENT
          ? `Đã gửi lại email qua SMTP tới ${res.data.recipientEmail} thành công.`
          : `Đã thực hiện thử gửi lại tới ${res.data.recipientEmail} (trạng thái hiện tại: ${res.data.status}, lần thử ${res.data.retryCount}/${res.data.maxRetries}).`;
      setFeedbackSuccess(successMsg);
      if (res.data.status === NotificationDeliveryStatus.SENT) {
        toast.success(successMsg);
      } else {
        toast.error(successMsg);
      }
      router.refresh();
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {initialSummary.quota && (initialSummary.quota.isNearLimit || initialSummary.pendingCount > 0 || initialSummary.unknownReviewCount > 0) && (
        <Alert
          variant={
            initialSummary.quota.isQuotaExceeded || initialSummary.unknownReviewCount > 0
              ? "destructive"
              : "warning"
          }
        >
          <AlertDescription className="space-y-1 text-xs sm:text-sm">
            <div className="font-medium">
              Hạn mức gửi SMTP 24h: {initialSummary.quota.usedLast24h} /{" "}
              {initialSummary.quota.dailyLimit} lượt (còn{" "}
              {initialSummary.quota.remainingLast24h} lượt) · Hàng đợi PENDING:{" "}
              {initialSummary.pendingCount} · Cần kiểm tra (UNKNOWN):{" "}
              {initialSummary.unknownReviewCount}
            </div>
            {initialSummary.quota.isQuotaExceeded && (
              <p>
                Hệ thống đã chạm ngưỡng gửi SMTP 24h. Các email mới được giữ ở trạng thái
                PENDING để Cron hằng ngày tiếp tục xử lý khi hạn mức mở lại.
              </p>
            )}
            {initialSummary.unknownReviewCount > 0 && (
              <p>
                Có {initialSummary.unknownReviewCount} bản ghi UNKNOWN (kết nối ngắt ở pha
                DATA). Hệ thống KHÔNG tự động gửi lại để tránh gửi trùng — vui lòng kiểm tra trước
                khi xác nhận gửi lại thủ công.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <HelpCircle className="h-4 w-4 text-purple-600" />
              <span>Chờ kiểm tra (UNKNOWN)</span>
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {initialSummary.unknownReviewCount}
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
            <span>
              Nhật ký Gửi Email qua SMTP ({initialPagination?.totalItems ?? filteredItems.length})
            </span>
          </CardTitle>
          <CardDescription>
            Theo dõi trạng thái gửi email thông báo qua Nodemailer SMTP và thực hiện kiểm tra / thử
            gửi lại thủ công tối đa 3 lần.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo email người nhận..."
                value={emailSearch}
                onChange={(e) => setEmailSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    navigateWithQuery({ page: 1, recipientEmail: e.currentTarget.value });
                  }
                }}
                className="pl-9"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                const nextStatus = e.target.value;
                setStatusFilter(nextStatus);
                if (initialFilters) navigateWithQuery({ page: 1, status: nextStatus });
              }}
              aria-label="Lọc theo trạng thái gửi"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PENDING">PENDING (Chờ gửi)</option>
              <option value="SENT">SENT (Đã gửi)</option>
              <option value="FAILED">FAILED (Tất cả lỗi)</option>
              <option value="FAILED_RETRYABLE">FAILED (Có thể thử lại &lt; 3)</option>
              <option value="FAILED_TERMINAL">FAILED (Hết lượt thử = 3)</option>
              <option value="UNKNOWN">UNKNOWN (Cần kiểm tra)</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => {
                const nextType = e.target.value;
                setTypeFilter(nextType);
                if (initialFilters) navigateWithQuery({ page: 1, type: nextType });
              }}
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
                        ) : item.status === NotificationDeliveryStatus.UNKNOWN ? (
                          <Badge
                            variant="outline"
                            className="border-purple-500 text-purple-700 text-xs"
                          >
                            UNKNOWN (Review)
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
                            onClick={() => void handleManualRetry(item, false)}
                            disabled={retryingId === item.id}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span>{retryingId === item.id ? "Đang gửi..." : "Thử gửi lại"}</span>
                          </Button>
                        ) : canRetry &&
                          item.requiresReview &&
                          item.retryCount < item.maxRetries ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-purple-400 text-purple-700 hover:bg-purple-50"
                            onClick={() => void handleManualRetry(item, true)}
                            disabled={retryingId === item.id}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span>
                              {retryingId === item.id ? "Đang gửi..." : "Xác nhận gửi lại"}
                            </span>
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

          {initialPagination && (
            <UrlPaginationControls
              page={initialPagination.page}
              pageSize={initialPagination.pageSize}
              totalItems={initialPagination.totalItems}
              totalPages={initialPagination.totalPages}
              itemLabel="bản ghi"
              isLoading={isNavigating}
              onPageChange={(nextPage) => navigateWithQuery({ page: nextPage })}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
