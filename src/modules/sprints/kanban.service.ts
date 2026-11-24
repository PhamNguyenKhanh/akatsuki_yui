import "server-only";
import { ProjectStatus, TaskStatus, type SprintStatus } from "@prisma/client";
import { AppError, badRequestError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { assertPermission, hasPermission } from "@/modules/authorization/policy.service";
import { assertProjectReadAccess, parseProjectId } from "@/modules/projects/project.access";
import { parseSprintInput } from "@/modules/sprints/sprint.access";
import { kanbanQuerySchema } from "@/modules/sprints/sprint.schema";
import {
  isProjectLeaderOrAdmin,
  isProjectReviewerOrLeaderOrAdmin,
} from "@/modules/tasks/task.access";
import {
  buildTaskProjectWhereInput,
  mapTaskSummary,
  taskSummarySelect,
  type TaskSummaryDTO,
} from "@/modules/tasks/task.repository";
import type { AuthContext } from "@/types/auth";

export interface KanbanTaskPermissionsDTO {
  canStartProgress: boolean;
  canSubmitReview: boolean;
  canApproveOrReject: boolean;
}

export interface KanbanCardItemDTO extends TaskSummaryDTO {
  permissions: KanbanTaskPermissionsDTO;
}

export interface KanbanBoardColumnsDTO {
  TODO: KanbanCardItemDTO[];
  IN_PROGRESS: KanbanCardItemDTO[];
  REVIEW: KanbanCardItemDTO[];
  DONE: KanbanCardItemDTO[];
}

export interface KanbanBoardDTO {
  project: {
    id: string;
    name: string;
    status: ProjectStatus;
  };
  scope: "PROJECT" | "SPRINT" | "BACKLOG";
  selectedSprint: {
    id: string;
    name: string;
    status: SprintStatus;
  } | null;
  totalTasks: number;
  truncated: boolean;
  columns: KanbanBoardColumnsDTO;
  counts: Record<TaskStatus, number>;
  capabilities: {
    isArchived: boolean;
    isLeaderOrAdmin: boolean;
    canManageSprint: boolean;
    canUpdateTask: boolean;
    canSubmitReview: boolean;
    canReviewTask: boolean;
    currentUserId: string;
  };
}

const MAX_KANBAN_CARDS = 250;

export async function getKanbanBoardService(
  actor: AuthContext,
  projectId: string,
  rawQuery: Record<string, unknown> = {}
): Promise<KanbanBoardDTO> {
  assertPermission(actor, PERMISSIONS.TASK_READ);
  assertPermission(actor, PERMISSIONS.SPRINT_READ);
  const validProjectId = parseProjectId(projectId);
  const query = parseSprintInput(
    kanbanQuerySchema,
    rawQuery,
    "Tham số lọc Kanban Board không hợp lệ."
  );

  const project = await assertProjectReadAccess(actor, validProjectId);
  const now = new Date();

  let scope: "PROJECT" | "SPRINT" | "BACKLOG" = "PROJECT";
  let effectiveBacklogOnly = false;
  let effectiveSprintId: string | undefined;
  let selectedSprint: KanbanBoardDTO["selectedSprint"] = null;

  if (query.scope === "BACKLOG" || query.backlogOnly === true) {
    scope = "BACKLOG";
    effectiveBacklogOnly = true;
  } else if (query.sprintId) {
    scope = "SPRINT";
    effectiveSprintId = query.sprintId;
    const sprint = await prisma.sprint.findUnique({
      where: { id: query.sprintId },
      select: { id: true, projectId: true, name: true, status: true },
    });
    if (!sprint) {
      throw new AppError({
        statusCode: 404,
        code: "SPRINT_NOT_FOUND",
        message: "Không tìm thấy Sprint được chọn trên Kanban.",
      });
    }
    if (sprint.projectId !== validProjectId) {
      throw badRequestError("Sprint được chọn không thuộc Project này.");
    }
    selectedSprint = {
      id: sprint.id,
      name: sprint.name,
      status: sprint.status,
    };
  }

  const where = buildTaskProjectWhereInput(
    validProjectId,
    {
      search: query.search,
      priority: query.priority,
      assigneeId: query.assigneeId,
      unassignedOnly: query.unassignedOnly,
      overdueOnly: query.overdueOnly,
      sprintId: effectiveSprintId,
      backlogOnly: effectiveBacklogOnly,
      deadlineFrom: query.deadlineFrom,
      deadlineTo: query.deadlineTo,
    },
    now
  );

  const [totalMatchingCount, rows] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      orderBy: [{ deadline: "asc" }, { priority: "desc" }, { createdAt: "asc" }],
      take: MAX_KANBAN_CARDS,
      select: taskSummarySelect,
    }),
  ]);

  const isArchived = project.status === ProjectStatus.ARCHIVED;
  const isLeaderOrAdmin = isProjectLeaderOrAdmin(actor, project);
  const canManageSprint =
    !isArchived && isLeaderOrAdmin && hasPermission(actor, PERMISSIONS.SPRINT_MANAGE);
  const canUpdateTask = !isArchived && hasPermission(actor, PERMISSIONS.TASK_UPDATE);
  const canSubmitReview = !isArchived && hasPermission(actor, PERMISSIONS.TASK_SUBMIT_REVIEW);
  const canReviewTask =
    !isArchived &&
    isProjectReviewerOrLeaderOrAdmin(actor, project) &&
    hasPermission(actor, PERMISSIONS.TASK_REVIEW);

  const columns: KanbanBoardColumnsDTO = {
    TODO: [],
    IN_PROGRESS: [],
    REVIEW: [],
    DONE: [],
  };

  for (const row of rows) {
    const summary = mapTaskSummary(row, now);
    const isAssignedToActor = summary.assignees.some(
      (assignee) => assignee.userId === actor.userId
    );
    const canActOnProgressOrSubmit = isLeaderOrAdmin || isAssignedToActor;

    const card: KanbanCardItemDTO = {
      ...summary,
      permissions: {
        canStartProgress:
          summary.status === TaskStatus.TODO && canUpdateTask && canActOnProgressOrSubmit,
        canSubmitReview:
          summary.status === TaskStatus.IN_PROGRESS && canSubmitReview && canActOnProgressOrSubmit,
        canApproveOrReject: summary.status === TaskStatus.REVIEW && canReviewTask,
      },
    };

    columns[card.status].push(card);
  }

  return {
    project: {
      id: project.id,
      name: project.name,
      status: project.status,
    },
    scope,
    selectedSprint,
    totalTasks: totalMatchingCount,
    truncated: totalMatchingCount > MAX_KANBAN_CARDS,
    columns,
    counts: {
      TODO: columns.TODO.length,
      IN_PROGRESS: columns.IN_PROGRESS.length,
      REVIEW: columns.REVIEW.length,
      DONE: columns.DONE.length,
    },
    capabilities: {
      isArchived,
      isLeaderOrAdmin,
      canManageSprint,
      canUpdateTask,
      canSubmitReview,
      canReviewTask,
      currentUserId: actor.userId,
    },
  };
}
