"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { NotificationType } from "@prisma/client";
import { Bell, Check, CheckCheck, ExternalLink, MailOpen } from "lucide-react";
import { toast } from "sonner";
import { UrlPaginationControls } from "@/components/shared/url-pagination-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { sanitizeInternalTargetPath } from "@/lib/safe-url";
import { buildUpdatedQueryUrl } from "@/lib/search-params";
import { usePropSyncedState } from "@/lib/use-prop-synced-state";
import { cn } from "@/lib/utils";
import {
  markAllNotificationsReadAction,
  markNotificationReadStateAction,
} from "@/modules/notifications/notification.actions";
import type { NotificationDTO } from "@/modules/notifications/notification.types";

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  ACCOUNT_REGISTERED: "Đăng ký tài khoản",
  ACCOUNT_APPROVED: "Phê duyệt tài khoản",
  ACCOUNT_REJECTED: "Từ chối tài khoản",
  PROJECT_MEMBER_ADDED: "Thêm vào Project",
  PROJECT_MEMBER_REMOVED: "Gỡ khỏi Project",
  PROJECT_LEADER_CHANGED: "Thay đổi Leader",
  TASK_ASSIGNED: "Giao Task mới",
  TASK_SUBMITTED_FOR_REVIEW: "Gửi duyệt Task",
  TASK_REVIEW_APPROVED: "Task được duyệt",
  TASK_REVIEW_REJECTED: "Task cần chỉnh sửa",
  TASK_DEADLINE_REMINDER: "Nhắc hạn Deadline",
  SYSTEM: "Hệ thống",
};

function formatDateTime(isoString: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoString));
}

interface NotificationCenterClientProps {
  initialNotifications: NotificationDTO[];
  initialUnreadCount: number;
  initialPagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  initialFilters?: {
    status: "all" | "unread" | "read";
    type: string;
  };
}

