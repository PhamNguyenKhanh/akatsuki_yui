"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TaskStatus } from "@prisma/client";
import { GitBranchPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TaskStatusBadge } from "@/components/shared/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addTaskDependencyAction, removeTaskDependencyAction } from "@/modules/tasks/task.actions";
import type {
  ProjectTaskOptionDTO,
  TaskDependencyItemDTO,
  TaskDependentItemDTO,
} from "@/modules/tasks/task.repository";

interface TaskDependenciesCardProps {
  projectId: string;
  taskId: string;
  dependencies: TaskDependencyItemDTO[];
  dependents: TaskDependentItemDTO[];
  candidateTasks: ProjectTaskOptionDTO[];
  canManageDependencies: boolean;
  isArchived: boolean;
}

export function TaskDependenciesCard({
  projectId,
  taskId,
  dependencies,
  dependents,
  candidateTasks,
  canManageDependencies,
  isArchived,
}: TaskDependenciesCardProps) {
  const router = useRouter();
  const [selectedDepId, setSelectedDepId] = React.useState<string>("");
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const existingDepIds = React.useMemo(
    () => new Set(dependencies.map((dep) => dep.dependsOnTaskId)),
    [dependencies]
  );

  const availableCandidates = React.useMemo(
    () =>
      candidateTasks.filter(
        (candidate) => candidate.id !== taskId && !existingDepIds.has(candidate.id)
      ),
    [candidateTasks, existingDepIds, taskId]
  );

  async function handleAddDependency() {
    if (!selectedDepId) return;
    setBusyKey("add");
    setErrorMessage(null);

    const result = await addTaskDependencyAction(
      taskId,
      { dependsOnTaskId: selectedDepId },
      projectId
    );
    setBusyKey(null);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      toast.error(result.error.message);
      return;
    }

    setSelectedDepId("");
    toast.success("Đã thêm liên kết phụ thuộc.");
    router.refresh();
  }

  async function handleRemoveDependency(dependsOnTaskId: string, code: string) {
    setBusyKey(`remove:${dependsOnTaskId}`);
    setErrorMessage(null);

    const result = await removeTaskDependencyAction(taskId, dependsOnTaskId, projectId);
    setBusyKey(null);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      toast.error(result.error.message);
      return;
    }

    toast.success(`Đã gỡ phụ thuộc khỏi ${code}.`);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Phụ thuộc công việc ({dependencies.length} tiền điều kiện)
        </CardTitle>
        <CardDescription>
          Task vẫn có thể bắt đầu thực hiện, nhưng chỉ được Approve lên DONE khi mọi Task tiền điều
          kiện đã DONE (DEC-005). Không cho phép tạo chu trình.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {canManageDependencies && !isArchived && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <Select value={selectedDepId} onValueChange={setSelectedDepId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      availableCandidates.length === 0
                        ? "Không còn Task khả dụng để liên kết"
                        : "Chọn Task tiền điều kiện..."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableCandidates.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      {candidate.code} · {candidate.title} ({candidate.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={!selectedDepId || busyKey !== null}
              onClick={handleAddDependency}
            >
              <GitBranchPlus className="h-4 w-4" />
              <span>{busyKey === "add" ? "Đang thêm..." : "Thêm phụ thuộc"}</span>
            </Button>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cần hoàn thành trước (Predecessors)
          </p>
          {dependencies.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có Task tiền điều kiện nào.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {dependencies.map((dep) => {
                const isBlocking = dep.dependsOnTask.status !== TaskStatus.DONE;
                return (
                  <li
                    key={dep.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {dep.dependsOnTask.code}
                        </span>
                        <Link
                          href={`/projects/${projectId}/tasks/${dep.dependsOnTaskId}`}
                          className="font-medium text-slate-900 hover:text-primary hover:underline"
                        >
                          {dep.dependsOnTask.title}
                        </Link>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <TaskStatusBadge status={dep.dependsOnTask.status} />
                        {isBlocking && (
                          <Badge
                            variant="outline"
                            className="border-amber-300 bg-amber-50 text-amber-800"
                          >
                            Đang chặn Approve
                          </Badge>
                        )}
                      </div>
                    </div>
                    {canManageDependencies && !isArchived && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-muted-foreground hover:text-destructive"
                        disabled={busyKey !== null}
                        onClick={() =>
                          handleRemoveDependency(dep.dependsOnTaskId, dep.dependsOnTask.code)
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Gỡ</span>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {dependents.length > 0 && (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Các Task đang chờ Task này ({dependents.length})
            </p>
            <ul className="space-y-1.5">
              {dependents.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {item.task.code}
                    </span>
                    <Link
                      href={`/projects/${projectId}/tasks/${item.task.id}`}
                      className="font-medium text-slate-900 hover:text-primary hover:underline"
                    >
                      {item.task.title}
                    </Link>
                  </div>
                  <TaskStatusBadge status={item.task.status} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
