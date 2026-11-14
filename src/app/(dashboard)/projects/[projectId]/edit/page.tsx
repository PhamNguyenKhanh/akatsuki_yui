import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProjectStatus } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import { ProjectForm } from "@/components/projects/project-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { isAppError } from "@/lib/errors";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { requirePermissionOrRedirect } from "@/modules/authorization/require-auth";
import { projectTemplateRepository } from "@/modules/project-templates/template.repository";
import { isWorkspaceAdmin } from "@/modules/projects/project.access";
import { projectRepository, type ProjectDTO } from "@/modules/projects/project.repository";
import { getProjectDetailService } from "@/modules/projects/project.service";

export const metadata: Metadata = {
  title: "Chỉnh sửa Project",
};

type EditProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function EditProjectPage({ params }: EditProjectPageProps) {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.PROJECT_UPDATE);
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

  const isAdmin = isWorkspaceAdmin(actor);
  if (!isAdmin && project.leaderId !== actor.userId) {
    redirect("/access-denied?reason=forbidden");
  }

  const [templates, userOptions] = await Promise.all([
    projectTemplateRepository.findActiveOptions(),
    projectRepository.findActiveUserCandidates(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Chỉnh sửa: {project.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cập nhật thông tin tổng quan, thời gian và Giảng viên hướng dẫn của Project.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/projects/${project.id}`}>
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại chi tiết</span>
          </Link>
        </Button>
      </div>

      {project.status === ProjectStatus.ARCHIVED ? (
        <Alert variant="destructive">
          <AlertTitle>Project đang ở trạng thái ARCHIVED</AlertTitle>
          <AlertDescription>
            Theo quy định BR-PROJ-008, Project đã Archive không được phép chỉnh sửa thông tin. Chỉ
            Admin mới có thể khôi phục Project từ trang chi tiết trước khi cập nhật.
          </AlertDescription>
        </Alert>
      ) : (
        <ProjectForm
          mode="edit"
          initialProject={project}
          templates={templates}
          userOptions={userOptions}
          currentUserId={actor.userId}
          isAdminCreator={isAdmin}
        />
      )}
    </div>
  );
}
