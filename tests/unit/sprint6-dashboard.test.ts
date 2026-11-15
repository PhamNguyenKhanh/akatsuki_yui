import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectStatus, SprintStatus, TaskStatus, UserStatus } from "@prisma/client";
import { PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import type { AuthContext } from "@/types/auth";

vi.mock("server-only", () => ({}));

const {
  prismaMock,
  projectAccessMock,
  projectRepoMock,
  taskRepoMock,
  taskServiceMock,
  notificationServiceMock,
  activityServiceMock,
} = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findMany: vi.fn(),
    },
    user: {
      groupBy: vi.fn(),
    },
    sprint: {
      findMany: vi.fn(),
    },
  },
  projectAccessMock: {
    assertProjectReadAccess: vi.fn(),
    buildAccessibleProjectsWhere: vi.fn(() => ({ id: "scoped" })),
    isWorkspaceAdmin: vi.fn((actor: AuthContext) => actor.roles.includes(ROLES.ADMIN)),
  },
  projectRepoMock: {
    getDashboardProjectStats: vi.fn(),
  },
  taskRepoMock: {
    findProjectTaskStats: vi.fn(),
  },
  taskServiceMock: {
    listMyAssignedTasksService: vi.fn(),
  },
  notificationServiceMock: {
    getUserUnreadNotificationCountService: vi.fn(),
  },
  activityServiceMock: {
    listUnifiedActivityService: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/modules/projects/project.access", () => projectAccessMock);
vi.mock("@/modules/projects/project.repository", () => ({
  projectRepository: projectRepoMock,
}));
vi.mock("@/modules/tasks/task.repository", () => ({
  taskRepository: taskRepoMock,
}));
vi.mock("@/modules/tasks/task.service", () => taskServiceMock);
vi.mock("@/modules/notifications/notification.service", () => notificationServiceMock);
vi.mock("@/modules/activity/activity.service", () => activityServiceMock);

import {
  getOperationalDashboardService,
  sortAndSelectDashboardProject,
} from "@/modules/dashboard/dashboard.service";

const ACTIVE_PROJ_ID = "11111111-1111-4111-8111-111111111101";
const ARCHIVED_PROJ_ID = "11111111-1111-4111-8111-111111111102";
const CREATED_PROJ_ID = "11111111-1111-4111-8111-111111111103";

const leaderActor: AuthContext = {
  userId: "22222222-2222-4222-8222-222222222201",
  email: "leader@akatsuki.local",
  fullName: "Leader",
  status: UserStatus.ACTIVE,
  roles: [ROLES.LEADER],
  permissions: [
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.TASK_READ,
    PERMISSIONS.SPRINT_READ,
    PERMISSIONS.REPORT_READ,
    PERMISSIONS.ACTIVITY_READ,
    PERMISSIONS.NOTIFICATION_READ,
  ],
};

const minimalActor: AuthContext = {
  userId: "22222222-2222-4222-8222-222222222202",
  email: "minimal@akatsuki.local",
  fullName: "Minimal User",
  status: UserStatus.ACTIVE,
  roles: [ROLES.MEMBER],
  permissions: [], // No task.read, sprint.read, report.read, activity.read (P1-02!)
};

describe("Sprint 6 Package 6 — Operational Role-Aware Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prioritizes ACTIVE project first before CREATED and ARCHIVED (DEC-051, DEC-053)", () => {
    const { ordered, selected } = sortAndSelectDashboardProject([
      {
        id: ARCHIVED_PROJ_ID,
        status: ProjectStatus.ARCHIVED,
        updatedAt: new Date("2026-11-15T12:00:00Z"),
      },
      {
        id: CREATED_PROJ_ID,
        status: ProjectStatus.CREATED,
        updatedAt: new Date("2026-11-14T12:00:00Z"),
      },
      {
        id: ACTIVE_PROJ_ID,
        status: ProjectStatus.ACTIVE,
        updatedAt: new Date("2026-11-10T12:00:00Z"),
      },
    ]);

    expect(ordered.map((p) => p.id)).toEqual([ACTIVE_PROJ_ID, CREATED_PROJ_ID, ARCHIVED_PROJ_ID]);
    expect(selected?.id).toBe(ACTIVE_PROJ_ID);

    const switched = sortAndSelectDashboardProject(ordered, ARCHIVED_PROJ_ID);
    expect(switched.selected?.id).toBe(ARCHIVED_PROJ_ID);
  });

  it("returns separate Work Progress vs Project Timeline Progress, Active Sprint, and Activity <= 15 without requiring dashboard.read", async () => {
    prismaMock.project.findMany.mockResolvedValue([
      {
        id: ARCHIVED_PROJ_ID,
        name: "Archived Project",
        status: ProjectStatus.ARCHIVED,
        startDate: new Date("2026-10-01T00:00:00Z"),
        endDate: new Date("2026-10-31T00:00:00Z"),
        updatedAt: new Date("2026-11-14T00:00:00Z"),
        leader: { fullName: "Leader" },
        _count: { members: 4 },
      },
      {
        id: ACTIVE_PROJ_ID,
        name: "Active Project",
        status: ProjectStatus.ACTIVE,
        startDate: new Date("2026-11-01T00:00:00Z"),
        endDate: new Date("2026-11-30T00:00:00Z"),
        updatedAt: new Date("2026-11-10T00:00:00Z"),
        leader: { fullName: "Leader" },
        _count: { members: 5 },
      },
    ]);
    projectRepoMock.getDashboardProjectStats.mockResolvedValue({
      total: 2,
      createdCount: 0,
      activeCount: 1,
      archivedCount: 1,
      activeProject: null,
    });
    notificationServiceMock.getUserUnreadNotificationCountService.mockResolvedValue({
      unreadCount: 3,
    });
    taskServiceMock.listMyAssignedTasksService.mockResolvedValue([]);
    taskRepoMock.findProjectTaskStats.mockResolvedValue({
      totalTasks: 10,
      todoCount: 2,
      inProgressCount: 3,
      reviewCount: 2,
      doneCount: 3,
      overdueCount: 1,
    });
    prismaMock.sprint.findMany.mockResolvedValue([
      {
        id: "33333333-3333-4333-8333-333333333301",
        name: "Sprint Alpha",
        status: SprintStatus.ACTIVE,
        startDate: new Date("2026-11-10T00:00:00Z"),
        endDate: new Date("2026-11-20T00:00:00Z"),
        tasks: [],
      },
    ]);
    activityServiceMock.listUnifiedActivityService.mockResolvedValue({
      items: [],
      pageInfo: { nextCursor: null, hasNextPage: false, limit: 15 },
      scope: { isWorkspaceAdmin: false, hasRestrictedMemberProjects: false },
    });

    const refNow = new Date("2026-11-15T10:00:00+07:00");
    const dto = await getOperationalDashboardService(leaderActor, {}, refNow);

    expect(dto.selectedProject?.id).toBe(ACTIVE_PROJ_ID);
    expect(dto.selectedProject?.isReadOnly).toBe(false);
    expect(dto.taskSummary?.workProgressPercent).toBe(30); // 3/10 tasks DONE
    expect(dto.timelineProgress?.progressPercent).toBe(50); // 15/30 days elapsed
    expect(dto.notificationSummary?.unreadCount).toBe(3);
    expect(dto.sprintSummary?.name).toBe("Sprint Alpha");
    expect(activityServiceMock.listUnifiedActivityService).toHaveBeenCalledWith(leaderActor, {
      projectId: ACTIVE_PROJ_ID,
      limit: 15,
    });

    // Switching explicitly to ARCHIVED Project marks read-only without error
    const archivedDto = await getOperationalDashboardService(
      leaderActor,
      { projectId: ARCHIVED_PROJ_ID },
      refNow
    );
    expect(archivedDto.selectedProject?.id).toBe(ARCHIVED_PROJ_ID);
    expect(archivedDto.selectedProject?.isReadOnly).toBe(true);
    expect(projectAccessMock.assertProjectReadAccess).toHaveBeenCalledWith(
      leaderActor,
      ARCHIVED_PROJ_ID
    );
  });

  it("renders gracefully with 200-equivalent empty/gated widgets when actor lacks optional module permissions (P1-02)", async () => {
    const dto = await getOperationalDashboardService(minimalActor, {});

    expect(dto.selectedProject).toBeNull();
    expect(dto.accessibleProjects).toEqual([]);
    expect(dto.taskSummary).toBeNull();
    expect(dto.sprintSummary).toBeNull();
    expect(dto.activeSprints).toEqual([]);
    expect(dto.recentActivity).toBeNull();
    expect(dto.notificationSummary).toBeNull();
    expect(dto.myAssignedTasks).toEqual([]);
    expect(taskRepoMock.findProjectTaskStats).not.toHaveBeenCalled();
    expect(activityServiceMock.listUnifiedActivityService).not.toHaveBeenCalled();
  });

  it("exposes all concurrent ACTIVE sprints (DEC-006) and formats project dates with toBusinessCalendarYmd", async () => {
    prismaMock.project.findMany.mockResolvedValue([
      {
        id: ACTIVE_PROJ_ID,
        name: "Multi-Sprint Project",
        status: ProjectStatus.ACTIVE,
        // 2026-10-31T20:00:00Z === 2026-11-01 03:00 in Asia/Ho_Chi_Minh
        startDate: new Date("2026-10-31T20:00:00Z"),
        endDate: new Date("2026-11-30T16:59:59Z"),
        updatedAt: new Date("2026-11-15T10:00:00Z"),
        leader: { fullName: "Leader" },
        _count: { members: 4 },
      },
    ]);
    projectRepoMock.getDashboardProjectStats.mockResolvedValue({
      total: 1,
      createdCount: 0,
      activeCount: 1,
      archivedCount: 0,
      activeProject: null,
    });
    notificationServiceMock.getUserUnreadNotificationCountService.mockResolvedValue({
      unreadCount: 0,
    });
    taskServiceMock.listMyAssignedTasksService.mockResolvedValue([]);
    taskRepoMock.findProjectTaskStats.mockResolvedValue({
      totalTasks: 5,
      todoCount: 2,
      inProgressCount: 2,
      reviewCount: 0,
      doneCount: 1,
      overdueCount: 0,
    });
    prismaMock.sprint.findMany.mockResolvedValue([
      {
        id: "33333333-3333-4333-8333-333333333301",
        name: "Sprint Backend",
        status: SprintStatus.ACTIVE,
        startDate: new Date("2026-11-01T00:00:00Z"),
        endDate: new Date("2026-11-15T00:00:00Z"),
        tasks: [
          { status: TaskStatus.DONE, deadline: new Date("2026-11-15T00:00:00Z"), estimateHours: 4 },
          { status: TaskStatus.TODO, deadline: new Date("2026-11-15T00:00:00Z"), estimateHours: 4 },
        ],
      },
      {
        id: "33333333-3333-4333-8333-333333333302",
        name: "Sprint Frontend",
        status: SprintStatus.ACTIVE,
        startDate: new Date("2026-11-05T00:00:00Z"),
        endDate: new Date("2026-11-20T00:00:00Z"),
        tasks: [
          {
            status: TaskStatus.IN_PROGRESS,
            deadline: new Date("2026-11-20T00:00:00Z"),
            estimateHours: 6,
          },
        ],
      },
    ]);
    activityServiceMock.listUnifiedActivityService.mockResolvedValue({
      items: [],
      pageInfo: { nextCursor: null, hasNextPage: false, limit: 15 },
      scope: { isWorkspaceAdmin: false, hasRestrictedMemberProjects: false },
    });

    const refNow = new Date("2026-11-10T10:00:00+07:00");
    const dto = await getOperationalDashboardService(leaderActor, {}, refNow);

    expect(dto.timelineProgress?.startDate).toBe("2026-11-01");
    expect(dto.timelineProgress?.endDate).toBe("2026-11-30");
    expect(dto.activeSprints).toHaveLength(2);
    expect(dto.activeSprints.map((s) => s.name)).toEqual(["Sprint Backend", "Sprint Frontend"]);
    expect(dto.activeSprints[0].taskStats.progressPercent).toBe(50);
    expect(dto.sprintSummary?.id).toBe("33333333-3333-4333-8333-333333333301");
  });
});
