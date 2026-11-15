import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ProjectMemberRole,
  ProjectStatus,
  SprintStatus,
  TaskHistoryAction,
  TaskPriority,
  TaskStatus,
  UserStatus,
} from "@prisma/client";
import { AppError } from "@/lib/errors";
import { PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import type { AuthContext } from "@/types/auth";

vi.mock("server-only", () => ({}));

const { prismaMock, sprintRepoMock, taskRepoMock, taskHistoryRepoMock } = vi.hoisted(() => {
  const txMock = {
    $queryRaw: vi.fn(),
    project: {
      findUnique: vi.fn(),
    },
    projectMember: {
      findMany: vi.fn(),
    },
    sprint: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    task: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  txMock.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => unknown) => fn(txMock));

  return {
    prismaMock: txMock,
    sprintRepoMock: {
      findManyByProject: vi.fn(),
      findSummaryById: vi.fn(),
      findDetailById: vi.fn(),
      findOverlappingSprints: vi.fn(),
      findAvailablePlanningSprints: vi.fn(),
      findCompletionPreviewData: vi.fn(),
      findBurndownSourceData: vi.fn(),
    },
    taskRepoMock: {
      findManyByProjectPaginated: vi.fn(),
      findSummaryById: vi.fn(),
      findDetailById: vi.fn(),
    },
    taskHistoryRepoMock: {
      appendTaskHistory: vi.fn(),
      appendManyTaskHistories: vi.fn(),
      findTaskHistoryPaginated: vi.fn(),
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/modules/sprints/sprint.repository", async () => {
  const actual = await vi.importActual<typeof import("@/modules/sprints/sprint.repository")>(
    "@/modules/sprints/sprint.repository"
  );
  return {
    ...actual,
    sprintRepository: sprintRepoMock,
  };
});

vi.mock("@/modules/tasks/task.repository", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tasks/task.repository")>(
    "@/modules/tasks/task.repository"
  );
  return {
    ...actual,
    taskRepository: taskRepoMock,
  };
});

vi.mock("@/modules/tasks/task-history.repository", () => ({
  taskHistoryRepository: taskHistoryRepoMock,
}));

import { getKanbanBoardService } from "@/modules/sprints/kanban.service";
import {
  BURNDOWN_TIMEZONE,
  computeSprintBurndownAnalytics,
  getSprintProgressAndBurndownService,
} from "@/modules/sprints/sprint-analytics.service";
import { completeSprintService } from "@/modules/sprints/sprint-completion.service";
import {
  assignTasksToSprintService,
  listBacklogTasksService,
  listSprintBacklogCandidatesService,
  moveSprintTaskService,
} from "@/modules/sprints/sprint-planning.service";
import { computeSprintTaskStats } from "@/modules/sprints/sprint.repository";
import {
  completeSprintSchema,
  createSprintSchema,
  kanbanQuerySchema,
  sprintPlanningAssignSchema,
  updateSprintSchema,
} from "@/modules/sprints/sprint.schema";
import {
  activateSprintService,
  cancelSprintService,
  createSprintService,
  updateSprintService,
} from "@/modules/sprints/sprint.service";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const SPRINT_ID = "22222222-2222-4222-8222-222222222222";
const SPRINT_2_ID = "33333333-3333-4333-8333-333333333333";
const TASK_1_ID = "44444444-4444-4444-8444-444444444444";
const TASK_2_ID = "55555555-5555-4555-8555-555555555555";
const LEADER_ID = "66666666-6666-4666-8666-666666666666";
const MEMBER_ID = "77777777-7777-4777-8777-777777777777";
const INSTRUCTOR_ID = "88888888-8888-4888-8888-888888888888";

const leaderActor: AuthContext = {
  userId: LEADER_ID,
  email: "leader@akatsuki.local",
  fullName: "Leader User",
  status: UserStatus.ACTIVE,
  roles: [ROLES.LEADER],
  permissions: [
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.TASK_READ,
    PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.TASK_SUBMIT_REVIEW,
    PERMISSIONS.TASK_REVIEW,
    PERMISSIONS.SPRINT_MANAGE,
    PERMISSIONS.SPRINT_READ,
  ],
};

