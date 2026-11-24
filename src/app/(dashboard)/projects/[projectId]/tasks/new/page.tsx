import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProjectStatus } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import { TaskForm } from "@/components/tasks/task-form";
import type { TaskAssignableMemberOption } from "@/components/tasks/task-list-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { getProjectMemberWorkloads } from "@/modules/tasks/task.repository";

export const metadata: Metadata = {
  title: "Tạo Task mới",
};

type NewTaskPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewTaskPage({ params, searchParams }: NewTaskPageProps) {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.TASK_CREATE);
  const { projectId } = await params;
  const query = await searchParams;
  const initialTitle = typeof query.title === "string" ? query.title.slice(0, 200) : undefined;
  const initialDescription =
    typeof query.description === "string" ? query.description.slice(0, 4000) : undefined;

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

  const [members, workloads] = hasPermission(actor, PERMISSIONS.PROJECT_READ)
    ? await Promise.all([
        listProjectMembersService(actor, project.id, { includeHistory: false }),
        getProjectMemberWorkloads(project.id),
      ])
    : [[], new Map()];

  const assignableMembers: TaskAssignableMemberOption[] = members
    .filter((member) => isAssignableProjectRole(member.projectRole))
    .map((member) => {
      const w = workloads.get(member.userId);
      return {
        userId: member.userId,
        fullName: member.user.fullName,
        email: member.user.email,
        activeTaskCount: w?.activeTaskCount ?? 0,
        activeEstimateHours: w?.activeEstimateHours ?? 0,
      };
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Tạo Task mới · {project.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Khởi tạo công việc mới và phân công thành viên thực hiện trong Project.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/projects/${project.id}/tasks`}>
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại danh sách Tasks</span>
          </Link>
        </Button>
      </div>

      {project.status === ProjectStatus.ARCHIVED ? (
        <Alert variant="destructive">
          <AlertTitle>Project đang ở trạng thái ARCHIVED</AlertTitle>
          <AlertDescription>
            Theo quy định, không thể tạo Task mới trong Project đã Archive. Admin cần
            khôi phục Project về CREATED hoặc ACTIVE trước.
          </AlertDescription>
        </Alert>
      ) : (
        <TaskForm
          mode="create"
          projectId={project.id}
          initialValues={{ title: initialTitle, description: initialDescription }}
          assignableMembers={assignableMembers}
          canAssignOnCreate={hasPermission(actor, PERMISSIONS.TASK_ASSIGN)}
        />
      )}
    </div>
  );
}
