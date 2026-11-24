import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProjectStatus } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import type { TaskAssignableMemberOption } from "@/components/tasks/task-list-client";
import { Button } from "@/components/ui/button";
import { isAppError } from "@/lib/errors";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { hasPermission } from "@/modules/authorization/policy.service";
import { requirePermissionOrRedirect } from "@/modules/authorization/require-auth";
import { isAssignableProjectRole } from "@/modules/project-members/member.schema";
import { listProjectMembersService } from "@/modules/project-members/member.service";
import { isWorkspaceAdmin } from "@/modules/projects/project.access";
import {
  listTaskCommentsService,
  listTaskMentionableMembersService,
} from "@/modules/tasks/task-comment.service";
import { listTaskSubtasksService } from "@/modules/tasks/task-subtask.service";
import { listTaskHistoryService } from "@/modules/tasks/task-history.service";
import {
  getProjectMemberWorkloads,
  type TaskDetailDTO,
} from "@/modules/tasks/task.repository";
import { getTaskDetailService, listProjectTaskOptionsService } from "@/modules/tasks/task.service";

export const metadata: Metadata = {
  title: "Chi tiết công việc",
};

type TaskDetailPageProps = {
  params: Promise<{ projectId: string; taskId: string }>;
};

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.TASK_READ);
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
  const isAssignedMember = task.assignees.some((assignee) => assignee.userId === actor.userId);
  const canUpdateTask = hasPermission(actor, PERMISSIONS.TASK_UPDATE);
  const canAssignTask = hasPermission(actor, PERMISSIONS.TASK_ASSIGN);
  const canSubmitReview = hasPermission(actor, PERMISSIONS.TASK_SUBMIT_REVIEW);
  const canReviewTask = hasPermission(actor, PERMISSIONS.TASK_REVIEW);
  const canReadHistory = hasPermission(actor, PERMISSIONS.TASK_HISTORY_READ);

  const isArchived = task.project.status === ProjectStatus.ARCHIVED;

  const [
    members,
    candidateTasks,
    initialHistory,
    initialComments,
    mentionableMembers,
    initialSubtasks,
  ] = await Promise.all([
    !isArchived &&
    isLeaderOrAdmin &&
    canAssignTask &&
    hasPermission(actor, PERMISSIONS.PROJECT_READ)
      ? listProjectMembersService(actor, task.projectId, { includeHistory: false })
      : Promise.resolve([]),
    !isArchived && isLeaderOrAdmin && canUpdateTask
      ? listProjectTaskOptionsService(actor, task.projectId, task.id)
      : Promise.resolve([]),
    canReadHistory
      ? listTaskHistoryService(actor, task.id, { page: 1, pageSize: 10 })
      : Promise.resolve(null),
    listTaskCommentsService(actor, task.id),
    listTaskMentionableMembersService(actor, task.id),
    listTaskSubtasksService(actor, task.id),
  ]);

  const workloads =
    members.length > 0 ? await getProjectMemberWorkloads(task.projectId) : new Map();

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

  const isInstructorOnly = !isLeaderOrAdmin && !canUpdateTask && !canSubmitReview && !canReviewTask;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          <Link href="/projects" className="hover:underline">
            Projects
          </Link>{" "}
          /{" "}
          <Link href={`/projects/${task.projectId}`} className="hover:underline">
            {task.project.name}
          </Link>{" "}
          /{" "}
          <Link href={`/projects/${task.projectId}/tasks`} className="hover:underline">
            Tasks
          </Link>{" "}
          / <span className="font-mono text-slate-900">{task.code}</span>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/projects/${task.projectId}/tasks`}>
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại danh sách Tasks</span>
          </Link>
        </Button>
      </div>

      <TaskDetailPanel
        task={task}
        currentUserId={actor.userId}
        assignableMembers={assignableMembers}
        mentionableMembers={mentionableMembers}
        initialComments={initialComments}
        initialSubtasks={initialSubtasks}
        candidateTasks={candidateTasks}
        initialHistory={initialHistory}
        capabilities={{
          isLeaderOrAdmin,
          isAssignedMember,
          isInstructorOnly,
          canUpdateTask,
          canAssignTask,
          canSubmitReview,
          canReviewTask,
          canReadHistory,
        }}
      />
    </div>
  );
}
