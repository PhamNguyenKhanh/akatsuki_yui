"use client";

import * as React from "react";
import { ReviewDecision, TaskHistoryAction } from "@prisma/client";
import { ChevronDown, ChevronUp } from "lucide-react";
import { TaskStatusBadge } from "@/components/shared/status-badge";
import {
  getHistoryDetailRows,
  getHistorySummaryChip,
  type HistorySummaryChip,
} from "@/components/tasks/task-history-formatter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TaskHistoryItemDTO } from "@/modules/tasks/task-history.repository";
import type { TaskReviewDTO } from "@/modules/tasks/task.repository";

function formatDateTimeVi(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const HISTORY_ACTION_LABELS: Record<TaskHistoryAction, string> = {
  [TaskHistoryAction.CREATED]: "Khởi tạo Task",
  [TaskHistoryAction.INFO_UPDATED]: "Cập nhật thông tin Task",
  [TaskHistoryAction.PROGRESS_UPDATED]: "Cập nhật tiến độ / liên kết",
  [TaskHistoryAction.ASSIGNEE_ADDED]: "Phân công thành viên",
  [TaskHistoryAction.ASSIGNEE_REMOVED]: "Gỡ phân công thành viên",
  [TaskHistoryAction.STATUS_CHANGED]: "Thay đổi trạng thái",
  [TaskHistoryAction.REVIEW_SUBMITTED]: "Gửi Review",
  [TaskHistoryAction.REVIEW_APPROVED]: "Duyệt Review (Approved)",
  [TaskHistoryAction.REVIEW_REJECTED]: "Từ chối Review (Rejected)",
  [TaskHistoryAction.DEPENDENCY_ADDED]: "Thêm phụ thuộc",
  [TaskHistoryAction.DEPENDENCY_REMOVED]: "Gỡ phụ thuộc",
  [TaskHistoryAction.SPRINT_ASSIGNED]: "Đưa vào Sprint",
  [TaskHistoryAction.SPRINT_REMOVED]: "Gỡ khỏi Sprint về Backlog",
  [TaskHistoryAction.SPRINT_MOVED]: "Chuyển giữa các Sprint",
};

interface TaskHistoryTimelineProps {
  taskId: string;
  canReadHistory: boolean;
  reviews: TaskReviewDTO[];
  initialHistory: {
    items: TaskHistoryItemDTO[];
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  } | null;
}

function renderSummaryChip(chip: HistorySummaryChip) {
  if (chip.kind === "transition" && chip.from && chip.to) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700">
          {chip.from}
        </Badge>
        <span className="text-muted-foreground">→</span>
        <Badge variant="outline" className="border-sky-300 bg-sky-50 text-sky-800">
          {chip.to}
        </Badge>
      </div>
    );
  }

  if (chip.kind === "added" && chip.text) {
    return (
      <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">
        {chip.text}
      </Badge>
    );
  }

  if (chip.kind === "removed" && chip.text) {
    return (
      <Badge variant="outline" className="border-rose-300 bg-rose-50 text-rose-800">
        {chip.text}
      </Badge>
    );
  }

  if (chip.text) {
    return (
      <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700">
        {chip.text}
      </Badge>
    );
  }

  return null;
}

