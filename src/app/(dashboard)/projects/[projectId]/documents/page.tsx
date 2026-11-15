import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DocumentLibraryClient } from "@/components/features/documents/document-library-client";
import { ProjectStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { isAppError } from "@/lib/errors";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { requirePermissionOrRedirect } from "@/modules/authorization/require-auth";
import { canActorManageProjectDocuments } from "@/modules/documents/document.access";
import { listProjectDocumentsService } from "@/modules/documents/document.service";
import { assertProjectReadAccess } from "@/modules/projects/project.access";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Tài liệu Project",
};

type ProjectDocumentsPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectDocumentsPage({ params }: ProjectDocumentsPageProps) {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.DOCUMENT_READ);
  const { projectId } = await params;

  let projectAccess;
  try {
    projectAccess = await assertProjectReadAccess(actor, projectId);
  } catch (error) {
    if (isAppError(error)) {
      if (error.code === "FORBIDDEN") redirect("/access-denied?reason=forbidden");
      if (error.code === "NOT_FOUND" || error.code === "VALIDATION_ERROR") notFound();
    }
    throw error;
  }

  const [documentList, projectSprints] = await Promise.all([
    listProjectDocumentsService(actor, projectAccess.id, { pageSize: 100 }),
    prisma.sprint.findMany({
      where: { projectId: projectAccess.id },
      select: {
        id: true,
        name: true,
        status: true,
      },
      orderBy: [{ startDate: "desc" }],
    }),
  ]);

  const canManageDocuments = canActorManageProjectDocuments(actor, projectAccess);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link href={`/projects/${projectAccess.id}`}>
                <ArrowLeft className="h-4 w-4" />
                <span>Quay lại Project: {projectAccess.name}</span>
              </Link>
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Thư viện Tài liệu · {projectAccess.name}
            </h1>
            <ProjectStatusBadge status={projectAccess.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Quản lý tài liệu đặc tả, thiết kế và báo cáo liên kết từ Google Drive / Google Docs của
            Project.
          </p>
        </div>
      </div>

      <DocumentLibraryClient
        mode="project"
        initialDocuments={documentList.items}
        fixedProject={{
          id: projectAccess.id,
          name: projectAccess.name,
          status: projectAccess.status,
          canManageDocuments,
          sprints: projectSprints,
        }}
      />
    </div>
  );
}
