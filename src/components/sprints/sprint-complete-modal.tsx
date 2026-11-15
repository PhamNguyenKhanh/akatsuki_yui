"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { TaskStatus } from "@prisma/client";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { TaskPriorityBadge, TaskStatusBadge } from "@/components/shared/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { completeSprintAction } from "@/modules/sprints/sprint.actions";
import type {
  SprintCompletionPreviewDTO,
  SprintSummaryDTO,
} from "@/modules/sprints/sprint.repository";

interface TaskDispositionChoice {
  action: "MOVE_TO_BACKLOG" | "MOVE_TO_SPRINT";
  targetSprintId: string;
}

interface SprintCompleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sprint: SprintSummaryDTO;
}

export function SprintCompleteModal({ open, onOpenChange, sprint }: SprintCompleteModalProps) {
  const router = useRouter();
  const [reloadNonce, setReloadNonce] = React.useState(0);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<SprintCompletionPreviewDTO | null>(null);
  const [dispositions, setDispositions] = React.useState<Record<string, TaskDispositionChoice>>({});
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const loadingPreview = open && preview === null && previewError === null;

  function triggerReloadPreview(preserveSubmitError = false) {
    setPreview(null);
    setPreviewError(null);
    if (!preserveSubmitError) {
      setSubmitError(null);
    }
    setReloadNonce((prev) => prev + 1);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setPreview(null);
      setPreviewError(null);
      setSubmitError(null);
      setNote("");
    }
    onOpenChange(nextOpen);
  }

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;

    void fetch(`/api/v1/sprints/${sprint.id}/completion-preview`, {
      method: "GET",
      cache: "no-store",
    })
      .then(async (response) => {
        const json = await response.json();
        if (cancelled) return;
        if (!response.ok || json.error) {
          setPreviewError(json.error?.message ?? "Không thể tải danh sách Task chưa hoàn thành.");
          return;
        }

        const data = json.data as SprintCompletionPreviewDTO;
        setPreview(data);

        const initialChoices: Record<string, TaskDispositionChoice> = {};
        for (const task of data.unfinishedTasks) {
          initialChoices[task.id] = {
            action: "MOVE_TO_BACKLOG",
            targetSprintId: data.availableTargetSprints[0]?.id ?? "",
          };
        }
        setDispositions(initialChoices);
      })
      .catch(() => {
        if (cancelled) return;
        setPreviewError("Không thể kết nối máy chủ để tải dữ liệu tổng kết Sprint.");
      });

    return () => {
      cancelled = true;
    };
  }, [open, sprint.id, reloadNonce]);

  function applyBulkDisposition(
    action: "MOVE_TO_BACKLOG" | "MOVE_TO_SPRINT",
    targetSprintId?: string
  ) {
    if (!preview) return;
    const next: Record<string, TaskDispositionChoice> = {};
    for (const task of preview.unfinishedTasks) {
      next[task.id] = {
        action,
        targetSprintId: targetSprintId ?? preview.availableTargetSprints[0]?.id ?? "",
      };
    }
    setDispositions(next);
  }

  async function handleConfirmComplete() {
    if (!preview) return;
    setSubmitError(null);

    const payloadDispositions = preview.unfinishedTasks.map((task) => {
      const choice = dispositions[task.id] ?? {
        action: "MOVE_TO_BACKLOG" as const,
        targetSprintId: "",
      };
      return {
        taskId: task.id,
        action: choice.action,
        targetSprintId: choice.action === "MOVE_TO_SPRINT" ? choice.targetSprintId : null,
        expectedStatus: task.status,
      };
    });

    const missingTarget = payloadDispositions.find(
      (item) => item.action === "MOVE_TO_SPRINT" && !item.targetSprintId
    );
    if (missingTarget) {
      setSubmitError("Vui lòng chọn Sprint đích cho tất cả các Task chọn chuyển sang Sprint khác.");
      return;
    }

    setSubmitting(true);
    const updatedAt =
      typeof preview.sprint.updatedAt === "string"
        ? preview.sprint.updatedAt
        : preview.sprint.updatedAt.toISOString();

    const result = await completeSprintAction(sprint.id, {
      expectedUpdatedAt: updatedAt,
      note: note.trim() ? note.trim() : null,
      taskDispositions: payloadDispositions,
    });
    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error.message);
      toast.error(result.error.message);
      if (
        result.error.code === "CONFLICT" ||
        result.error.code === "SPRINT_UNFINISHED_TASKS_REQUIRE_DISPOSITION"
      ) {
        triggerReloadPreview(true);
      }
      return;
    }

    toast.success(`Đã hoàn thành Sprint "${sprint.name}".`);
    handleOpenChange(false);
    router.refresh();
  }

  const targetSprints = preview?.availableTargetSprints ?? [];
  const unfinishedTasks = preview?.unfinishedTasks ?? [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Hoàn thành Sprint · {sprint.name}</DialogTitle>
          <DialogDescription>
            Theo quy định, mọi Task chưa DONE bắt buộc phải được chuyển về Product Backlog hoặc sang
            một Sprint PLANNED/ACTIVE khác trong cùng Project trước khi đóng Sprint.
          </DialogDescription>
        </DialogHeader>

        {loadingPreview ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Đang kiểm tra trạng thái các Task trong Sprint...
          </div>
        ) : previewError ? (
          <div className="space-y-3">
            <Alert variant="destructive">
              <AlertTitle>Lỗi tải dữ liệu tổng kết</AlertTitle>
              <AlertDescription>{previewError}</AlertDescription>
            </Alert>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => triggerReloadPreview()}
            >
              <RefreshCw className="h-4 w-4" />
              <span>Thử tải lại</span>
            </Button>
          </div>
        ) : preview ? (
          <div className="space-y-4">
            {submitError && (
              <Alert variant="destructive">
                <AlertTitle>Không thể hoàn thành Sprint</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-sm">
                <p className="flex items-center gap-1.5 font-medium text-emerald-900">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{preview.doneTasksCount} Task đã DONE</span>
                </p>
                <p className="mt-0.5 text-xs text-emerald-800">
                  Các Task đã DONE sẽ tiếp tục gắn với Sprint này trong lịch sử.
                </p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm">
                <p className="flex items-center gap-1.5 font-medium text-amber-900">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{unfinishedTasks.length} Task chưa hoàn thành</span>
                </p>
                <p className="mt-0.5 text-xs text-amber-800">
                  Cần chọn hướng xử lý dứt điểm cho toàn bộ Task bên dưới.
                </p>
              </div>
            </div>

            {unfinishedTasks.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/20 p-2.5">
                  <span className="text-xs font-medium text-slate-700">
                    Áp dụng nhanh cho tất cả:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => applyBulkDisposition("MOVE_TO_BACKLOG")}
                    >
                      Đưa tất cả về Backlog
                    </Button>
                    {targetSprints.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => applyBulkDisposition("MOVE_TO_SPRINT", targetSprints[0].id)}
                      >
                        Chuyển tất cả sang {targetSprints[0].name}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5">
                  {unfinishedTasks.map((task) => {
                    const current = dispositions[task.id] ?? {
                      action: "MOVE_TO_BACKLOG",
                      targetSprintId: targetSprints[0]?.id ?? "",
                    };

                    return (
                      <div
                        key={task.id}
                        className="rounded-lg border border-border bg-card p-3 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">
                              {task.code}
                            </span>
                            <span className="text-sm font-medium text-slate-900">{task.title}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <TaskPriorityBadge priority={task.priority} />
                            <TaskStatusBadge status={task.status} />
                          </div>
                        </div>

                        {task.status === TaskStatus.REVIEW && (
                          <Badge
                            variant="outline"
                            className="border-amber-300 bg-amber-50 text-amber-800"
                          >
                            Task đang chờ Review — việc di chuyển sẽ chuyển sang đích được chọn
                          </Badge>
                        )}

                        <div className="grid gap-2 sm:grid-cols-2">
                          <Select
                            value={current.action}
                            onValueChange={(value) => {
                              const nextAction = value as "MOVE_TO_BACKLOG" | "MOVE_TO_SPRINT";
                              setDispositions((prev) => ({
                                ...prev,
                                [task.id]: {
                                  action: nextAction,
                                  targetSprintId:
                                    prev[task.id]?.targetSprintId || targetSprints[0]?.id || "",
                                },
                              }));
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MOVE_TO_BACKLOG">
                                Chuyển về Product Backlog
                              </SelectItem>
                              <SelectItem
                                value="MOVE_TO_SPRINT"
                                disabled={targetSprints.length === 0}
                              >
                                {targetSprints.length === 0
                                  ? "Chuyển sang Sprint khác (Chưa có Sprint đích)"
                                  : "Chuyển sang Sprint khác"}
                              </SelectItem>
                            </SelectContent>
                          </Select>

                          {current.action === "MOVE_TO_SPRINT" && (
                            <Select
                              value={current.targetSprintId}
                              onValueChange={(targetSprintId) =>
                                setDispositions((prev) => ({
                                  ...prev,
                                  [task.id]: { action: "MOVE_TO_SPRINT", targetSprintId },
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Chọn Sprint đích..." />
                              </SelectTrigger>
                              <SelectContent>
                                {targetSprints.map((target) => (
                                  <SelectItem key={target.id} value={target.id}>
                                    {target.name} ({target.status})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="complete-sprint-note">Ghi chú tổng kết Sprint (tuỳ chọn)</Label>
              <Textarea
                id="complete-sprint-note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi nhận kết quả Sprint, các điểm cần cải thiện cho Sprint sau..."
                disabled={submitting}
              />
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Đóng
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirmComplete()}
            disabled={loadingPreview || !!previewError || submitting || !preview}
          >
            {submitting ? "Đang hoàn thành..." : "Xác nhận hoàn thành Sprint"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
