"use client";

import * as React from "react";
import { CheckSquare, Loader2, Plus, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePropSyncedState } from "@/lib/use-prop-synced-state";
import { cn } from "@/lib/utils";
import {
  createTaskSubtaskAction,
  deleteTaskSubtaskAction,
  toggleTaskSubtaskAction,
} from "@/modules/tasks/task-subtask.actions";
import type { TaskSubtaskDTO } from "@/modules/tasks/task-subtask.service";

interface TaskSubtasksCardProps {
  projectId: string;
  taskId: string;
  initialSubtasks: TaskSubtaskDTO[];
  canEdit: boolean;
}

export function TaskSubtasksCard({
  projectId,
  taskId,
  initialSubtasks,
  canEdit,
}: TaskSubtasksCardProps) {
  const [subtasks, setSubtasks] = usePropSyncedState<TaskSubtaskDTO[]>(initialSubtasks);
  const [newTitle, setNewTitle] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const completedCount = subtasks.filter((s) => s.isCompleted).length;
  const totalCount = subtasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed || adding || !canEdit) return;

    setAdding(true);
    const result = await createTaskSubtaskAction(taskId, projectId, { title: trimmed });
    setAdding(false);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    setSubtasks((prev) => [...prev, result.data]);
    setNewTitle("");
  }

  async function handleToggle(subtask: TaskSubtaskDTO) {
    if (!canEdit || busyId === subtask.id) return;
    const nextCompleted = !subtask.isCompleted;

    setSubtasks((prev) =>
      prev.map((item) => (item.id === subtask.id ? { ...item, isCompleted: nextCompleted } : item))
    );
    setBusyId(subtask.id);
    const result = await toggleTaskSubtaskAction(taskId, projectId, subtask.id, nextCompleted);
    setBusyId(null);

    if (!result.ok) {
      setSubtasks((prev) =>
        prev.map((item) =>
          item.id === subtask.id ? { ...item, isCompleted: subtask.isCompleted } : item
        )
      );
      toast.error(result.error.message);
      return;
    }

    setSubtasks((prev) => prev.map((item) => (item.id === subtask.id ? result.data : item)));
  }

  async function handleDelete(subtaskId: string) {
    if (!canEdit || busyId === subtaskId) return;
    setBusyId(subtaskId);
    const result = await deleteTaskSubtaskAction(taskId, projectId, subtaskId);
    setBusyId(null);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    setSubtasks((prev) => prev.filter((item) => item.id !== subtaskId));
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span>
              Checklist đầu việc ({completedCount}/{totalCount})
            </span>
          </CardTitle>
          <CardDescription>
            Chia nhỏ các bước thực hiện nội bộ trong Task mà không làm rối Kanban hay DAG.
          </CardDescription>
        </div>
        {totalCount > 0 && (
          <span className="text-sm font-semibold text-emerald-700">{progressPercent}%</span>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {totalCount > 0 && (
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-label="Tiến độ checklist đầu việc"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        {subtasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Chưa có đầu việc con nào.{canEdit ? " Thêm đầu việc bên dưới để theo dõi tiến độ." : ""}
          </p>
        ) : (
          <ul className="space-y-2">
            {subtasks.map((subtask) => {
              const isBusy = busyId === subtask.id;
              return (
                <li
                  key={subtask.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2"
                >
                  <button
                    type="button"
                    disabled={!canEdit || isBusy}
                    onClick={() => void handleToggle(subtask)}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-2.5 text-left text-sm",
                      canEdit ? "cursor-pointer" : "cursor-default"
                    )}
                  >
                    {subtask.isCompleted ? (
                      <CheckSquare className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <Square className="h-4 w-4 shrink-0 text-slate-400" />
                    )}
                    <span
                      className={cn(
                        "break-words",
                        subtask.isCompleted ? "text-muted-foreground line-through" : "text-slate-900"
                      )}
                    >
                      {subtask.title}
                    </span>
                  </button>

                  {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      disabled={isBusy}
                      onClick={() => void handleDelete(subtask.id)}
                      title="Xóa đầu việc"
                    >
                      {isBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {canEdit && (
          <form onSubmit={(e) => void handleAdd(e)} className="flex gap-2">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Thêm đầu việc cần làm..."
              maxLength={255}
              disabled={adding}
            />
            <Button type="submit" size="sm" disabled={adding || !newTitle.trim()}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span>Thêm</span>
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
