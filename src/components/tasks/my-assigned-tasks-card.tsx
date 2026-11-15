import Link from "next/link";
import { ListTodo } from "lucide-react";
import { TaskPriorityBadge, TaskStatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
            {tasks.map((task) => (
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
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
