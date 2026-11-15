import "server-only";
import { ProjectStatus, SprintStatus, UserStatus } from "@prisma/client";
import { badRequestError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { formatPgDateYmd, toBusinessCalendarYmd } from "@/lib/timezone";
import {
  listUnifiedActivityService,
  type ActivityFeedPageDTO,
} from "@/modules/activity/activity.service";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { hasPermission } from "@/modules/authorization/policy.service";
import { getUserUnreadNotificationCountService } from "@/modules/notifications/notification.service";
import {
  assertProjectReadAccess,
  buildAccessibleProjectsWhere,
  isWorkspaceAdmin,
} from "@/modules/projects/project.access";
import {
  computeProjectTimelineProgress,
  type ProjectTimelineProgressDTO,
} from "@/modules/projects/project-progress";
import { projectRepository } from "@/modules/projects/project.repository";
import {
  computeSprintTaskStats,
  type SprintTaskStatsDTO,
} from "@/modules/sprints/sprint.repository";
import type {
  MyAssignedTaskDTO,
  ProjectTaskSummaryStatsDTO,
} from "@/modules/tasks/task.repository";
import { taskRepository } from "@/modules/tasks/task.repository";
import { listMyAssignedTasksService } from "@/modules/tasks/task.service";
import { dashboardQuerySchema } from "@/modules/dashboard/dashboard.schema";
import type { AuthContext } from "@/types/auth";

export interface DashboardProjectOptionDTO {
  id: string;
  name: string;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  leaderName: string;
  activeMemberCount: number;
  updatedAt: string;
}

export interface DashboardSprintSummaryDTO {
  id: string;
  name: string;
  status: SprintStatus;
  startDate: string;
  endDate: string;
  taskStats: SprintTaskStatsDTO;
}

export interface OperationalDashboardDTO {
  permissions: {
    canReadAccounts: boolean;
    canManageRoles: boolean;
    canReadProjects: boolean;
    canCreateProject: boolean;
    canReadTasks: boolean;
    canReadSprints: boolean;
    canReadReports: boolean;
    canReadActivity: boolean;
    canReadNotifications: boolean;
  };
  accessibleProjects: DashboardProjectOptionDTO[];
  selectedProject: {
    id: string;
    name: string;
    status: ProjectStatus;
    isReadOnly: boolean;
    startDate: string | null;
    endDate: string | null;
    leaderName: string;
    activeMemberCount: number;
  } | null;
  workspaceProjectSummary: Awaited<
    ReturnType<typeof projectRepository.getDashboardProjectStats>
  > | null;
  accountSummary: {
    totalAccounts: number;
    pendingAccounts: number;
    activeAccounts: number;
  } | null;
  notificationSummary: {
    unreadCount: number;
  } | null;
  taskSummary: (ProjectTaskSummaryStatsDTO & { workProgressPercent: number }) | null;
  timelineProgress: ProjectTimelineProgressDTO | null;
  sprintSummary: DashboardSprintSummaryDTO | null;
  activeSprints: DashboardSprintSummaryDTO[];
  myAssignedTasks: MyAssignedTaskDTO[];
  recentActivity: {
    items: ActivityFeedPageDTO["items"];
    isMemberRestricted: boolean;
  } | null;
}

const PROJECT_STATUS_PRIORITY: Record<ProjectStatus, number> = {
  [ProjectStatus.ACTIVE]: 0,
  [ProjectStatus.CREATED]: 1,
  [ProjectStatus.ARCHIVED]: 2,
};

/**
 * Selects the default operational Dashboard Project strictly Active-first (`DEC-051`),
 * then most recently updated CREATED or ARCHIVED project (`DEC-053`).
 */
export function sortAndSelectDashboardProject<
  T extends { id: string; status: ProjectStatus; updatedAt: Date },
>(
  projects: readonly T[],
  requestedProjectId?: string
): {
  ordered: T[];
  selected: T | null;
} {
  const ordered = [...projects].sort((a, b) => {
    const statusDiff = PROJECT_STATUS_PRIORITY[a.status] - PROJECT_STATUS_PRIORITY[b.status];
    if (statusDiff !== 0) {
      return statusDiff;
    }
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  if (requestedProjectId) {
    const matched = ordered.find((p) => p.id === requestedProjectId) ?? null;
    return { ordered, selected: matched };
  }

  return { ordered, selected: ordered[0] ?? null };
}

/**
 * Loads the operational role-aware Dashboard (`DEC-051`, `DEC-052`, `DEC-053`, `P1-02`).
 * Requires only an active authenticated user and applies widget-level permission gating.
 */
export async function getOperationalDashboardService(
  actor: AuthContext,
  rawQuery: Record<string, unknown> = {},
  referenceNow: Date = new Date()
): Promise<OperationalDashboardDTO> {
  const parsed = dashboardQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    throw badRequestError(
      "Tham số projectId của Dashboard không hợp lệ.",
      parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "projectId",
        message: issue.message,
      }))
    );
  }

  const canReadAccounts = hasPermission(actor, PERMISSIONS.ACCOUNT_READ);
  const canManageRoles = hasPermission(actor, PERMISSIONS.ROLE_MANAGE);
  const canReadProjects = hasPermission(actor, PERMISSIONS.PROJECT_READ);
  const canCreateProject = hasPermission(actor, PERMISSIONS.PROJECT_CREATE);
  const canReadTasks = hasPermission(actor, PERMISSIONS.TASK_READ);
  const canReadSprints = hasPermission(actor, PERMISSIONS.SPRINT_READ);
  const canReadReports = hasPermission(actor, PERMISSIONS.REPORT_READ);
  const canReadActivity = hasPermission(actor, PERMISSIONS.ACTIVITY_READ);
  const canReadNotifications = hasPermission(actor, PERMISSIONS.NOTIFICATION_READ);

  const canInspectProjectSwitcher =
    canReadProjects || canReadTasks || canReadSprints || canReadReports || canReadActivity;

  if (parsed.data.projectId) {
    await assertProjectReadAccess(actor, parsed.data.projectId);
  }

  const [
    rawAccessibleProjects,
    workspaceProjectSummary,
    accountGroups,
    notificationSummary,
    myAssignedTasks,
  ] = await Promise.all([
    canInspectProjectSwitcher
      ? prisma.project.findMany({
          where: buildAccessibleProjectsWhere(actor),
          select: {
            id: true,
            name: true,
            status: true,
            startDate: true,
            endDate: true,
            updatedAt: true,
            leader: { select: { fullName: true } },
            _count: {
              select: {
                members: { where: { leftAt: null } },
              },
            },
          },
        })
      : Promise.resolve([]),
    canReadProjects
      ? projectRepository.getDashboardProjectStats({
          adminViewAll: isWorkspaceAdmin(actor),
          userId: actor.userId,
        })
      : Promise.resolve(null),
    canReadAccounts
      ? prisma.user.groupBy({
          by: ["status"],
          _count: { _all: true },
        })
      : Promise.resolve(null),
    canReadNotifications ? getUserUnreadNotificationCountService(actor) : Promise.resolve(null),
    canReadTasks ? listMyAssignedTasksService(actor, 6) : Promise.resolve([]),
  ]);

  const { ordered, selected } = sortAndSelectDashboardProject(
    rawAccessibleProjects,
    parsed.data.projectId
  );

  const accessibleProjects: DashboardProjectOptionDTO[] = ordered.map((project) => ({
    id: project.id,
    name: project.name,
    status: project.status,
    startDate: project.startDate ? toBusinessCalendarYmd(project.startDate) : null,
    endDate: project.endDate ? toBusinessCalendarYmd(project.endDate) : null,
    leaderName: project.leader.fullName,
    activeMemberCount: project._count.members,
    updatedAt: project.updatedAt.toISOString(),
  }));

  let accountSummary: OperationalDashboardDTO["accountSummary"] = null;
  if (accountGroups) {
    let totalAccounts = 0;
    let pendingAccounts = 0;
    let activeAccounts = 0;
    for (const row of accountGroups) {
      totalAccounts += row._count._all;
      if (row.status === UserStatus.PENDING) pendingAccounts += row._count._all;
      if (row.status === UserStatus.ACTIVE) activeAccounts += row._count._all;
    }
    accountSummary = { totalAccounts, pendingAccounts, activeAccounts };
  }

  if (!selected) {
    return {
      permissions: {
        canReadAccounts,
        canManageRoles,
        canReadProjects,
        canCreateProject,
        canReadTasks,
        canReadSprints,
        canReadReports,
        canReadActivity,
        canReadNotifications,
      },
      accessibleProjects,
      selectedProject: null,
      workspaceProjectSummary,
      accountSummary,
      notificationSummary,
      taskSummary: null,
      timelineProgress: null,
      sprintSummary: null,
      activeSprints: [],
      myAssignedTasks,
      recentActivity: null,
    };
  }

  const [rawTaskSummary, projectSprints, recentActivityFeed] = await Promise.all([
    canReadTasks ? taskRepository.findProjectTaskStats(selected.id) : Promise.resolve(null),
    canReadSprints
      ? prisma.sprint.findMany({
          where: {
            projectId: selected.id,
            status: { in: [SprintStatus.ACTIVE, SprintStatus.PLANNED, SprintStatus.COMPLETED] },
          },
          orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
          take: 50,
          select: {
            id: true,
            name: true,
            status: true,
            startDate: true,
            endDate: true,
            tasks: {
              select: {
                status: true,
                deadline: true,
                estimateHours: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    canReadActivity
      ? listUnifiedActivityService(actor, { projectId: selected.id, limit: 15 })
      : Promise.resolve(null),
  ]);

  let taskSummary: OperationalDashboardDTO["taskSummary"] = null;
  if (rawTaskSummary) {
    const workProgressPercent =
      rawTaskSummary.totalTasks > 0
        ? Math.round((rawTaskSummary.doneCount / rawTaskSummary.totalTasks) * 1000) / 10
        : 0;
    taskSummary = {
      ...rawTaskSummary,
      workProgressPercent,
    };
  }

  const activeSprintDtos: DashboardSprintSummaryDTO[] = projectSprints
    .filter((s) => s.status === SprintStatus.ACTIVE)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    .map((sprint) => ({
      id: sprint.id,
      name: sprint.name,
      status: sprint.status,
      startDate: formatPgDateYmd(sprint.startDate),
      endDate: formatPgDateYmd(sprint.endDate),
      taskStats: computeSprintTaskStats(sprint.tasks, referenceNow),
    }));

  const fallbackSprint =
    projectSprints.find((s) => s.status === SprintStatus.PLANNED) ?? projectSprints[0] ?? null;

  const chosenSprintDto: DashboardSprintSummaryDTO | null =
    activeSprintDtos[0] ??
    (fallbackSprint
      ? {
          id: fallbackSprint.id,
          name: fallbackSprint.name,
          status: fallbackSprint.status,
          startDate: formatPgDateYmd(fallbackSprint.startDate),
          endDate: formatPgDateYmd(fallbackSprint.endDate),
          taskStats: computeSprintTaskStats(fallbackSprint.tasks, referenceNow),
        }
      : null);

  const timelineProgress = computeProjectTimelineProgress(
    selected.startDate,
    selected.endDate,
    referenceNow
  );

  return {
    permissions: {
      canReadAccounts,
      canManageRoles,
      canReadProjects,
      canCreateProject,
      canReadTasks,
      canReadSprints,
      canReadReports,
      canReadActivity,
      canReadNotifications,
    },
    accessibleProjects,
    selectedProject: {
      id: selected.id,
      name: selected.name,
      status: selected.status,
      isReadOnly: selected.status === ProjectStatus.ARCHIVED,
      startDate: selected.startDate ? toBusinessCalendarYmd(selected.startDate) : null,
      endDate: selected.endDate ? toBusinessCalendarYmd(selected.endDate) : null,
      leaderName: selected.leader.fullName,
      activeMemberCount: selected._count.members,
    },
    workspaceProjectSummary,
    accountSummary,
    notificationSummary,
    taskSummary,
    timelineProgress,
    sprintSummary: chosenSprintDto,
    activeSprints: activeSprintDtos,
    myAssignedTasks,
    recentActivity: recentActivityFeed
      ? {
          items: recentActivityFeed.items,
          isMemberRestricted: recentActivityFeed.scope.hasRestrictedMemberProjects,
        }
      : null,
  };
}
