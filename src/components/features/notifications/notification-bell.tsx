"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { sanitizeInternalTargetPath } from "@/lib/safe-url";
import { getPusherClient } from "@/lib/pusher-client";
import { getUserNotificationsChannel, PUSHER_EVENTS } from "@/lib/pusher-channels";
import { cn } from "@/lib/utils";
import { usePropSyncedState } from "@/lib/use-prop-synced-state";
import {
  markAllNotificationsReadAction,
  markNotificationReadStateAction,
} from "@/modules/notifications/notification.actions";
import type { NotificationDTO } from "@/modules/notifications/notification.types";

function formatShortTime(isoString: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoString));
}

export function NotificationBell({
  userId,
  initialUnreadCount = 0,
}: {
  userId?: string;
  initialUnreadCount?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = usePropSyncedState<number>(initialUnreadCount);
  const [recentItems, setRecentItems] = React.useState<NotificationDTO[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [fetchingPreview, setFetchingPreview] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const fetchPreview = React.useCallback(async () => {
    setFetchingPreview(true);
    try {
      const res = await fetch("/api/v1/notifications?pageSize=6", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const payload = (await res.json()) as {
        success?: boolean;
        data?: { items: NotificationDTO[]; unreadCount: number };
      };
      if (payload?.data) {
        setRecentItems(payload.data.items);
        setUnreadCount(payload.data.unreadCount);
      }
    } catch {
      // On-demand preview errors stay non-blocking
    } finally {
      setFetchingPreview(false);
    }
  }, [setUnreadCount]);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  React.useEffect(() => {
    if (!userId) return;
    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = getUserNotificationsChannel(userId);
    const channel = pusher.subscribe(channelName);

    const handleNotificationCreated = (payload: {
      title?: string;
      message?: string;
      targetUrl?: string | null;
    }) => {
      setUnreadCount((prev) => prev + 1);
      if (payload?.title) {
        toast.info(payload.title, {
          description: payload.message || undefined,
          action: payload.targetUrl
            ? {
                label: "Xem",
                onClick: () => {
                  const safeUrl = sanitizeInternalTargetPath(payload.targetUrl);
                  if (safeUrl) router.push(safeUrl);
                },
              }
            : undefined,
        });
      }
      if (open) {
        void fetchPreview();
      }
    };

    channel.bind(PUSHER_EVENTS.NOTIFICATION_CREATED, handleNotificationCreated);

    return () => {
      channel.unbind(PUSHER_EVENTS.NOTIFICATION_CREATED, handleNotificationCreated);
      pusher.unsubscribe(channelName);
    };
  }, [userId, open, fetchPreview, router, setUnreadCount]);

  async function handleItemClick(item: NotificationDTO) {
    if (!item.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setRecentItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
      await markNotificationReadStateAction(item.id, true);
    }
    setOpen(false);
    const safeTargetUrl = sanitizeInternalTargetPath(item.targetUrl);
    if (safeTargetUrl) {
      router.push(safeTargetUrl);
    } else {
      router.push("/notifications");
    }
  }

  async function handleMarkAllRead() {
    setLoading(true);
    try {
      const res = await markAllNotificationsReadAction();
      if (res.ok) {
        setUnreadCount(0);
        setRecentItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
        toast.success("Đã đánh dấu tất cả thông báo là đã đọc.");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) {
            void fetchPreview();
          }
        }}
        aria-label="Thông báo"
      >
        <Bell className="h-5 w-5 text-slate-700" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 sm:w-96 rounded-lg border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">Thông báo</span>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {unreadCount} chưa đọc
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => void fetchPreview()}
                disabled={fetchingPreview}
                aria-label="Làm mới thông báo"
                title="Làm mới thông báo"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", fetchingPreview && "animate-spin")} />
              </Button>
              {unreadCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleMarkAllRead()}
                  disabled={loading}
                  className="h-7 px-2 text-xs"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span>Đọc tất cả</span>
                </Button>
              )}
            </div>
          </div>

          <div className="max-h-96 divide-y divide-border overflow-y-auto">
            {recentItems.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Bạn chưa có thông báo nào.
              </div>
            ) : (
              recentItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void handleItemClick(item)}
                  className={cn(
                    "flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-slate-50",
                    !item.isRead ? "bg-blue-50/40" : ""
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        "line-clamp-1 text-xs",
                        !item.isRead ? "font-semibold text-slate-900" : "font-medium text-slate-700"
                      )}
                    >
                      {item.title}
                    </span>
                    {!item.isRead && (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                    )}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{item.message}</p>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{formatShortTime(item.createdAt)}</span>
                    {sanitizeInternalTargetPath(item.targetUrl) && (
                      <span className="inline-flex items-center gap-0.5 text-slate-600">
                        <span>Xem chi tiết</span>
                        <ExternalLink className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="border-t border-border p-2 text-center">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block rounded-md py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Xem toàn bộ Trung tâm Thông báo
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
