"use client";

import * as React from "react";
import Link from "next/link";
import { TaskStatus } from "@prisma/client";
import { Calendar, CheckCircle2, GripVertical, Link2, Play, Send, XCircle } from "lucide-react";
import { TaskPriorityBadge } from "@/components/shared/status-badge";
import type { TaskReviewModalMode } from "@/components/tasks/task-review-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { KanbanCardItemDTO } from "@/modules/sprints/kanban.service";

function formatDateVi(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

interface KanbanTaskCardProps {
  projectId: string;
  card: KanbanCardItemDTO;
  isArchived: boolean;
  isBusy: boolean;
  isDragging: boolean;
  onDragStartCard: (card: KanbanCardItemDTO, event: React.DragEvent<HTMLDivElement>) => void;
  onDragEndCard: () => void;
  onStartProgress: (card: KanbanCardItemDTO) => void;
  onOpenReviewModal: (card: KanbanCardItemDTO, mode: TaskReviewModalMode) => void;
}

export function KanbanTaskCard({
  projectId,
  card,
  isArchived,
  isBusy,
  isDragging,
  onDragStartCard,
  onDragEndCard,
  onStartProgress,
  onOpenReviewModal,
}: KanbanTaskCardProps) {
  const canDrag =
    !isArchived &&
    !isBusy &&
    card.status !== TaskStatus.DONE &&
    (card.permissions.canStartProgress ||
      card.permissions.canSubmitReview ||
      card.permissions.canApproveOrReject);

  return (
    <div
      draggable={canDrag}
      onDragStart={(event) => onDragStartCard(card, event)}
      onDragEnd={onDragEndCard}
      data-task-id={card.id}
      className={cn(
        "space-y-2.5 rounded-lg border border-border bg-card p-3 shadow-xs transition",
        canDrag ? "cursor-grab active:cursor-grabbing hover:border-slate-400" : "",
        isDragging ? "opacity-50 ring-2 ring-primary" : "",
        isBusy ? "pointer-events-none opacity-70" : ""
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {canDrag && (
            <GripVertical className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          )}
          <span className="font-mono text-xs text-muted-foreground">{card.code}</span>
          <TaskPriorityBadge priority={card.priority} />
        </div>
        {card.sprint ? (
          <Badge
            variant="outline"
            className="max-w-[130px] truncate border-indigo-200 bg-indigo-50 text-[11px] text-indigo-800"
            title={card.sprint.name}
          >
            {card.sprint.name}
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="border-slate-200 bg-slate-50 text-[11px] text-slate-600"
          >
            Backlog
          </Badge>
        )}
      </div>

      <Link
        href={`/projects/${projectId}/tasks/${card.id}`}
        className="block text-sm font-medium leading-snug text-slate-900 hover:text-primary hover:underline"
      >
        {card.title}
      </Link>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span
          className={cn(
            "inline-flex items-center gap-1",
            card.isOverdue ? "font-semibold text-red-700" : ""
          )}
        >
          <Calendar className="h-3.5 w-3.5" />
          <span>{formatDateVi(card.deadline)}</span>
          {card.isOverdue && <span>(Quá hạn)</span>}
        </span>

        {card.estimateHours !== null && <span>· {card.estimateHours}h</span>}

        {card.blockedByCount > 0 && card.status !== TaskStatus.DONE && (
          <Badge
            variant="outline"
            className="inline-flex items-center gap-1 border-amber-300 bg-amber-50 text-[11px] text-amber-800"
          >
            <Link2 className="h-3 w-3" />
            <span>Chờ {card.blockedByCount} Task</span>
          </Badge>
        )}
      </div>

      {card.assignees.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {card.assignees.slice(0, 3).map((assignee) => (
            <Badge
              key={assignee.id}
              variant="secondary"
              className="px-1.5 py-0 text-[11px] font-normal"
            >
              {assignee.user.fullName}
            </Badge>
          ))}
          {card.assignees.length > 3 && (
            <Badge variant="outline" className="px-1.5 py-0 text-[11px]">
              +{card.assignees.length - 3}
            </Badge>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">Chưa phân công</p>
      )}

      {/* Keyboard & Mobile Action Buttons */}
      {!isArchived && (
        <div className="flex flex-wrap gap-1.5 border-t border-border/70 pt-2">
          {card.status === TaskStatus.TODO && card.permissions.canStartProgress && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={isBusy}
              onClick={() => onStartProgress(card)}
            >
              <Play className="h-3 w-3" />
              <span>Bắt đầu</span>
            </Button>
          )}

          {card.status === TaskStatus.IN_PROGRESS && card.permissions.canSubmitReview && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={isBusy}
              onClick={() => onOpenReviewModal(card, "submit")}
            >
              <Send className="h-3 w-3" />
              <span>Gửi Review</span>
            </Button>
          )}

          {card.status === TaskStatus.REVIEW && card.permissions.canApproveOrReject && (
            <>
              <Button
                type="button"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={isBusy}
                onClick={() => onOpenReviewModal(card, "approve")}
              >
                <CheckCircle2 className="h-3 w-3" />
                <span>Duyệt</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="h-7 px-2 text-xs"
                disabled={isBusy}
                onClick={() => onOpenReviewModal(card, "reject")}
              >
                <XCircle className="h-3 w-3" />
                <span>Từ chối</span>
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
