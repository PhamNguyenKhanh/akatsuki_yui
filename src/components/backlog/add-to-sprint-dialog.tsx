"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TaskStatus } from "@prisma/client";
import { toast } from "sonner";
import {
  SprintStatusBadge,
  TaskPriorityBadge,
  TaskStatusBadge,
} from "@/components/shared/status-badge";
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
import { assignTasksToSprintAction } from "@/modules/sprints/sprint.actions";
import type { SprintTargetOptionDTO } from "@/modules/sprints/sprint.repository";
import { formatSprintDateYmd } from "@/modules/sprints/sprint.schema";
import type { TaskSummaryDTO } from "@/modules/tasks/task.repository";

interface AddToSprintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  selectedTasks: TaskSummaryDTO[];
  targetSprints: SprintTargetOptionDTO[];
  onAssigned?: () => void;
}

export function AddToSprintDialog({
  open,
  onOpenChange,
  projectId,
  selectedTasks,
  targetSprints,
  onAssigned,
}: AddToSprintDialogProps) {
  const router = useRouter();
  const [selectedSprintId, setSelectedSprintId] = React.useState<string>(
    targetSprints[0]?.id ?? ""
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const effectiveSprintId = targetSprints.some((s) => s.id === selectedSprintId)
    ? selectedSprintId
    : (targetSprints[0]?.id ?? "");

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setErrorMessage(null);
    }
    onOpenChange(nextOpen);
  }

  const reviewTasks = selectedTasks.filter((t) => t.status === TaskStatus.REVIEW);
  const selectedSprint = targetSprints.find((s) => s.id === effectiveSprintId);

  async function handleConfirm() {
    if (!effectiveSprintId || selectedTasks.length === 0) return;
    setErrorMessage(null);
    setSubmitting(true);

    const result = await assignTasksToSprintAction(
      effectiveSprintId,
      { taskIds: selectedTasks.map((t) => t.id) },
      projectId
    );

    setSubmitting(false);
    if (!result.ok) {
      setErrorMessage(result.error.message);
      toast.error(result.error.message);
      return;
    }

    toast.success(
      `Đã đưa ${result.data.addedCount} Task vào Sprint "${selectedSprint?.name ?? ""}".`
    );
    onAssigned?.();
    handleOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Đưa Task vào Sprint Planning</DialogTitle>
          <DialogDescription>
            Chọn Sprint đích (PLANNED hoặc ACTIVE) trong Project để đưa {selectedTasks.length} Task
            từ Product Backlog vào thực hiện.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <Alert variant="destructive">
            <AlertTitle>Không thể đưa Task vào Sprint</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {reviewTasks.length > 0 && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <AlertTitle>Lưu ý: Có {reviewTasks.length} Task đang ở trạng thái REVIEW</AlertTitle>
            <AlertDescription>
              Bạn vẫn có thể đưa các Task đang chờ Review này vào Sprint để tiếp tục duyệt trong
              Sprint.
            </AlertDescription>
          </Alert>
        )}

        {targetSprints.length === 0 ? (
          <Alert>
            <AlertTitle>Chưa có Sprint nào đang PLANNED hoặc ACTIVE</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>Cần khởi tạo ít nhất một Sprint PLANNED/ACTIVE trước khi phân bổ Task.</p>
              <Button asChild size="sm" variant="outline">
                <Link href={`/projects/${projectId}/sprints/new`}>Tạo Sprint mới</Link>
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Sprint đích *</Label>
              <Select value={effectiveSprintId} onValueChange={setSelectedSprintId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn Sprint..." />
                </SelectTrigger>
                <SelectContent>
                  {targetSprints.map((sprint) => (
                    <SelectItem key={sprint.id} value={sprint.id}>
                      {sprint.name} ({sprint.status} ·{" "}
                      {formatSprintDateYmd(new Date(sprint.startDate))} →{" "}
                      {formatSprintDateYmd(new Date(sprint.endDate))})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSprint && (
                <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                  <span>Trạng thái Sprint đích:</span>
                  <SprintStatusBadge status={selectedSprint.status} />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Danh sách Task được chọn ({selectedTasks.length})
              </p>
              <ul className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-border p-2.5">
                {selectedTasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/60 bg-muted/20 px-2.5 py-1.5 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {task.code}
                      </Badge>
                      <span className="font-medium text-slate-900">{task.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TaskPriorityBadge priority={task.priority} />
                      <TaskStatusBadge status={task.status} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Hủy
          </Button>
          <Button
            type="button"
            disabled={submitting || !effectiveSprintId || selectedTasks.length === 0}
            onClick={() => void handleConfirm()}
          >
            {submitting ? "Đang phân bổ..." : `Đưa ${selectedTasks.length} Task vào Sprint`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