const memberActor: AuthContext = {
  userId: MEMBER_ID,
  email: "member@akatsuki.local",
  fullName: "Member User",
  status: UserStatus.ACTIVE,
  roles: [ROLES.MEMBER],
  permissions: [
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.TASK_READ,
    PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.TASK_SUBMIT_REVIEW,
    PERMISSIONS.SPRINT_READ,
  ],
};

const instructorActor: AuthContext = {
  userId: INSTRUCTOR_ID,
  email: "instructor@akatsuki.local",
  fullName: "Instructor User",
  status: UserStatus.ACTIVE,
  roles: [ROLES.INSTRUCTOR],
  permissions: [PERMISSIONS.PROJECT_READ, PERMISSIONS.TASK_READ, PERMISSIONS.SPRINT_READ],
};

function makeProjectRecord(status: ProjectStatus = ProjectStatus.ACTIVE) {
  return {
    id: PROJECT_ID,
    name: "Akatsuki Sprint 4 Project",
    status,
    leaderId: LEADER_ID,
    instructorId: INSTRUCTOR_ID,
    members: [
      { userId: LEADER_ID, projectRole: ProjectMemberRole.LEADER },
      { userId: MEMBER_ID, projectRole: ProjectMemberRole.MEMBER },
    ],
  };
}

function makeSprintRecord(
  overrides: Partial<{
    id: string;
    projectId: string;
    status: SprintStatus;
    startDate: Date;
    endDate: Date;
    updatedAt: Date;
  }> = {}
) {
  return {
    id: overrides.id ?? SPRINT_ID,
    projectId: overrides.projectId ?? PROJECT_ID,
    createdById: LEADER_ID,
    name: "Sprint 1",
    goal: "Complete Auth & Core Sprint",
    startDate: overrides.startDate ?? new Date("2026-11-01T00:00:00.000Z"),
    endDate: overrides.endDate ?? new Date("2026-11-10T00:00:00.000Z"),
    status: overrides.status ?? SprintStatus.PLANNED,
    activatedAt: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: new Date("2026-11-01T00:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-11-01T01:00:00.000Z"),
  };
}

