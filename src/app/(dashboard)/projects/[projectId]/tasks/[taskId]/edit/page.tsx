import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProjectStatus, TaskStatus } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import { TaskForm } from "@/components/tasks/task-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { isAppError } from "@/lib/errors";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { requirePermissionOrRedirect } from "@/modules/authorization/require-auth";
import { isWorkspaceAdmin } from "@/modules/projects/project.access";
import type { TaskDetailDTO } from "@/modules/tasks/task.repository";
import { getTaskDetailService } from "@/modules/tasks/task.service";

export const metadata: Metadata = {
  title: "Chỉnh sửa Task",
};

type EditTaskPageProps = {
  params: Promise<{ projectId: string; taskId: string }>;
};

export default async function EditTaskPage({ params }: EditTaskPageProps) {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.TASK_UPDATE);
  const { projectId, taskId } = await params;

  let task: TaskDetailDTO;
  try {
    task = await getTaskDetailService(actor, taskId);
  } catch (error) {
    if (isAppError(error)) {
      if (error.code === "FORBIDDEN") redirect("/access-denied?reason=forbidden");
      if (error.code === "NOT_FOUND" || error.code === "VALIDATION_ERROR") notFound();
    }
    throw error;
  }

  if (task.projectId !== projectId) {
    notFound();
  }

  const isLeaderOrAdmin = isWorkspaceAdmin(actor) || task.project.leaderId === actor.userId;
  if (!isLeaderOrAdmin) {
    redirect("/access-denied?reason=forbidden");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Chỉnh sửa Task <span className="font-mono text-xl">{task.code}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {task.title} · Project {task.project.name}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/projects/${task.projectId}/tasks/${task.id}`}>
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại chi tiết Task</span>
          </Link>
        </Button>
      </div>

      {task.project.status === ProjectStatus.ARCHIVED ? (
        <Alert variant="destructive">
          <AlertTitle>Project đang ở trạng thái ARCHIVED</AlertTitle>
          <AlertDescription>
            Theo quy định, Task thuộc Project đã Archive chỉ được xem dữ liệu và không
            thể chỉnh sửa.
          </AlertDescription>
        </Alert>
      ) : task.status === TaskStatus.DONE ? (
        <Alert variant="destructive">
          <AlertTitle>Task đã hoàn thành (DONE)</AlertTitle>
          <AlertDescription>
            Task đã ở trạng thái DONE và bị khóa chỉnh sửa hoàn toàn (read-only).
          </AlertDescription>
        </Alert>
      ) : (
        <TaskForm mode="edit" projectId={task.projectId} initialTask={task} />
      )}
    </div>
  );
}
