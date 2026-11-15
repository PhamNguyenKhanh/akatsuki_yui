import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProjectStatus } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import { SprintForm } from "@/components/sprints/sprint-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { isAppError } from "@/lib/errors";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { requirePermissionOrRedirect } from "@/modules/authorization/require-auth";
import { isWorkspaceAdmin } from "@/modules/projects/project.access";
import type { ProjectDTO } from "@/modules/projects/project.repository";
import { getProjectDetailService } from "@/modules/projects/project.service";

export const metadata: Metadata = {
  title: "Tạo Sprint mới",
};

type NewSprintPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function NewSprintPage({ params }: NewSprintPageProps) {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.SPRINT_MANAGE);
  const { projectId } = await params;

  let project: ProjectDTO;
  try {
    project = await getProjectDetailService(actor, projectId);
  } catch (error) {
    if (isAppError(error)) {
      if (error.code === "FORBIDDEN") redirect("/access-denied?reason=forbidden");
      if (error.code === "NOT_FOUND" || error.code === "VALIDATION_ERROR") notFound();
    }
    throw error;
  }

  const isAdminOrLeader = isWorkspaceAdmin(actor) || project.leaderId === actor.userId;
  if (!isAdminOrLeader) {
    redirect("/access-denied?reason=forbidden");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Tạo Sprint mới · {project.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Khởi tạo Sprint ở trạng thái PLANNED để phân bổ công việc từ Product Backlog.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/projects/${project.id}/sprints`}>
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại Sprints</span>
          </Link>
        </Button>
      </div>

      {project.status === ProjectStatus.ARCHIVED ? (
        <Alert variant="destructive">
          <AlertTitle>Project đang ở trạng thái ARCHIVED</AlertTitle>
          <AlertDescription>
            Theo quy định BR-PROJ-008, không thể tạo Sprint mới trong Project đã Archive. Admin cần
            khôi phục Project trước khi lập kế hoạch Sprint mới.
          </AlertDescription>
        </Alert>
      ) : (
        <SprintForm mode="create" projectId={project.id} projectName={project.name} />
      )}
    </div>
  );
}
