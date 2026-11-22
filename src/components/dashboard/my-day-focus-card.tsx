"use client";

import Link from "next/link";
import { AtSign, CalendarCheck2, Clock, ExternalLink, ListTodo, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatHcmDateTimeVi, formatHcmDateVi } from "@/lib/timezone";
import type { MyDayFocusDTO } from "@/modules/dashboard/my-day-focus.service";

export function MyDayFocusCard({ focus }: { focus: MyDayFocusDTO }) {
  const totalCount =
    focus.upcomingMeetings.length + focus.inProgressTasks.length + focus.unreadMentions.length;

  return (
    <Card className="border-primary/25 bg-gradient-to-br from-primary/[0.03] via-card to-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck2 className="h-5 w-5 text-primary" />
              <span>Việc của tôi hôm nay</span>
              <Badge variant="secondary" className="text-xs">
                {totalCount} mục
              </Badge>
            </CardTitle>
            <CardDescription>
              Tổng hợp nhanh lịch họp 24h tới, task đang làm và các lượt @mention chưa đọc.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4 lg:grid-cols-3">
        {/* Column 1: Meetings in next 24h */}
        <div className="space-y-2.5 rounded-lg border border-border bg-background/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground">
              <Video className="h-3.5 w-3.5 text-primary" />
              <span>Cuộc họp 24h tới ({focus.upcomingMeetings.length})</span>
            </h3>
          </div>

          {focus.upcomingMeetings.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Không có lịch họp nào trong 24h tới.
            </p>
          ) : (
            <div className="space-y-2">
              {focus.upcomingMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="space-y-1.5 rounded-md border border-border bg-card p-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/projects/${meeting.projectId}/meetings`}
                      className="line-clamp-1 font-semibold text-foreground hover:text-primary hover:underline"
                    >
                      {meeting.title}
                    </Link>
                    {meeting.isOngoing && (
                      <Badge className="shrink-0 bg-emerald-600 px-1.5 py-0 text-[10px] text-white">
                        Đang diễn ra
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {meeting.projectName} · {formatHcmDateVi(meeting.date)} ({meeting.startTime}–
                    {meeting.endTime})
                  </p>
                  {meeting.meetUrl && (
                    <Button asChild size="sm" variant="default" className="h-7 w-full text-xs">
                      <a href={meeting.meetUrl} target="_blank" rel="noopener noreferrer">
                        <Video className="h-3.5 w-3.5" />
                        <span>Vào Google Meet</span>
                        <ExternalLink className="h-3 w-3 opacity-75" />
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Column 2: My IN_PROGRESS tasks */}
        <div className="space-y-2.5 rounded-lg border border-border bg-background/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground">
              <ListTodo className="h-3.5 w-3.5 text-amber-600" />
              <span>Task đang làm ({focus.inProgressTasks.length})</span>
            </h3>
          </div>

          {focus.inProgressTasks.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Bạn chưa có task nào ở trạng thái Đang làm.
            </p>
          ) : (
            <div className="space-y-2">
              {focus.inProgressTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/projects/${task.projectId}/tasks/${task.id}`}
                  className="block space-y-1 rounded-md border border-border bg-card p-2.5 text-xs transition hover:border-primary/40 hover:bg-accent/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="line-clamp-1 font-medium text-foreground">{task.title}</p>
                    {task.isOverdue && (
                      <Badge variant="destructive" className="shrink-0 px-1.5 py-0 text-[10px]">
                        Quá hạn
                      </Badge>
                    )}
                  </div>
                  <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span>
                      {task.projectName} · Hạn {formatHcmDateTimeVi(task.deadline)}
                    </span>
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Column 3: Unread @mentions */}
        <div className="space-y-2.5 rounded-lg border border-border bg-background/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground">
              <AtSign className="h-3.5 w-3.5 text-blue-600" />
              <span>@Mention chưa đọc ({focus.unreadMentions.length})</span>
            </h3>
            <Link href="/notifications" className="text-[11px] font-medium text-primary hover:underline">
              Xem tất cả →
            </Link>
          </div>

          {focus.unreadMentions.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Không có lượt @mention nào chưa đọc.
            </p>
          ) : (
            <div className="space-y-2">
              {focus.unreadMentions.map((mention) => (
                <Link
                  key={mention.id}
                  href={mention.targetUrl ?? "/notifications"}
                  className="block space-y-1 rounded-md border border-border bg-card p-2.5 text-xs transition hover:border-primary/40 hover:bg-accent/40"
                >
                  <p className="line-clamp-1 font-semibold text-foreground">{mention.title}</p>
                  <p className="line-clamp-2 text-[11px] text-muted-foreground">
                    {mention.message}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
