import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProjectStatusBadge } from "@/components/shared/status-badge";
import { SprintListClient } from "@/components/sprints/sprint-list-client";
import { Button } from "@/components/ui/button";
import { isAppError } from "@/lib/errors";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { hasPermission } from "@/modules/authorization/policy.service";
import { requirePermissionOrRedirect } from "@/modules/authorization/require-auth";
import { isWorkspaceAdmin } from "@/modules/projects/project.access";
import type { ProjectDTO } from "@/modules/projects/project.repository";
import { getProjectDetailService } from "@/modules/projects/project.service";
import { normalizePageSearchParams } from "@/modules/sprints/sprint-route-helpers";
import { sprintListQuerySchema } from "@/modules/sprints/sprint.schema";
import { listProjectSprintsService } from "@/modules/sprints/sprint.service";

export const metadata: Metadata = {
  title: "Danh sách Sprints",
};

type ProjectSprintsPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectSprintsPage({
  params,
  searchParams,
}: ProjectSprintsPageProps) {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.SPRINT_READ);
  const { projectId } = await params;
  const rawQuery = normalizePageSearchParams(await searchParams);

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

  const normalizedQuery = sprintListQuerySchema.safeParse(rawQuery);
  const effectiveQuery = normalizedQuery.success ? rawQuery : {};
  const sprints = await listProjectSprintsService(actor, project.id, effectiveQuery);

  const isAdminOrLeader = isWorkspaceAdmin(actor) || project.leaderId === actor.userId;
  const canManageSprint = hasPermission(actor, PERMISSIONS.SPRINT_MANAGE) && isAdminOrLeader;
  const parsedFilters = normalizedQuery.success ? normalizedQuery.data : {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Sprints · {project.name}
            </h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Quản lý các chu kỳ Sprint, theo dõi tiến độ theo Task và biểu đồ Burndown.
          </p>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link href={`/projects/${project.id}`}>
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại Project</span>
          </Link>
        </Button>
      </div>

      <SprintListClient
        projectId={project.id}
        projectStatus={project.status}
        sprints={sprints}
        canManageSprint={canManageSprint}
        initialFilters={{
          search: parsedFilters.search,
          status: parsedFilters.status,
        }}
      />
    </div>
  );
}
