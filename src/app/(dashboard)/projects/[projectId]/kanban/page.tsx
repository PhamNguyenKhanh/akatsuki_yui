import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { KanbanBoardClient } from "@/components/kanban/kanban-board-client";
import { ProjectStatusBadge } from "@/components/shared/status-badge";
import type { TaskAssignableMemberOption } from "@/components/tasks/task-list-client";
import { Button } from "@/components/ui/button";
import { isAppError } from "@/lib/errors";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { hasPermission } from "@/modules/authorization/policy.service";
import { requirePermissionOrRedirect } from "@/modules/authorization/require-auth";
import { isAssignableProjectRole } from "@/modules/project-members/member.schema";
import { listProjectMembersService } from "@/modules/project-members/member.service";
import type { ProjectDTO } from "@/modules/projects/project.repository";
import { getProjectDetailService } from "@/modules/projects/project.service";
import { getKanbanBoardService, type KanbanBoardDTO } from "@/modules/sprints/kanban.service";
import { normalizePageSearchParams } from "@/modules/sprints/sprint-route-helpers";
import { kanbanQuerySchema } from "@/modules/sprints/sprint.schema";
import { listProjectSprintsService } from "@/modules/sprints/sprint.service";

export const metadata: Metadata = {
  title: "Kanban Board",
};

type ProjectKanbanPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectKanbanPage({ params, searchParams }: ProjectKanbanPageProps) {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.TASK_READ);
  if (!hasPermission(actor, PERMISSIONS.SPRINT_READ)) {
    redirect("/access-denied?reason=forbidden");
  }

  const { projectId } = await params;
  const rawQuery = normalizePageSearchParams(await searchParams);
  if (rawQuery.sprintId && !rawQuery.scope) {
    rawQuery.scope = "SPRINT";
  }

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

  const parsedQueryResult = kanbanQuerySchema.safeParse(rawQuery);
  const effectiveQuery = parsedQueryResult.success ? rawQuery : {};

  let board: KanbanBoardDTO;
  try {
    board = await getKanbanBoardService(actor, project.id, effectiveQuery);
  } catch (error) {
    if (isAppError(error)) {
      if (error.code === "SPRINT_NOT_FOUND" || error.code === "NOT_FOUND") {
        board = await getKanbanBoardService(actor, project.id, {});
      } else if (error.code === "FORBIDDEN") {
        redirect("/access-denied?reason=forbidden");
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }

  const canReadMembers = hasPermission(actor, PERMISSIONS.PROJECT_READ);
  const [sprints, members] = await Promise.all([
    listProjectSprintsService(actor, project.id),
    canReadMembers
      ? listProjectMembersService(actor, project.id, { includeHistory: false })
      : Promise.resolve([]),
  ]);

  const assignableMembers: TaskAssignableMemberOption[] = members
    .filter((member) => isAssignableProjectRole(member.projectRole))
    .map((member) => ({
      userId: member.userId,
      fullName: member.user.fullName,
      email: member.user.email,
    }));

  const parsedFilters = parsedQueryResult.success ? parsedQueryResult.data : {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Kanban Board · {project.name}
            </h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Bảng trực quan 4 cột (To Do → In Progress → Review → Done). Hỗ trợ kéo thả trên Desktop
            và nút thao tác nhanh trên bàn phím/di động.
          </p>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link href={`/projects/${project.id}`}>
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại Project</span>
          </Link>
        </Button>
      </div>

      <KanbanBoardClient
        projectId={project.id}
        currentUserId={actor.userId}
        initialBoard={board}
        sprints={sprints}
        assignableMembers={assignableMembers}
        initialFilters={{
          scope: board.scope,
          sprintId: board.selectedSprint?.id,
          search: parsedFilters.search,
          priority: parsedFilters.priority,
          assigneeId: parsedFilters.assigneeId,
          unassignedOnly: parsedFilters.unassignedOnly,
          overdueOnly: parsedFilters.overdueOnly,
        }}
      />
    </div>
  );
}
