import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProjectMemberRole } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import { ProjectStatusBadge } from "@/components/shared/status-badge";
import {
  TaskListClient,
  type TaskAssignableMemberOption,
} from "@/components/tasks/task-list-client";
import { Button } from "@/components/ui/button";
import { isAppError } from "@/lib/errors";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { hasPermission } from "@/modules/authorization/policy.service";
import { requirePermissionOrRedirect } from "@/modules/authorization/require-auth";
import { listProjectMembersService } from "@/modules/project-members/member.service";
import { isWorkspaceAdmin } from "@/modules/projects/project.access";
import type { ProjectDTO } from "@/modules/projects/project.repository";
import { getProjectDetailService } from "@/modules/projects/project.service";
import { taskListQuerySchema } from "@/modules/tasks/task.schema";
import { listProjectTasksService } from "@/modules/tasks/task.service";

export const metadata: Metadata = {
  title: "Danh sách công việc",
};

type ProjectTasksPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectTasksPage({ params, searchParams }: ProjectTasksPageProps) {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.TASK_READ);
  const { projectId } = await params;
  const resolvedSearchParams = await searchParams;

  const rawQuery: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (typeof single === "string" && single.trim().length > 0) {
      rawQuery[key] = single.trim();
    }
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

  const normalizedQueryResult = taskListQuerySchema.safeParse(rawQuery);
  const effectiveQuery = normalizedQueryResult.success ? rawQuery : {};

  const canReadMembers = hasPermission(actor, PERMISSIONS.PROJECT_READ);
  const [tasksPage, members] = await Promise.all([
    listProjectTasksService(actor, project.id, effectiveQuery),
    canReadMembers
      ? listProjectMembersService(actor, project.id, { includeHistory: false })
      : Promise.resolve([]),
  ]);

  const assignableMembers: TaskAssignableMemberOption[] = members
    .filter((member) => member.projectRole !== ProjectMemberRole.INSTRUCTOR)
    .map((member) => ({
      userId: member.userId,
      fullName: member.user.fullName,
      email: member.user.email,
    }));

  const isAdminOrLeader = isWorkspaceAdmin(actor) || project.leaderId === actor.userId;
  const canCreateTask = hasPermission(actor, PERMISSIONS.TASK_CREATE) && isAdminOrLeader;

  const parsedFilters = normalizedQueryResult.success
    ? normalizedQueryResult.data
    : taskListQuerySchema.parse({});

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Công việc · {project.name}
            </h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Quản lý danh sách Task, phân công thực hiện, phụ thuộc và quy trình duyệt kết quả.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/projects/${project.id}`}>
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại Project</span>
          </Link>
        </Button>
      </div>

      <TaskListClient
        projectId={project.id}
        projectName={project.name}
        projectStatus={project.status}
        tasks={tasksPage.items}
        totalItems={tasksPage.totalItems}
        page={tasksPage.page}
        totalPages={tasksPage.totalPages}
        canCreateTask={canCreateTask}
        assignableMembers={assignableMembers}
        initialFilters={{
          search: parsedFilters.search,
          status: parsedFilters.status,
          priority: parsedFilters.priority,
          assigneeId: parsedFilters.assigneeId,
          unassignedOnly: parsedFilters.unassignedOnly,
          overdueOnly: parsedFilters.overdueOnly,
          sortBy: parsedFilters.sortBy,
          sortOrder: parsedFilters.sortOrder,
        }}
      />
    </div>
  );
}
