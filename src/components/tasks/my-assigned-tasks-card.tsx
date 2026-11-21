"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProjectStatus, TaskStatus } from "@prisma/client";
import { ListTodo, Loader2, Play, Send } from "lucide-react";
import { toast } from "sonner";
import { TaskPriorityBadge, TaskStatusBadge } from "@/components/shared/status-badge";
import { TaskReviewModal } from "@/components/tasks/task-review-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateTaskStatusAction } from "@/modules/tasks/task.actions";
import type { MyAssignedTaskDTO } from "@/modules/tasks/task.repository";

function formatDateVi(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

interface MyAssignedTasksCardProps {
  tasks: MyAssignedTaskDTO[];
}

export function MyAssignedTasksCard({ tasks }: MyAssignedTasksCardProps) {
  const router = useRouter();
  const [busyTaskId, setBusyTaskId] = React.useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = React.useState<MyAssignedTaskDTO | null>(null);

  async function handleStartWork(task: MyAssignedTaskDTO) {
    setBusyTaskId(task.id);
    const result = await updateTaskStatusAction(task.id, TaskStatus.IN_PROGRESS);
    setBusyTaskId(null);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    toast.success(`Đã chuyển ${task.code} sang In Progress.`);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ListTodo className="h-5 w-5 text-slate-700" />
          <CardTitle className="text-base">Công việc được giao cho tôi ({tasks.length})</CardTitle>
        </div>
        <CardDescription>
          Danh sách các Task chưa hoàn thành đang được phân công cho bạn trong các Project hiện
          hành.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Hiện bạn không có công việc chưa hoàn thành nào đang được phân công.
          </p>
        ) : (
          <div className="space-y-2.5">
            {tasks.map((task) => {
              const isArchived = task.projectStatus === ProjectStatus.ARCHIVED;
              const isBusy = busyTaskId === task.id;
              const canStart = !isArchived && task.status === TaskStatus.TODO;
              const canSubmitReview = !isArchived && task.status === TaskStatus.IN_PROGRESS;

              return (
                <div
                  key={task.id}
                  className="flex flex-col justify-between gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{task.code}</span>
                      <Link
                        href={`/projects/${task.projectId}/tasks/${task.id}`}
                        className="truncate font-medium text-slate-900 hover:text-primary hover:underline"
                      >
                        {task.title}
                      </Link>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Project:{" "}
                      <Link href={`/projects/${task.projectId}/tasks`} className="hover:underline">
                        {task.projectName}
                      </Link>{" "}
                      · Deadline: {formatDateVi(task.deadline)}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <TaskPriorityBadge priority={task.priority} />
                    <TaskStatusBadge status={task.status} />
                    {task.isOverdue && (
                      <Badge variant="outline" className="border-red-300 bg-red-50 text-red-800">
                        Quá hạn
                      </Badge>
                    )}
                    {canStart && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs"
                        disabled={isBusy}
                        onClick={() => void handleStartWork(task)}
                      >
                        {isBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        <span>Bắt đầu</span>
                      </Button>
                    )}
                    {canSubmitReview && (
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        className="h-7 px-2.5 text-xs"
                        disabled={isBusy}
                        onClick={() => setReviewTarget(task)}
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>Gửi Review</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {reviewTarget && (
        <TaskReviewModal
          open={true}
          onOpenChange={(open) => {
            if (!open) setReviewTarget(null);
          }}
          mode="submit"
          projectId={reviewTarget.projectId}
          taskId={reviewTarget.id}
          taskTitle={reviewTarget.title}
          taskCode={reviewTarget.code}
        />
      )}
    </Card>
  );
}