export function NotificationCenterClient({
  initialNotifications,
  initialUnreadCount,
  initialPagination,
  initialFilters,
}: NotificationCenterClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, startTransition] = React.useTransition();
  const [items, setItems] = usePropSyncedState<NotificationDTO[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = usePropSyncedState<number>(initialUnreadCount);
  const [statusFilter, setStatusFilter] = usePropSyncedState<"all" | "unread" | "read">(
    initialFilters?.status ?? "all"
  );
  const [typeFilter, setTypeFilter] = usePropSyncedState<string>(initialFilters?.type ?? "ALL");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [markingAll, setMarkingAll] = React.useState(false);

  const navigateWithQuery = React.useCallback(
    (overrides?: { page?: number; status?: "all" | "unread" | "read"; type?: string }) => {
      const nextPage = overrides?.page ?? 1;
      const nextStatus = overrides?.status ?? statusFilter;
      const nextType = overrides?.type ?? typeFilter;

      const targetUrl = buildUpdatedQueryUrl(pathname, {
        page: nextPage > 1 ? nextPage : undefined,
        status: nextStatus !== "all" ? nextStatus : undefined,
        type: nextType !== "ALL" ? nextType : undefined,
      });

      startTransition(() => {
        router.push(targetUrl);
      });
    },
    [pathname, router, statusFilter, typeFilter]
  );

  const filteredItems = React.useMemo(() => {
    return items.filter((item) => {
      if (statusFilter === "unread" && item.isRead) return false;
      if (statusFilter === "read" && !item.isRead) return false;
      if (typeFilter !== "ALL" && item.type !== typeFilter) return false;
      return true;
    });
  }, [items, statusFilter, typeFilter]);

  async function handleToggleRead(item: NotificationDTO, nextRead: boolean) {
    setBusyId(item.id);
    try {
      const res = await markNotificationReadStateAction(item.id, nextRead);
      if (res.ok) {
        setItems((prev) => prev.map((n) => (n.id === item.id ? res.data : n)));
        setUnreadCount((prev) =>
          nextRead ? Math.max(0, prev - (item.isRead ? 0 : 1)) : prev + (item.isRead ? 1 : 0)
        );
        toast.success(nextRead ? "Đã đánh dấu đã đọc." : "Đã đánh dấu chưa đọc.");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleNavigate(item: NotificationDTO) {
    if (!item.isRead) {
      await handleToggleRead(item, true);
    }
    const safeTargetUrl = sanitizeInternalTargetPath(item.targetUrl);
    if (safeTargetUrl) {
      router.push(safeTargetUrl);
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      const res = await markAllNotificationsReadAction();
      if (res.ok) {
        const nowIso = new Date().toISOString();
        setItems((prev) =>
          prev.map((n) => (n.isRead ? n : { ...n, isRead: true, readAt: nowIso }))
        );
        setUnreadCount(0);
        toast.success(`Đã đánh dấu ${res.data.updatedCount} thông báo là đã đọc.`);
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-5 w-5 text-slate-700" />
            <span>Hộp thư Thông báo ({initialPagination?.totalItems ?? filteredItems.length})</span>
            {unreadCount > 0 && (
              <Badge variant="default" className="text-xs">
                {unreadCount} chưa đọc
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
          </CardDescription>
        </div>

        {unreadCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleMarkAllRead()}
            disabled={markingAll}
          >
            <CheckCheck className="h-4 w-4" />
            <span>{markingAll ? "Đang xử lý..." : "Đánh dấu tất cả đã đọc"}</span>
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filter controls */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={statusFilter === "all" ? "default" : "outline"}
              onClick={() => {
                setStatusFilter("all");
                if (initialFilters) navigateWithQuery({ page: 1, status: "all" });
              }}
            >
              Tất cả
            </Button>
            <Button
              type="button"
              size="sm"
              variant={statusFilter === "unread" ? "default" : "outline"}
              onClick={() => {
                setStatusFilter("unread");
                if (initialFilters) navigateWithQuery({ page: 1, status: "unread" });
              }}
            >
              Chưa đọc ({unreadCount})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={statusFilter === "read" ? "default" : "outline"}
              onClick={() => {
                setStatusFilter("read");
                if (initialFilters) navigateWithQuery({ page: 1, status: "read" });
              }}
            >
              Đã đọc
            </Button>
          </div>

          <div className="w-full sm:w-64">
            <select
              value={typeFilter}
              onChange={(e) => {
                const nextType = e.target.value;
                setTypeFilter(nextType);
                if (initialFilters) navigateWithQuery({ page: 1, type: nextType });
              }}
              aria-label="Lọc theo loại thông báo"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="ALL">Tất cả loại thông báo</option>
              {(Object.keys(NOTIFICATION_TYPE_LABELS) as NotificationType[]).map((t) => (
                <option key={t} value={t}>
                  {NOTIFICATION_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Notification List */}
        {filteredItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <Bell className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium text-slate-900">
              Không có thông báo nào trong mục này
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Các thông báo mới về Task, Project và hệ thống sẽ xuất hiện tại đây.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex flex-col justify-between gap-3 p-4 transition sm:flex-row sm:items-center",
                  !item.isRead ? "bg-blue-50/40" : "bg-card"
                )}
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {!item.isRead && (
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-600" title="Chưa đọc" />
                    )}
                    <Badge variant="outline" className="text-xs">
                      {NOTIFICATION_TYPE_LABELS[item.type] ?? item.type}
                    </Badge>
                    {item.project && (
                      <span className="text-xs font-medium text-slate-600">
                        · Project: {item.project.name}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      · {formatDateTime(item.createdAt)}
                    </span>
                  </div>

                  <p
                    className={cn(
                      "text-sm",
                      !item.isRead ? "font-semibold text-slate-900" : "font-medium text-slate-800"
                    )}
                  >
                    {item.title}
                  </p>
                  <p className="text-sm text-slate-600">{item.message}</p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {sanitizeInternalTargetPath(item.targetUrl) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleNavigate(item)}
                      disabled={busyId === item.id}
                    >
                      <span>Mở liên kết</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {item.isRead ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleToggleRead(item, false)}
                      disabled={busyId === item.id}
                      title="Đánh dấu là chưa đọc"
                    >
                      <MailOpen className="h-4 w-4" />
                      <span>Đánh dấu chưa đọc</span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleToggleRead(item, true)}
                      disabled={busyId === item.id}
                    >
                      <Check className="h-4 w-4" />
                      <span>Đánh dấu đã đọc</span>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {initialPagination && (
          <UrlPaginationControls
            page={initialPagination.page}
            pageSize={initialPagination.pageSize}
            totalItems={initialPagination.totalItems}
            totalPages={initialPagination.totalPages}
            itemLabel="thông báo"
            isLoading={isNavigating}
            onPageChange={(nextPage) => navigateWithQuery({ page: nextPage })}
          />
        )}
      </CardContent>
    </Card>
  );
}
