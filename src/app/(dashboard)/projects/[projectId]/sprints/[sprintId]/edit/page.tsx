import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProjectStatus, SprintStatus } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import { SprintForm } from "@/components/sprints/sprint-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { isAppError } from "@/lib/errors";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { requirePermissionOrRedirect } from "@/modules/authorization/require-auth";
import { isWorkspaceAdmin } from "@/modules/projects/project.access";
import type { SprintDetailDTO } from "@/modules/sprints/sprint.repository";
import { getSprintDetailService } from "@/modules/sprints/sprint.service";

export const metadata: Metadata = {
  title: "Chỉnh sửa Sprint",
};

type EditSprintPageProps = {
  params: Promise<{ projectId: string; sprintId: string }>;
};

export default async function EditSprintPage({ params }: EditSprintPageProps) {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.SPRINT_MANAGE);
  const { projectId, sprintId } = await params;

  let sprint: SprintDetailDTO;
  try {
    sprint = await getSprintDetailService(actor, sprintId);
  } catch (error) {
    if (isAppError(error)) {
      if (error.code === "FORBIDDEN") redirect("/access-denied?reason=forbidden");
      if (
        error.code === "SPRINT_NOT_FOUND" ||
        error.code === "NOT_FOUND" ||
        error.code === "VALIDATION_ERROR"
      ) {
        notFound();
      }
    }
    throw error;
  }

  if (sprint.projectId !== projectId) {
    notFound();
  }

  const isAdminOrLeader = isWorkspaceAdmin(actor) || sprint.project.leaderId === actor.userId;
  if (!isAdminOrLeader) {
    redirect("/access-denied?reason=forbidden");
  }

  const isClosedSprint =
    sprint.status === SprintStatus.COMPLETED || sprint.status === SprintStatus.CANCELLED;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Chỉnh sửa Sprint · {sprint.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Project {sprint.project.name}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/projects/${sprint.projectId}/sprints/${sprint.id}`}>
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại chi tiết Sprint</span>
          </Link>
        </Button>
      </div>

      {sprint.project.status === ProjectStatus.ARCHIVED ? (
        <Alert variant="destructive">
          <AlertTitle>Project đang ở trạng thái ARCHIVED</AlertTitle>
          <AlertDescription>
            Theo quy định, Sprint thuộc Project đã Archive chỉ được xem dữ liệu và không
            thể chỉnh sửa.
          </AlertDescription>
        </Alert>
      ) : isClosedSprint ? (
        <Alert variant="destructive">
          <AlertTitle>Sprint đã đóng ({sprint.status})</AlertTitle>
          <AlertDescription>
            Sprint đã hoàn thành hoặc đã hủy không cho phép chỉnh sửa thông tin.
          </AlertDescription>
        </Alert>
      ) : (
        <SprintForm
          mode="edit"
          projectId={sprint.projectId}
          projectName={sprint.project.name}
          initialSprint={sprint}
        />
      )}
    </div>
  );
}