export function TaskHistoryTimeline({
  taskId,
  canReadHistory,
  reviews,
  initialHistory,
}: TaskHistoryTimelineProps) {
  const [historyState, setHistoryState] = React.useState(initialHistory);
  const [loadingPage, setLoadingPage] = React.useState(false);
  const [expandedIds, setExpandedIds] = React.useState<Record<string, boolean>>({});

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  async function loadPage(nextPage: number) {
    if (!canReadHistory || !historyState) return;
    setLoadingPage(true);
    try {
      const response = await fetch(
        `/api/v1/tasks/${taskId}/history?page=${nextPage}&pageSize=${historyState.pageSize}`
      );
      if (!response.ok) return;
      const json = (await response.json()) as {
        data?: TaskHistoryItemDTO[];
        meta?: {
          page: number;
          pageSize: number;
          total: number;
          totalPages: number;
        };
      };
      if (json.data && json.meta) {
        setHistoryState({
          items: json.data,
          page: json.meta.page,
          pageSize: json.meta.pageSize,
          totalItems: json.meta.total,
          totalPages: json.meta.totalPages,
        });
      }
    } finally {
      setLoadingPage(false);
    }
  }

  return (
    <div className="space-y-6">
      {reviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Lịch sử Review chính thức ({reviews.length})
            </CardTitle>
            <CardDescription>
              Mọi lượt Approve / Reject kèm nhận xét bắt buộc từ Project Leader hoặc Admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {reviews.map((review) => {
              const isApproved = review.decision === ReviewDecision.APPROVED;
              return (
                <div
                  key={review.id}
                  className="rounded-lg border border-border bg-muted/20 p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          isApproved
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                            : "border-red-300 bg-red-50 text-red-800"
                        }
                      >
                        {isApproved ? "APPROVED" : "REJECTED"}
                      </Badge>
                      <span className="font-medium text-slate-900">{review.reviewer.fullName}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTimeVi(review.reviewedAt)}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-slate-700">{review.reason}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Nhật ký thay đổi Task {historyState ? `(${historyState.totalItems})` : ""}
          </CardTitle>
          <CardDescription>
            Theo dõi toàn bộ thay đổi trạng thái, phân công, phụ thuộc và tiến độ trên TaskHistory.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canReadHistory || !historyState ? (
            <p className="text-sm text-muted-foreground">
              Bạn không có quyền xem lịch sử chi tiết của Task (`task.history.read`).
            </p>
          ) : historyState.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có dữ liệu lịch sử.</p>
          ) : (
            <>
              <ol className="space-y-3">
                {historyState.items.map((item) => {
                  const summaryChip = getHistorySummaryChip(item);
                  const detailRows = getHistoryDetailRows(item);
                  const hasDetails = detailRows.length > 0;
                  const isExpanded = Boolean(expandedIds[item.id]);

                  return (
                    <li key={item.id} className="rounded-lg border border-border px-3.5 py-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">
                            {HISTORY_ACTION_LABELS[item.action] ?? item.action}
                          </Badge>
                          <span className="font-medium text-foreground">{item.actor.fullName}</span>
                          {(item.fromStatus || item.toStatus) && (
                            <div className="flex items-center gap-1.5 text-xs">
                              {item.fromStatus && <TaskStatusBadge status={item.fromStatus} />}
                              {item.fromStatus && item.toStatus && <span>→</span>}
                              {item.toStatus && <TaskStatusBadge status={item.toStatus} />}
                            </div>
                          )}
                          {summaryChip && renderSummaryChip(summaryChip)}
                        </div>
                        <div className="flex items-center gap-2">
                          {hasDetails && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                              aria-expanded={isExpanded}
                              onClick={() => toggleExpanded(item.id)}
                            >
                              Chi tiết
                              {isExpanded ? (
                                <ChevronUp className="ml-1 h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="ml-1 h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatDateTimeVi(item.createdAt)}
                          </span>
                        </div>
                      </div>

                      {item.reason && (
                        <p className="mt-2 rounded bg-muted/40 px-2.5 py-1.5 text-xs text-foreground/90">
                          Ghi chú / Lý do: {item.reason}
                        </p>
                      )}

                      {hasDetails && isExpanded && (
                        <div className="mt-2.5 space-y-1.5 rounded-md border border-border/70 bg-muted/20 p-2.5 text-xs">
                          {detailRows.map((row) => (
                            <div
                              key={row.key}
                              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
                            >
                              <span className="font-medium text-muted-foreground">{row.label}:</span>
                              {row.oldDisplay !== undefined && row.newDisplay !== undefined ? (
                                <span className="break-words text-foreground">
                                  <span className="text-muted-foreground">{row.oldDisplay}</span>
                                  <span className="mx-1.5 text-muted-foreground">→</span>
                                  <span>{row.newDisplay}</span>
                                </span>
                              ) : (
                                <span className="break-words text-foreground">
                                  {row.newDisplay ?? row.oldDisplay}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>

              {historyState.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
                  <span>
                    Trang {historyState.page} / {historyState.totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={loadingPage || historyState.page <= 1}
                      onClick={() => loadPage(historyState.page - 1)}
                    >
                      Trang trước
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={loadingPage || historyState.page >= historyState.totalPages}
                      onClick={() => loadPage(historyState.page + 1)}
                    >
                      Trang sau
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