describe("Sprint 4 Business Rules & Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$queryRaw.mockResolvedValue([]);
  });

  describe("1. Zod Schemas & Rejected Option Guards", () => {
    it("rejects empty Sprint name, endDate < startDate, empty taskIds, and removed KEEP_IN_SPRINT disposition", () => {
      expect(
        createSprintSchema.safeParse({
          name: "ab",
          startDate: "2026-11-10",
          endDate: "2026-11-15",
        }).success
      ).toBe(false);

      expect(
        createSprintSchema.safeParse({
          name: "Sprint Valid",
          startDate: "2026-11-15",
          endDate: "2026-11-10",
        }).success
      ).toBe(false);

      expect(sprintPlanningAssignSchema.safeParse({ taskIds: [] }).success).toBe(false);

      // DEC-031: KEEP_IN_SPRINT is permanently removed
      const legacyDisposition = completeSprintSchema.safeParse({
        taskDispositions: [{ taskId: TASK_1_ID, action: "KEEP_IN_SPRINT" }],
      });
      expect(legacyDisposition.success).toBe(false);

      // MOVE_TO_SPRINT requires targetSprintId; MOVE_TO_BACKLOG forbids targetSprintId
      expect(
        completeSprintSchema.safeParse({
          taskDispositions: [{ taskId: TASK_1_ID, action: "MOVE_TO_SPRINT" }],
        }).success
      ).toBe(false);
      expect(
        completeSprintSchema.safeParse({
          taskDispositions: [
            { taskId: TASK_1_ID, action: "MOVE_TO_BACKLOG", targetSprintId: SPRINT_2_ID },
          ],
        }).success
      ).toBe(false);
    });

    it("rejects conflicting Kanban filters (backlogOnly + sprintId, or SPRINT scope without sprintId)", () => {
      expect(
        kanbanQuerySchema.safeParse({
          sprintId: SPRINT_ID,
          backlogOnly: true,
        }).success
      ).toBe(false);

      expect(
        kanbanQuerySchema.safeParse({
          scope: "SPRINT",
        }).success
      ).toBe(false);

      expect(
        updateSprintSchema.safeParse({
          startDate: "2026-11-05",
          endDate: "2026-11-01",
        }).success
      ).toBe(false);
    });
  });

  describe("2. Authorization Matrix & Project ARCHIVED Lock", () => {
    it("blocks MEMBER and INSTRUCTOR from creating, activating, cancelling, planning, or completing Sprints", async () => {
      for (const actor of [memberActor, instructorActor]) {
        await expect(
          createSprintService(actor, PROJECT_ID, {
            name: "Unauthorized Sprint",
            startDate: "2026-11-01",
            endDate: "2026-11-14",
          })
        ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });

        await expect(activateSprintService(actor, SPRINT_ID)).rejects.toMatchObject({
          statusCode: 403,
          code: "FORBIDDEN",
        });

        await expect(cancelSprintService(actor, SPRINT_ID)).rejects.toMatchObject({
          statusCode: 403,
          code: "FORBIDDEN",
        });

        await expect(
          assignTasksToSprintService(actor, SPRINT_ID, { taskIds: [TASK_1_ID] })
        ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });

        await expect(
          moveSprintTaskService(actor, SPRINT_ID, TASK_1_ID, { targetSprintId: null })
        ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });

        await expect(
          completeSprintService(actor, SPRINT_ID, { taskDispositions: [] })
        ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
      }
    });

    it("locks Sprint & Planning mutations with 409 PROJECT_ARCHIVED while allowing read views", async () => {
      prismaMock.project.findUnique.mockResolvedValue(makeProjectRecord(ProjectStatus.ARCHIVED));
      prismaMock.sprint.findUnique.mockResolvedValue(makeSprintRecord());

      await expect(
        createSprintService(leaderActor, PROJECT_ID, {
          name: "Locked Sprint",
          startDate: "2026-11-01",
          endDate: "2026-11-14",
        })
      ).rejects.toMatchObject({ statusCode: 409, code: "PROJECT_ARCHIVED" });

      await expect(activateSprintService(leaderActor, SPRINT_ID)).rejects.toMatchObject({
        statusCode: 409,
        code: "PROJECT_ARCHIVED",
      });

      await expect(
        assignTasksToSprintService(leaderActor, SPRINT_ID, { taskIds: [TASK_1_ID] })
      ).rejects.toMatchObject({ statusCode: 409, code: "PROJECT_ARCHIVED" });

      taskRepoMock.findManyByProjectPaginated.mockResolvedValue({
        items: [],
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 1,
      });

      const backlog = await listBacklogTasksService(instructorActor, PROJECT_ID, {});
      expect(backlog.items).toEqual([]);
    });
  });

  describe("3. Sprint Lifecycle Rules (DEC-026, DEC-027, DEC-028)", () => {
    it("blocks activating a Sprint when Project is still CREATED (DEC-026)", async () => {
      prismaMock.sprint.findUnique.mockResolvedValue(
        makeSprintRecord({ status: SprintStatus.PLANNED })
      );
      prismaMock.project.findUnique.mockResolvedValue(makeProjectRecord(ProjectStatus.CREATED));

      await expect(activateSprintService(leaderActor, SPRINT_ID)).rejects.toMatchObject({
        statusCode: 409,
        code: "INVALID_STATUS_TRANSITION",
      });
    });

    it("locks startDate modification while Sprint is ACTIVE, and locks all edits when COMPLETED/CANCELLED (DEC-027)", async () => {
      prismaMock.project.findUnique.mockResolvedValue(makeProjectRecord(ProjectStatus.ACTIVE));

      prismaMock.sprint.findUnique.mockResolvedValue(
        makeSprintRecord({ status: SprintStatus.ACTIVE })
      );

      await expect(
        updateSprintService(leaderActor, SPRINT_ID, {
          startDate: "2026-11-03",
        })
      ).rejects.toMatchObject({ statusCode: 409, code: "SPRINT_INVALID_STATUS" });

      prismaMock.sprint.findUnique.mockResolvedValue(
        makeSprintRecord({ status: SprintStatus.COMPLETED })
      );
      await expect(
        updateSprintService(leaderActor, SPRINT_ID, { name: "After Complete" })
      ).rejects.toMatchObject({ statusCode: 409, code: "SPRINT_INVALID_STATUS" });

      prismaMock.sprint.findUnique.mockResolvedValue(
        makeSprintRecord({ status: SprintStatus.CANCELLED })
      );
      await expect(
        updateSprintService(leaderActor, SPRINT_ID, { name: "After Cancel" })
      ).rejects.toMatchObject({ statusCode: 409, code: "SPRINT_INVALID_STATUS" });
    });

    it("forbids cancelling an ACTIVE Sprint (DEC-028: ACTIVE must use Complete Sprint)", async () => {
      prismaMock.project.findUnique.mockResolvedValue(makeProjectRecord(ProjectStatus.ACTIVE));
      prismaMock.sprint.findUnique.mockResolvedValue(
        makeSprintRecord({ status: SprintStatus.ACTIVE })
      );

      await expect(cancelSprintService(leaderActor, SPRINT_ID)).rejects.toMatchObject({
        statusCode: 409,
        code: "INVALID_STATUS_TRANSITION",
      });
    });
  });

  describe("4. Sprint Completion Strict Disposition & Concurrent Guard (DEC-031)", () => {
    it("rejects completing Sprint if any unfinished Task lacks an explicit disposition", async () => {
      prismaMock.project.findUnique.mockResolvedValue(makeProjectRecord(ProjectStatus.ACTIVE));
      prismaMock.sprint.findUnique.mockResolvedValue(
        makeSprintRecord({ status: SprintStatus.ACTIVE })
      );
      prismaMock.task.findMany.mockResolvedValue([
        { id: TASK_1_ID, title: "Task Incomplete", status: TaskStatus.IN_PROGRESS },
        { id: TASK_2_ID, title: "Task Finished", status: TaskStatus.DONE },
      ]);

      await expect(
        completeSprintService(leaderActor, SPRINT_ID, {
          taskDispositions: [],
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "SPRINT_UNFINISHED_TASKS_REQUIRE_DISPOSITION",
      });
    });

    it("rejects completing Sprint with CONFLICT when client submits stale disposition for a Task that just became DONE", async () => {
      prismaMock.project.findUnique.mockResolvedValue(makeProjectRecord(ProjectStatus.ACTIVE));
      prismaMock.sprint.findUnique.mockResolvedValue(
        makeSprintRecord({ status: SprintStatus.ACTIVE })
      );
      prismaMock.task.findMany.mockResolvedValue([
        { id: TASK_1_ID, title: "Recently Approved Task", status: TaskStatus.DONE },
      ]);

      await expect(
        completeSprintService(leaderActor, SPRINT_ID, {
          taskDispositions: [
            {
              taskId: TASK_1_ID,
              action: "MOVE_TO_BACKLOG",
              expectedStatus: TaskStatus.REVIEW,
            },
          ],
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "CONFLICT",
      });
    });
  });

  describe("5. Progress & Burndown Calculations (DEC-017, DEC-033)", () => {
    it("calculates progress strictly by DONE Task Count / Total Tasks (not by estimate hours)", () => {
      const stats = computeSprintTaskStats(
        [
          {
            status: TaskStatus.DONE,
            deadline: new Date("2026-11-20T00:00:00.000Z"),
            estimateHours: 1,
          },
          {
            status: TaskStatus.TODO,
            deadline: new Date("2026-11-20T00:00:00.000Z"),
            estimateHours: 99,
          },
        ],
        new Date("2026-11-10T00:00:00.000Z")
      );

      // 1 of 2 tasks is DONE -> 50% (NOT 1%)
      expect(stats.progressPercent).toBe(50);
      expect(stats.totalTasks).toBe(2);
      expect(stats.doneCount).toBe(1);
      expect(stats.totalEstimateHours).toBe(100);
      expect(stats.completedEstimateHours).toBe(1);
      expect(stats.remainingEstimateHours).toBe(99);
    });

    it("returns insufficient-data state when Sprint has no Estimate Hours", async () => {
      prismaMock.sprint.findUnique.mockResolvedValue(makeSprintRecord());
      prismaMock.project.findUnique.mockResolvedValue(makeProjectRecord(ProjectStatus.ACTIVE));
      sprintRepoMock.findBurndownSourceData.mockResolvedValue({
        sprint: makeSprintRecord({ status: SprintStatus.ACTIVE }),
        tasks: [
          {
            id: TASK_1_ID,
            title: "No Estimate Task",
            status: TaskStatus.TODO,
            sprintId: SPRINT_ID,
            deadline: new Date("2026-11-10T00:00:00.000Z"),
            estimateHours: null,
            completedAt: null,
            createdAt: new Date("2026-11-01T00:00:00.000Z"),
          },
        ],
        historyEvents: [],
      });

      const analytics = await getSprintProgressAndBurndownService(instructorActor, SPRINT_ID);
      expect(analytics.burndown.hasEstimateData).toBe(false);
      expect(analytics.burndown.timezone).toBe(BURNDOWN_TIMEZONE);
      expect(analytics.burndown.insufficientDataMessage).toBeTruthy();
      expect(analytics.burndown.points).toEqual([]);
    });

    it("reconstructs Ideal and Actual Remaining Hours series across Asia/Ho_Chi_Minh days with scope additions, removals, and completions", () => {
      const sprintStart = new Date("2026-11-01T00:00:00.000Z");
      const sprintEnd = new Date("2026-11-04T00:00:00.000Z");

      // Reference time: 2026-11-03 10:00 +07:00
      const now = new Date("2026-11-03T10:00:00+07:00");

      const analytics = computeSprintBurndownAnalytics(
        {
          sprint: {
            id: SPRINT_ID,
            projectId: PROJECT_ID,
            name: "Sprint 1",
            startDate: sprintStart,
            endDate: sprintEnd,
            status: SprintStatus.ACTIVE,
            activatedAt: new Date("2026-11-01T01:00:00+07:00"),
            completedAt: null,
            cancelledAt: null,
            createdAt: new Date("2026-10-30T00:00:00Z"),
          },
          tasks: [
            // Task 1 (10h): assigned Nov 1, completed Nov 2 18:00 +07:00
            {
              id: TASK_1_ID,
              title: "Initial Task Completed Day 2",
              status: TaskStatus.DONE,
              sprintId: SPRINT_ID,
              deadline: new Date("2026-11-04T00:00:00.000Z"),
              estimateHours: 10,
              completedAt: new Date("2026-11-02T18:00:00+07:00"),
              createdAt: new Date("2026-10-31T00:00:00Z"),
            },
            // Task 2 (6h): assigned Nov 2, remains in progress
            {
              id: TASK_2_ID,
              title: "Scope Added Day 2",
              status: TaskStatus.IN_PROGRESS,
              sprintId: SPRINT_ID,
              deadline: new Date("2026-11-04T00:00:00.000Z"),
              estimateHours: 6,
              completedAt: null,
              createdAt: new Date("2026-10-31T00:00:00Z"),
            },
            // Task 3 (4h): assigned Nov 1, removed to Backlog Nov 3
            {
              id: "99999999-9999-4999-8999-999999999999",
              title: "Removed On Day 3",
              status: TaskStatus.TODO,
              sprintId: null,
              deadline: new Date("2026-11-04T00:00:00.000Z"),
              estimateHours: 4,
              completedAt: null,
              createdAt: new Date("2026-10-31T00:00:00Z"),
            },
          ],
          historyEvents: [
            {
              id: "evt-1",
              taskId: TASK_1_ID,
              action: TaskHistoryAction.SPRINT_ASSIGNED,
              oldValue: { sprintId: null },
              newValue: { sprintId: SPRINT_ID, sprintName: "Sprint 1" },
              createdAt: new Date("2026-11-01T08:00:00+07:00"),
            },
            {
              id: "evt-2",
              taskId: "99999999-9999-4999-8999-999999999999",
              action: TaskHistoryAction.SPRINT_ASSIGNED,
              oldValue: { sprintId: null },
              newValue: { sprintId: SPRINT_ID, sprintName: "Sprint 1" },
              createdAt: new Date("2026-11-01T08:30:00+07:00"),
            },
            {
              id: "evt-3",
              taskId: TASK_2_ID,
              action: TaskHistoryAction.SPRINT_ASSIGNED,
              oldValue: { sprintId: null },
              newValue: { sprintId: SPRINT_ID, sprintName: "Sprint 1" },
              createdAt: new Date("2026-11-02T09:00:00+07:00"),
            },
            {
              id: "evt-4",
              taskId: "99999999-9999-4999-8999-999999999999",
              action: TaskHistoryAction.SPRINT_REMOVED,
              oldValue: { sprintId: SPRINT_ID, sprintName: "Sprint 1" },
              newValue: { sprintId: null },
              createdAt: new Date("2026-11-03T11:00:00+07:00"),
            },
          ],
        },
        now
      );

      expect(analytics.burndown.hasEstimateData).toBe(true);
      expect(analytics.burndown.baselineHours).toBe(14); // Day 1: 10 + 4
      expect(analytics.burndown.points).toHaveLength(4);

      const [d1, d2, d3, d4] = analytics.burndown.points;
      // Nov 1: 14h remaining (Tasks 1 & 3)
      expect(d1.date).toBe("2026-11-01");
      expect(d1.actualRemainingHours).toBe(14);
      // Nov 2: Task 2 (+6h) added, Task 1 (-10h) completed => 4 + 6 = 10h remaining
      expect(d2.date).toBe("2026-11-02");
      expect(d2.actualRemainingHours).toBe(10);
      // Nov 3: Task 3 (-4h) removed => 6h remaining
      expect(d3.date).toBe("2026-11-03");
      expect(d3.actualRemainingHours).toBe(6);
      // Nov 4 (future): null actualRemainingHours, ideal = 0
      expect(d4.date).toBe("2026-11-04");
      expect(d4.actualRemainingHours).toBeNull();
      expect(d4.idealRemainingHours).toBe(0);
    });

    it("computes per-card Kanban capabilities accurately for Member vs Leader vs Instructor", async () => {
      prismaMock.project.findUnique.mockResolvedValue(makeProjectRecord(ProjectStatus.ACTIVE));
      prismaMock.task.count.mockResolvedValue(2);
      prismaMock.task.findMany.mockResolvedValue([
        {
          id: TASK_1_ID,
          projectId: PROJECT_ID,
          sprintId: SPRINT_ID,
          sprint: { id: SPRINT_ID, name: "Sprint 1", status: SprintStatus.ACTIVE },
          createdById: LEADER_ID,
          createdBy: { id: LEADER_ID, fullName: "Leader", email: "l@akatsuki.local" },
          title: "Assigned Member Task",
          description: null,
          priority: TaskPriority.HIGH,
          status: TaskStatus.TODO,
          startDate: null,
          deadline: new Date("2026-11-20T00:00:00.000Z"),
          estimateHours: 4,
          referenceLinks: [],
          progressNotes: null,
          completedAt: null,
          createdAt: new Date("2026-11-01T00:00:00.000Z"),
          updatedAt: new Date("2026-11-01T00:00:00.000Z"),
          assignees: [
            {
              id: "a1",
              taskId: TASK_1_ID,
              userId: MEMBER_ID,
              assignedById: LEADER_ID,
              assignedAt: new Date(),
              user: {
                id: MEMBER_ID,
                fullName: "Member",
                email: "m@akatsuki.local",
                status: UserStatus.ACTIVE,
              },
              assignedBy: { id: LEADER_ID, fullName: "Leader", email: "l@akatsuki.local" },
            },
          ],
          dependencies: [],
          _count: { dependents: 0 },
        },
        {
          id: TASK_2_ID,
          projectId: PROJECT_ID,
          sprintId: SPRINT_ID,
          sprint: { id: SPRINT_ID, name: "Sprint 1", status: SprintStatus.ACTIVE },
          createdById: LEADER_ID,
          createdBy: { id: LEADER_ID, fullName: "Leader", email: "l@akatsuki.local" },
          title: "Unassigned Review Task",
          description: null,
          priority: TaskPriority.MEDIUM,
          status: TaskStatus.REVIEW,
          startDate: null,
          deadline: new Date("2026-11-20T00:00:00.000Z"),
          estimateHours: 2,
          referenceLinks: [],
          progressNotes: null,
          completedAt: null,
          createdAt: new Date("2026-11-01T00:00:00.000Z"),
          updatedAt: new Date("2026-11-01T00:00:00.000Z"),
          assignees: [],
          dependencies: [],
          _count: { dependents: 0 },
        },
      ]);

      const memberBoard = await getKanbanBoardService(memberActor, PROJECT_ID, {});
      expect(memberBoard.columns.TODO[0].permissions.canStartProgress).toBe(true);
      expect(memberBoard.columns.REVIEW[0].permissions.canApproveOrReject).toBe(false);

      const instructorBoard = await getKanbanBoardService(instructorActor, PROJECT_ID, {});
      expect(instructorBoard.columns.TODO[0].permissions.canStartProgress).toBe(false);
      expect(instructorBoard.columns.REVIEW[0].permissions.canApproveOrReject).toBe(false);
    });
  });

  describe("5. Sprint Backlog Candidates & PageSize Limit Guard", () => {
    it("rejects listBacklogTasksService pageSize > 50 to preserve API pagination limits", async () => {
      await expect(
        listBacklogTasksService(leaderActor, PROJECT_ID, { pageSize: 100 })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "VALIDATION_ERROR",
      });
    });

    it("loads single-page Sprint backlog candidates with pageSize <= 50", async () => {
      prismaMock.project.findUnique.mockResolvedValue(makeProjectRecord(ProjectStatus.ACTIVE));
      const candidateItem = { id: TASK_1_ID } as never;
      taskRepoMock.findManyByProjectPaginated.mockResolvedValueOnce({
        items: [candidateItem],
        page: 1,
        pageSize: 50,
        totalItems: 1,
        totalPages: 1,
      });

      const result = await listSprintBacklogCandidatesService(leaderActor, PROJECT_ID);
      expect(result.items).toEqual([candidateItem]);
      expect(taskRepoMock.findManyByProjectPaginated).toHaveBeenCalledTimes(1);
      expect(taskRepoMock.findManyByProjectPaginated).toHaveBeenCalledWith(
        PROJECT_ID,
        expect.objectContaining({
          backlogOnly: true,
          page: 1,
          pageSize: 50,
        })
      );
    });

    it("merges up to two 50-item pages when backlog candidates exceed 50 items", async () => {
      prismaMock.project.findUnique.mockResolvedValue(makeProjectRecord(ProjectStatus.ACTIVE));
      const page1Item = { id: TASK_1_ID } as never;
      const page2Item = { id: TASK_2_ID } as never;

      taskRepoMock.findManyByProjectPaginated
        .mockResolvedValueOnce({
          items: [page1Item],
          page: 1,
          pageSize: 50,
          totalItems: 75,
          totalPages: 2,
        })
        .mockResolvedValueOnce({
          items: [page2Item],
          page: 2,
          pageSize: 50,
          totalItems: 75,
          totalPages: 2,
        });

      const result = await listSprintBacklogCandidatesService(leaderActor, PROJECT_ID);
      expect(result.items).toEqual([page1Item, page2Item]);
      expect(taskRepoMock.findManyByProjectPaginated).toHaveBeenCalledTimes(2);
      expect(taskRepoMock.findManyByProjectPaginated).toHaveBeenNthCalledWith(
        2,
        PROJECT_ID,
        expect.objectContaining({
          backlogOnly: true,
          page: 2,
          pageSize: 50,
        })
      );
    });
  });

  it("exposes AppError error type cleanly", () => {
    expect(AppError).toBeDefined();
  });
});
