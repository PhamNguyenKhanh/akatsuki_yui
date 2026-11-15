"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

export function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState<number>(0);
  const [recentItems, setRecentItems] = React.useState<NotificationDTO[]>([]);
  const [loading, setLoading] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const fetchPreview = React.useCallback(async () => {
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
      // Ignore transient network errors in header polling
    }
  }, []);

  React.useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch("/api/v1/notifications?pageSize=6", {
          cache: "no-store",
        });
        if (!res.ok || ignore) return;
        const payload = (await res.json()) as {
          success?: boolean;
          data?: { items: NotificationDTO[]; unreadCount: number };
        };
        if (!ignore && payload?.data) {
          setRecentItems(payload.data.items);
          setUnreadCount(payload.data.unreadCount);
        }
      } catch {
        // Ignore transient network errors in header polling
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, [pathname]);

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

  async function handleItemClick(item: NotificationDTO) {
    if (!item.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setRecentItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
      await markNotificationReadStateAction(item.id, true);
    }
    setOpen(false);
    if (item.targetUrl) {
      router.push(item.targetUrl);
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
        router.refresh();
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
                    {item.targetUrl && (
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
