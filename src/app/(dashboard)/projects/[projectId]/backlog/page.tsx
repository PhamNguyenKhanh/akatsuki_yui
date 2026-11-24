import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SprintStatus } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import { BacklogListClient } from "@/components/backlog/backlog-list-client";
import { ProjectStatusBadge } from "@/components/shared/status-badge";
import type { TaskAssignableMemberOption } from "@/components/tasks/task-list-client";
import { Button } from "@/components/ui/button";
import { isAppError } from "@/lib/errors";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { hasPermission } from "@/modules/authorization/policy.service";
import { requirePermissionOrRedirect } from "@/modules/authorization/require-auth";
import { isAssignableProjectRole } from "@/modules/project-members/member.schema";
import { listProjectMembersService } from "@/modules/project-members/member.service";
import { isWorkspaceAdmin } from "@/modules/projects/project.access";
import type { ProjectDTO } from "@/modules/projects/project.repository";
import { getProjectDetailService } from "@/modules/projects/project.service";
import { listBacklogTasksService } from "@/modules/sprints/sprint-planning.service";
import type { SprintTargetOptionDTO } from "@/modules/sprints/sprint.repository";
import { normalizePageSearchParams } from "@/modules/sprints/sprint-route-helpers";
import { listProjectSprintsService } from "@/modules/sprints/sprint.service";
import { taskListQuerySchema } from "@/modules/tasks/task.schema";

export const metadata: Metadata = {
  title: "Product Backlog",
};

type ProjectBacklogPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectBacklogPage({
  params,
  searchParams,
}: ProjectBacklogPageProps) {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.TASK_READ);
  if (!hasPermission(actor, PERMISSIONS.SPRINT_READ)) {
    redirect("/access-denied?reason=forbidden");
  }

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

  const normalizedQueryResult = taskListQuerySchema.safeParse({ ...rawQuery, backlogOnly: true });
  const effectiveQuery = normalizedQueryResult.success ? rawQuery : {};

  const canReadMembers = hasPermission(actor, PERMISSIONS.PROJECT_READ);
  const [backlogPage, members, projectSprints] = await Promise.all([
    listBacklogTasksService(actor, project.id, effectiveQuery),
    canReadMembers
      ? listProjectMembersService(actor, project.id, { includeHistory: false })
      : Promise.resolve([]),
    listProjectSprintsService(actor, project.id),
  ]);

  const assignableMembers: TaskAssignableMemberOption[] = members
    .filter((member) => isAssignableProjectRole(member.projectRole))
    .map((member) => ({
      userId: member.userId,
      fullName: member.user.fullName,
      email: member.user.email,
    }));

  const targetSprints: SprintTargetOptionDTO[] = projectSprints
    .filter(
      (sprint) => sprint.status === SprintStatus.PLANNED || sprint.status === SprintStatus.ACTIVE
    )
    .map((sprint) => ({
      id: sprint.id,
      name: sprint.name,
      status: sprint.status,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
    }));

  const isAdminOrLeader = isWorkspaceAdmin(actor) || project.leaderId === actor.userId;
  const canCreateTask = hasPermission(actor, PERMISSIONS.TASK_CREATE) && isAdminOrLeader;
  const canManageSprint = hasPermission(actor, PERMISSIONS.SPRINT_MANAGE) && isAdminOrLeader;

  const parsedFilters = normalizedQueryResult.success
    ? normalizedQueryResult.data
    : taskListQuerySchema.parse({ backlogOnly: true });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Product Backlog · {project.name}
            </h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Các Task chưa gắn với Sprint nào thuộc về Product Backlog. Chọn Task để đưa vào Sprint
            Planning.
          </p>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link href={`/projects/${project.id}`}>
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại Project</span>
          </Link>
        </Button>
      </div>

      <BacklogListClient
        projectId={project.id}
        projectStatus={project.status}
        tasks={backlogPage.items}
        totalItems={backlogPage.totalItems}
        page={backlogPage.page}
        totalPages={backlogPage.totalPages}
        assignableMembers={assignableMembers}
        targetSprints={targetSprints}
        canCreateTask={canCreateTask}
        canManageSprint={canManageSprint}
        initialFilters={{
          search: parsedFilters.search,
          priority: parsedFilters.priority,
          assigneeId: parsedFilters.assigneeId,
          unassignedOnly: parsedFilters.unassignedOnly,
          overdueOnly: parsedFilters.overdueOnly,
          deadlineFrom: normalizedQueryResult.success ? rawQuery.deadlineFrom : undefined,
          deadlineTo: normalizedQueryResult.success ? rawQuery.deadlineTo : undefined,
          sortBy: parsedFilters.sortBy,
          sortOrder: parsedFilters.sortOrder,
        }}
      />
    </div>
  );
}
