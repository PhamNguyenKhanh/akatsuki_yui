"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { TaskStatus } from "@prisma/client";
import { Search } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { assignTasksToSprintAction } from "@/modules/sprints/sprint.actions";
import type { TaskSummaryDTO } from "@/modules/tasks/task.repository";

interface AssignBacklogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  sprintId: string;
  sprintName: string;
  backlogTasks: TaskSummaryDTO[];
}

export function AssignBacklogDialog({
  open,
  onOpenChange,
  projectId,
  sprintId,
  sprintName,
  backlogTasks,
}: AssignBacklogDialogProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSearch("");
      setSelectedIds([]);
      setErrorMessage(null);
    }
    onOpenChange(nextOpen);
  }

  const filteredTasks = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return backlogTasks.filter((task) => {
      if (task.status === TaskStatus.DONE) return false;
      if (!q) return true;
      return task.title.toLowerCase().includes(q) || task.code.toLowerCase().includes(q);
    });
  }, [backlogTasks, search]);

  function toggleTask(taskId: string) {
    setSelectedIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  }

  async function handleConfirm() {
    if (selectedIds.length === 0) return;
    setErrorMessage(null);
    setSubmitting(true);
    const result = await assignTasksToSprintAction(sprintId, { taskIds: selectedIds }, projectId);
    setSubmitting(false);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      toast.error(result.error.message);
      return;
    }

    toast.success(`Đã đưa ${result.data.addedCount} Task từ Backlog vào "${sprintName}".`);
    handleOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Đưa Task từ Product Backlog vào {sprintName}</DialogTitle>
          <DialogDescription>
            Chọn các Task chưa hoàn thành đang nằm trong Product Backlog để phân bổ vào Sprint này.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <Alert variant="destructive">
            <AlertTitle>Không thể phân bổ Task</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã Task hoặc tiêu đề..."
            className="pl-9"
          />
        </div>

        {filteredTasks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            Không có Task khả dụng trong Product Backlog.
          </div>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-border p-2.5">
            {filteredTasks.map((task) => {
              const checked = selectedIds.includes(task.id);
              return (
                <label
                  key={task.id}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2 text-sm hover:bg-muted/30"
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTask(task.id)}
                      className="h-4 w-4 rounded border-slate-300 accent-primary"
                    />
                    <Badge variant="outline" className="font-mono text-xs">
                      {task.code}
                    </Badge>
                    <span className="font-medium text-slate-900">{task.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {task.status === TaskStatus.REVIEW && (
                      <Badge
                        variant="outline"
                        className="border-amber-300 bg-amber-50 text-amber-800"
                      >
                        Chờ Review
                      </Badge>
                    )}
                    <TaskPriorityBadge priority={task.priority} />
                    <TaskStatusBadge status={task.status} />
                  </div>
                </label>
              );
            })}
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
            disabled={submitting || selectedIds.length === 0}
            onClick={() => void handleConfirm()}
          >
            {submitting ? "Đang đưa vào Sprint..." : `Đưa ${selectedIds.length} Task vào Sprint`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
