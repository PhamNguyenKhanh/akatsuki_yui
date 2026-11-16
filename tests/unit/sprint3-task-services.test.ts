import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ProjectMemberRole,
  ProjectStatus,
  ReviewDecision,
  TaskHistoryAction,
  TaskPriority,
  TaskStatus,
  UserStatus,
} from "@prisma/client";
import { AppError } from "@/lib/errors";
import { PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import type { AuthContext } from "@/types/auth";

vi.mock("server-only", () => ({}));

const { prismaMock, taskRepoMock, taskHistoryRepoMock, emitTaskEventAfterCommitMock } = vi.hoisted(
  () => {
    const txMock = {
      $executeRaw: vi.fn(),
      user: {
        findMany: vi.fn(),
      },
      project: {
        findUnique: vi.fn(),
      },
      projectMember: {
        findMany: vi.fn(),
      },
      task: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      taskAssignee: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        createMany: vi.fn(),
        updateMany: vi.fn(),
      },
      taskDependency: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
      taskReview: {
        create: vi.fn(),
      },
      taskHistory: {
        findFirst: vi.fn(),
      },
      $transaction: vi.fn(),
    };
    txMock.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => unknown) =>
      fn(txMock)
    );

    return {
      prismaMock: txMock,
      taskRepoMock: {
        findManyByProjectPaginated: vi.fn(),
        findSummaryById: vi.fn(),
        findDetailById: vi.fn(),
        findProjectTaskStats: vi.fn(),
        findMyAssignedTasks: vi.fn(),
        listTaskAssignees: vi.fn(),
        listTaskDependencies: vi.fn(),
        getProjectDependencyEdges: vi.fn(),
        listProjectTaskOptions: vi.fn(),
      },
      taskHistoryRepoMock: {
        appendTaskHistory: vi.fn(),
        appendManyTaskHistories: vi.fn(),
        findTaskHistoryPaginated: vi.fn(),
      },
      emitTaskEventAfterCommitMock: vi.fn(),
    };
  }
);

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

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

vi.mock("@/modules/tasks/task-events", () => ({
  emitTaskEventAfterCommit: emitTaskEventAfterCommitMock,
}));

import { taskAssignmentGuard } from "@/modules/project-members/task-assignment-guard";
import {
  addTaskAssigneeService,
  removeTaskAssigneeService,
  syncTaskAssigneesService,
} from "@/modules/tasks/task-assignment.service";
import {
  addTaskDependencyService,
  hasDependencyPath,
  removeTaskDependencyService,
} from "@/modules/tasks/task-dependency.service";
import { listTaskHistoryService } from "@/modules/tasks/task-history.service";
import {
  createTaskSchema,
  formatTaskCode,
  reviewDecisionSchema,
} from "@/modules/tasks/task.schema";
import { createTaskService, updateTaskService } from "@/modules/tasks/task.service";
import {
  approveTaskReviewService,
  rejectTaskReviewService,
  submitTaskForReviewService,
  updateTaskStatusService,
} from "@/modules/tasks/task-workflow.service";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const LEADER_ID = "22222222-2222-4222-8222-222222222222";
const MEMBER_ID = "33333333-3333-4333-8333-333333333333";
const INSTRUCTOR_ID = "44444444-4444-4444-8444-444444444444";
const OUTSIDER_ID = "55555555-5555-4555-8555-555555555555";
const PROJECT_ID = "66666666-6666-4666-8666-666666666666";
const OTHER_PROJECT_ID = "77777777-7777-4777-8777-777777777777";
const TASK_A_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TASK_B_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TASK_C_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TASK_D_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const adminActor: AuthContext = {
  userId: ADMIN_ID,
  email: "admin@akatsuki.local",
  fullName: "Admin User",
  status: UserStatus.ACTIVE,
  roles: [ROLES.ADMIN],
  permissions: Object.values(PERMISSIONS),
};

const leaderActor: AuthContext = {
  userId: LEADER_ID,
  email: "leader@akatsuki.local",
  fullName: "Leader User",
  status: UserStatus.ACTIVE,
  roles: [ROLES.LEADER],
  permissions: [
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.TASK_READ,
    PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.TASK_ASSIGN,
    PERMISSIONS.TASK_SUBMIT_REVIEW,
    PERMISSIONS.TASK_REVIEW,
    PERMISSIONS.TASK_HISTORY_READ,
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
    PERMISSIONS.TASK_HISTORY_READ,
  ],
};

const instructorActor: AuthContext = {
  userId: INSTRUCTOR_ID,
  email: "instructor@akatsuki.local",
  fullName: "Instructor User",
  status: UserStatus.ACTIVE,
  roles: [ROLES.INSTRUCTOR],
  permissions: [PERMISSIONS.PROJECT_READ, PERMISSIONS.TASK_READ, PERMISSIONS.TASK_HISTORY_READ],
};

function makeProjectRecord(
  overrides: Partial<{
    status: ProjectStatus;
    leaderId: string;
    members: { projectRole: ProjectMemberRole }[];
  }> = {}
) {
  return {
    id: PROJECT_ID,
    name: "Sprint 3 Project",
    status: ProjectStatus.ACTIVE,
    leaderId: LEADER_ID,
    members: [{ projectRole: ProjectMemberRole.MEMBER }],
    ...overrides,
  };
}

function makeTaskRecord(
  overrides: Partial<{
    id: string;
    projectId: string;
    status: TaskStatus;
    startDate: Date | null;
    deadline: Date;
    referenceLinks: string[];
    progressNotes: string | null;
    updatedAt: Date;
  }> = {}
) {
  return {
    id: TASK_A_ID,
    projectId: PROJECT_ID,
    createdById: LEADER_ID,
    title: "Implement Task Service",
    description: "Initial description",
    priority: TaskPriority.HIGH,
    status: TaskStatus.TODO,
    startDate: new Date("2026-11-10T00:00:00.000Z"),
    deadline: new Date("2026-11-20T00:00:00.000Z"),
    estimateHours: 8,
    referenceLinks: ["https://github.com/org/repo/pull/1"],
    progressNotes: "Initial note",
    completedAt: null,
    updatedAt: new Date("2026-11-15T10:00:00.000Z"),
    ...overrides,
  };
}

function makeTaskDetailDTO(
  overrides: Partial<{
    id: string;
    title: string;
    status: TaskStatus;
  }> = {}
) {
  const id = overrides.id ?? TASK_A_ID;
  return {
    id,
    code: formatTaskCode(id),
    projectId: PROJECT_ID,
    project: {
      id: PROJECT_ID,
      name: "Sprint 3 Project",
      status: ProjectStatus.ACTIVE,
      leaderId: LEADER_ID,
    },
    createdById: LEADER_ID,
    createdBy: { id: LEADER_ID, fullName: "Leader User", email: "leader@akatsuki.local" },
    title: overrides.title ?? "Implement Task Service",
    description: "Initial description",
    priority: TaskPriority.HIGH,
    status: overrides.status ?? TaskStatus.TODO,
    startDate: new Date("2026-11-10T00:00:00.000Z"),
    deadline: new Date("2026-11-20T00:00:00.000Z"),
    estimateHours: 8,
    referenceLinks: [],
    progressNotes: null,
    completedAt: null,
    isOverdue: false,
    assignees: [],
    dependencyCount: 0,
    blockedByCount: 0,
    dependentCount: 0,
    dependencies: [],
    dependents: [],
    reviews: [],
    createdAt: new Date("2026-11-15T09:00:00.000Z"),
    updatedAt: new Date("2026-11-15T10:00:00.000Z"),
  };
}

async function expectAppError(promise: Promise<unknown>, statusCode: number, code: string) {
  try {
    await promise;
    throw new Error(`Expected AppError(${statusCode}, ${code}) but resolved.`);
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    const appError = error as AppError;
    expect(appError.statusCode).toBe(statusCode);
    expect(appError.code).toBe(code);
    return appError;
  }
}

describe("Sprint 3 Task Services Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock)
    );
    prismaMock.$executeRaw.mockResolvedValue(1);
    taskHistoryRepoMock.appendTaskHistory.mockResolvedValue({ id: "hist-1" });
    taskHistoryRepoMock.appendManyTaskHistories.mockResolvedValue({ count: 1 });
    emitTaskEventAfterCommitMock.mockResolvedValue(undefined);
  });

  describe("Validation & Code Helpers", () => {
    it("formats first 8 characters of UUID as #code without DB column (OQ-02)", () => {
      expect(formatTaskCode("a1b2c3d4-e5f6-4789-8012-123456789abc")).toBe("#a1b2c3d4");
    });

    it("rejects invalid date range, negative hours, dangerous links, and >20 links", () => {
      expect(
        createTaskSchema.safeParse({
          title: "Valid Title",
          startDate: "2026-11-25T00:00:00.000Z",
          deadline: "2026-11-20T00:00:00.000Z",
        }).success
      ).toBe(false);

      expect(
        createTaskSchema.safeParse({
          title: "Valid Title",
          deadline: "2026-11-20T00:00:00.000Z",
          estimateHours: -1,
        }).success
      ).toBe(false);

      expect(
        createTaskSchema.safeParse({
          title: "Valid Title",
          deadline: "2026-11-20T00:00:00.000Z",
          referenceLinks: ["javascript:alert(1)"],
        }).success
      ).toBe(false);

      expect(
        createTaskSchema.safeParse({
          title: "Valid Title",
          deadline: "2026-11-20T00:00:00.000Z",
          referenceLinks: Array.from({ length: 21 }, (_, idx) => `https://example.com/${idx}`),
        }).success
      ).toBe(false);

      expect(reviewDecisionSchema.safeParse({ reason: "   " }).success).toBe(false);
    });
  });

  describe("Task Core & Field-Level Access (OQ-06, OQ-07, DEC-015)", () => {
    it("allows creating Tasks in CREATED or ACTIVE projects and locks ARCHIVED projects", async () => {
      prismaMock.project.findUnique.mockResolvedValue(
        makeProjectRecord({
          status: ProjectStatus.CREATED,
          members: [{ projectRole: ProjectMemberRole.LEADER }],
        })
      );
      prismaMock.task.create.mockResolvedValue({ id: TASK_A_ID, title: "Draft Setup" });
      taskRepoMock.findDetailById.mockResolvedValue(makeTaskDetailDTO({ title: "Draft Setup" }));

      const created = await createTaskService(leaderActor, PROJECT_ID, {
        title: "Draft Setup",
        deadline: "2026-11-25T00:00:00.000Z",
      });
      expect(created.title).toBe("Draft Setup");
      expect(taskHistoryRepoMock.appendTaskHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          action: TaskHistoryAction.CREATED,
          toStatus: TaskStatus.TODO,
        }),
        prismaMock
      );

      prismaMock.project.findUnique.mockResolvedValue(
        makeProjectRecord({ status: ProjectStatus.ARCHIVED })
      );
      await expectAppError(
        createTaskService(leaderActor, PROJECT_ID, {
          title: "Blocked Task",
          deadline: "2026-11-25T00:00:00.000Z",
        }),
        409,
        "PROJECT_ARCHIVED"
      );
    });

    it("enforces INSTRUCTOR read-only restriction (OQ-07 / DEC-025)", async () => {
      await expectAppError(
        createTaskService(instructorActor, PROJECT_ID, {
          title: "Instructor Blocked",
          deadline: "2026-11-25T00:00:00.000Z",
        }),
        403,
        "FORBIDDEN"
      );

      await expectAppError(
        approveTaskReviewService(instructorActor, TASK_A_ID, { reason: "LGTM" }),
        403,
        "FORBIDDEN"
      );
    });

    it("throws 403 FORBIDDEN when assigned Member tries to update Leader-only fields (DEC-015)", async () => {
      prismaMock.task.findUnique.mockResolvedValue(
        makeTaskRecord({ status: TaskStatus.IN_PROGRESS })
      );
      prismaMock.project.findUnique.mockResolvedValue(
        makeProjectRecord({ members: [{ projectRole: ProjectMemberRole.MEMBER }] })
      );
      prismaMock.taskAssignee.findFirst.mockResolvedValue({ id: "assign-1" });

      await expectAppError(
        updateTaskService(memberActor, TASK_A_ID, {
          progressNotes: "Sneaky note",
          title: "Hijacked Title",
        }),
        403,
        "FORBIDDEN"
      );

      await expectAppError(
        updateTaskService(memberActor, TASK_A_ID, { priority: TaskPriority.CRITICAL }),
        403,
        "FORBIDDEN"
      );
      expect(prismaMock.task.update).not.toHaveBeenCalled();
      expect(prismaMock.task.updateMany).not.toHaveBeenCalled();
    });

    it("throws 403 FORBIDDEN when unassigned Member attempts updateTaskService", async () => {
      prismaMock.task.findUnique.mockResolvedValue(makeTaskRecord());
      prismaMock.project.findUnique.mockResolvedValue(
        makeProjectRecord({ members: [{ projectRole: ProjectMemberRole.MEMBER }] })
      );
      prismaMock.taskAssignee.findFirst.mockResolvedValue(null);

      await expectAppError(
        updateTaskService(memberActor, TASK_A_ID, { progressNotes: "Not mine" }),
        403,
        "FORBIDDEN"
      );
    });

    it("lets assigned Member move TODO -> IN_PROGRESS and update progressNotes/links with separate history logs", async () => {
      prismaMock.task.findUnique.mockResolvedValue(makeTaskRecord({ status: TaskStatus.TODO }));
      prismaMock.project.findUnique.mockResolvedValue(
        makeProjectRecord({ members: [{ projectRole: ProjectMemberRole.MEMBER }] })
      );
      prismaMock.taskAssignee.findFirst.mockResolvedValue({ id: "assign-1" });
      prismaMock.task.updateMany.mockResolvedValue({ count: 1 });
      taskRepoMock.findDetailById.mockResolvedValue(
        makeTaskDetailDTO({ status: TaskStatus.IN_PROGRESS })
      );

      const updated = await updateTaskService(memberActor, TASK_A_ID, {
        status: TaskStatus.IN_PROGRESS,
        progressNotes: "Started working",
        referenceLinks: ["https://github.com/org/repo/pull/2"],
      });

      expect(updated.status).toBe(TaskStatus.IN_PROGRESS);
      expect(taskHistoryRepoMock.appendManyTaskHistories).toHaveBeenCalledWith(
        [
          expect.objectContaining({ action: TaskHistoryAction.PROGRESS_UPDATED }),
          expect.objectContaining({
            action: TaskHistoryAction.STATUS_CHANGED,
            fromStatus: TaskStatus.TODO,
            toStatus: TaskStatus.IN_PROGRESS,
          }),
        ],
        prismaMock
      );
    });

    it("rejects partial update when deadline becomes earlier than existing startDate and detects stale expectedUpdatedAt", async () => {
      prismaMock.task.findUnique.mockResolvedValue(
        makeTaskRecord({ startDate: new Date("2026-11-15T00:00:00.000Z") })
      );
      prismaMock.project.findUnique.mockResolvedValue(
        makeProjectRecord({ members: [{ projectRole: ProjectMemberRole.LEADER }] })
      );

      await expectAppError(
        updateTaskService(leaderActor, TASK_A_ID, {
          deadline: "2026-11-10T00:00:00.000Z",
        }),
        400,
        "VALIDATION_ERROR"
      );

      await expectAppError(
        updateTaskService(leaderActor, TASK_A_ID, {
          title: "Updated Title",
          expectedUpdatedAt: "2026-11-01T00:00:00.000Z",
        }),
        409,
        "CONFLICT"
      );
    });
  });

  describe("Task Assignment & Member Removal Guard", () => {
    it("rejects assigning INACTIVE user or non-member or INSTRUCTOR", async () => {
      prismaMock.task.findUnique.mockResolvedValue(makeTaskRecord());
      prismaMock.project.findUnique.mockResolvedValue(
        makeProjectRecord({ members: [{ projectRole: ProjectMemberRole.LEADER }] })
      );
      prismaMock.user.findMany.mockResolvedValue([{ id: OUTSIDER_ID, status: UserStatus.PENDING }]);

      await expectAppError(
        addTaskAssigneeService(leaderActor, TASK_A_ID, { userId: OUTSIDER_ID }),
        409,
        "ACCOUNT_NOT_ACTIVE"
      );

      prismaMock.user.findMany.mockResolvedValue([
        { id: INSTRUCTOR_ID, status: UserStatus.ACTIVE },
      ]);
      prismaMock.projectMember.findMany.mockResolvedValue([
        { userId: INSTRUCTOR_ID, projectRole: ProjectMemberRole.INSTRUCTOR },
      ]);

      await expectAppError(
        addTaskAssigneeService(leaderActor, TASK_A_ID, { userId: INSTRUCTOR_ID }),
        409,
        "ASSIGNEE_NOT_PROJECT_MEMBER"
      );
    });

    it("syncs assignees, logs per-user history, and emits TASK_ASSIGNED only after commit", async () => {
      const eventOrder: string[] = [];
      prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => {
        const res = await fn(prismaMock);
        eventOrder.push("tx_committed");
        return res;
      });
      emitTaskEventAfterCommitMock.mockImplementation(async () => {
        eventOrder.push("event_emitted");
      });

      prismaMock.task.findUnique.mockResolvedValue(makeTaskRecord());
      prismaMock.project.findUnique.mockResolvedValue(
        makeProjectRecord({ members: [{ projectRole: ProjectMemberRole.LEADER }] })
      );
      prismaMock.user.findMany
        .mockResolvedValueOnce([{ id: MEMBER_ID, status: UserStatus.ACTIVE }])
        .mockResolvedValueOnce([
          { id: MEMBER_ID, fullName: "Member User", email: "member@akatsuki.local" },
        ]);
      prismaMock.projectMember.findMany.mockResolvedValue([
        { userId: MEMBER_ID, projectRole: ProjectMemberRole.MEMBER },
      ]);
      prismaMock.taskAssignee.findMany.mockResolvedValue([
        {
          id: "old-assign",
          userId: OUTSIDER_ID,
          user: { id: OUTSIDER_ID, fullName: "Former Assignee", email: "old@akatsuki.local" },
        },
      ]);
      taskRepoMock.listTaskAssignees.mockResolvedValue([]);

      await syncTaskAssigneesService(leaderActor, TASK_A_ID, { assigneeIds: [MEMBER_ID] });

      expect(prismaMock.taskAssignee.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ["old-assign"] }, removedAt: null } })
      );
      expect(prismaMock.taskAssignee.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [expect.objectContaining({ taskId: TASK_A_ID, userId: MEMBER_ID })],
        })
      );
      expect(taskHistoryRepoMock.appendManyTaskHistories).toHaveBeenCalledWith(
        [
          expect.objectContaining({ action: TaskHistoryAction.ASSIGNEE_REMOVED }),
          expect.objectContaining({ action: TaskHistoryAction.ASSIGNEE_ADDED }),
        ],
        prismaMock
      );
      expect(eventOrder).toEqual(["tx_committed", "event_emitted"]);
      expect(emitTaskEventAfterCommitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "TASK_ASSIGNED",
          recipientUserIds: [MEMBER_ID],
        })
      );
    });

    it("soft-removes task assignee via removedAt without deleting row", async () => {
      prismaMock.task.findUnique.mockResolvedValue(makeTaskRecord());
      prismaMock.project.findUnique.mockResolvedValue(
        makeProjectRecord({ members: [{ projectRole: ProjectMemberRole.LEADER }] })
      );
      prismaMock.taskAssignee.findFirst.mockResolvedValue({
        id: "assign-1",
        userId: MEMBER_ID,
        user: { fullName: "Member User", email: "member@akatsuki.local" },
      });
      prismaMock.taskAssignee.updateMany.mockResolvedValue({ count: 1 });
      taskRepoMock.listTaskAssignees.mockResolvedValue([]);

      await removeTaskAssigneeService(leaderActor, TASK_A_ID, MEMBER_ID);

      expect(prismaMock.taskAssignee.updateMany).toHaveBeenCalledWith({
        where: { id: "assign-1", removedAt: null },
        data: { removedAt: expect.any(Date) },
      });
      expect(taskHistoryRepoMock.appendTaskHistory).toHaveBeenCalledWith(
        expect.objectContaining({ action: TaskHistoryAction.ASSIGNEE_REMOVED }),
        prismaMock
      );
    });

    it("blocks ProjectMember removal when active unfinished tasks remain (taskAssignmentGuard)", async () => {
      prismaMock.taskAssignee.findMany.mockResolvedValue([
        {
          task: {
            id: TASK_A_ID,
            title: "Unfinished Task",
            status: TaskStatus.IN_PROGRESS,
          },
        },
      ]);

      const err = await expectAppError(
        taskAssignmentGuard.assertNoActiveProjectTasks(
          prismaMock as unknown as Parameters<
            typeof taskAssignmentGuard.assertNoActiveProjectTasks
          >[0],
          PROJECT_ID,
          MEMBER_ID
        ),
        409,
        "TASK_ASSIGNEE_REASSIGN_REQUIRED"
      );
      expect(err.details?.[0]).toMatchObject({
        taskId: TASK_A_ID,
        taskTitle: "Unfinished Task",
        taskStatus: TaskStatus.IN_PROGRESS,
      });

      prismaMock.taskAssignee.findMany.mockResolvedValue([]);
      await expect(
        taskAssignmentGuard.assertNoActiveProjectTasks(
          prismaMock as unknown as Parameters<
            typeof taskAssignmentGuard.assertNoActiveProjectTasks
          >[0],
          PROJECT_ID,
          MEMBER_ID
        )
      ).resolves.toBeUndefined();
    });
  });

  describe("Review Workflow, Predecessor Gate & Self-Review (OQ-03, OQ-04, OQ-05)", () => {
    it("blocks invalid status transitions including DONE reopen (OQ-05) and direct REVIEW -> IN_PROGRESS PATCH", async () => {
      prismaMock.task.findUnique.mockResolvedValue(makeTaskRecord({ status: TaskStatus.TODO }));
      prismaMock.project.findUnique.mockResolvedValue(makeProjectRecord());
      prismaMock.taskAssignee.findFirst.mockResolvedValue({ id: "assign-1" });

      await expectAppError(
        submitTaskForReviewService(memberActor, TASK_A_ID, { note: "Ready" }),
        409,
        "INVALID_STATUS_TRANSITION"
      );

      prismaMock.task.findUnique.mockResolvedValue(makeTaskRecord({ status: TaskStatus.DONE }));
      await expectAppError(
        updateTaskStatusService(leaderActor, TASK_A_ID, TaskStatus.IN_PROGRESS),
        409,
        "TASK_ALREADY_COMPLETED"
      );

      prismaMock.task.findUnique.mockResolvedValue(makeTaskRecord({ status: TaskStatus.REVIEW }));
      await expectAppError(
        updateTaskStatusService(leaderActor, TASK_A_ID, TaskStatus.IN_PROGRESS),
        409,
        "INVALID_STATUS_TRANSITION"
      );
    });

    it("throws 409 REVIEW_REASON_REQUIRED on blank approve/reject reason", async () => {
      await expectAppError(
        approveTaskReviewService(leaderActor, TASK_A_ID, { reason: "   " }),
        409,
        "REVIEW_REASON_REQUIRED"
      );
      await expectAppError(
        rejectTaskReviewService(leaderActor, TASK_A_ID, {}),
        409,
        "REVIEW_REASON_REQUIRED"
      );
    });

    it("blocks Approve when predecessor dependency is not DONE (409 TASK_DEPENDENCY_NOT_COMPLETED)", async () => {
      prismaMock.task.findUnique.mockResolvedValue(makeTaskRecord({ status: TaskStatus.REVIEW }));
      prismaMock.project.findUnique.mockResolvedValue(
        makeProjectRecord({ members: [{ projectRole: ProjectMemberRole.LEADER }] })
      );
      prismaMock.taskDependency.findMany.mockResolvedValue([
        {
          dependsOnTask: {
            id: TASK_B_ID,
            title: "Predecessor DB",
            status: TaskStatus.IN_PROGRESS,
          },
        },
      ]);

      const err = await expectAppError(
        approveTaskReviewService(leaderActor, TASK_A_ID, { reason: "Approve attempt" }),
        409,
        "TASK_DEPENDENCY_NOT_COMPLETED"
      );
      expect(err.details?.[0]).toMatchObject({
        taskId: TASK_B_ID,
        taskStatus: TaskStatus.IN_PROGRESS,
      });
    });

    it("supports Leader self-review (OQ-03) and records TaskReview + single REVIEW_APPROVED history without ActivityLog/AuditLog (OQ-04)", async () => {
      prismaMock.task.findUnique.mockResolvedValue(makeTaskRecord({ status: TaskStatus.REVIEW }));
      prismaMock.project.findUnique.mockResolvedValue(
        makeProjectRecord({ members: [{ projectRole: ProjectMemberRole.LEADER }] })
      );
      prismaMock.taskDependency.findMany.mockResolvedValue([]);
      prismaMock.taskHistory.findFirst.mockResolvedValue({ actorId: LEADER_ID });
      prismaMock.task.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.taskReview.create.mockResolvedValue({ id: "rev-1" });
      prismaMock.taskAssignee.findMany.mockResolvedValue([{ userId: LEADER_ID }]);
      taskRepoMock.findDetailById.mockResolvedValue(makeTaskDetailDTO({ status: TaskStatus.DONE }));

      const approved = await approveTaskReviewService(leaderActor, TASK_A_ID, {
        reason: "Self-reviewed and verified tests.",
      });

      expect(approved.status).toBe(TaskStatus.DONE);
      expect(prismaMock.taskReview.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          taskId: TASK_A_ID,
          submittedById: LEADER_ID,
          reviewerId: LEADER_ID,
          decision: ReviewDecision.APPROVED,
          reason: "Self-reviewed and verified tests.",
        }),
        select: { id: true },
      });
      expect(taskHistoryRepoMock.appendTaskHistory).toHaveBeenCalledTimes(1);
      expect(taskHistoryRepoMock.appendTaskHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          action: TaskHistoryAction.REVIEW_APPROVED,
          fromStatus: TaskStatus.REVIEW,
          toStatus: TaskStatus.DONE,
          metadata: expect.objectContaining({ selfReview: true, reviewId: "rev-1" }),
        }),
        prismaMock
      );
      expect(emitTaskEventAfterCommitMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: "TASK_REVIEW_APPROVED" })
      );
    });

    it("throws 409 INVALID_STATUS_TRANSITION when concurrent CAS updateMany returns count 0", async () => {
      prismaMock.task.findUnique.mockResolvedValue(makeTaskRecord({ status: TaskStatus.REVIEW }));
      prismaMock.project.findUnique.mockResolvedValue(
        makeProjectRecord({ members: [{ projectRole: ProjectMemberRole.LEADER }] })
      );
      prismaMock.taskDependency.findMany.mockResolvedValue([]);
      prismaMock.taskHistory.findFirst.mockResolvedValue({ actorId: MEMBER_ID });
      prismaMock.task.updateMany.mockResolvedValue({ count: 0 });

      await expectAppError(
        rejectTaskReviewService(leaderActor, TASK_A_ID, { reason: "Needs rework" }),
        409,
        "INVALID_STATUS_TRANSITION"
      );
      expect(prismaMock.taskReview.create).not.toHaveBeenCalled();
    });
  });

  describe("Task Dependencies & Cycle Detection", () => {
    it("detects cycles cleanly while allowing diamond DAGs in pure graph helper", () => {
      const diamondEdges = [
        { taskId: TASK_B_ID, dependsOnTaskId: TASK_A_ID },
        { taskId: TASK_C_ID, dependsOnTaskId: TASK_A_ID },
        { taskId: TASK_D_ID, dependsOnTaskId: TASK_B_ID },
      ];
      // Adding D -> C should NOT create a cycle even though A is reachable from both B and C
      expect(hasDependencyPath(diamondEdges, TASK_C_ID, TASK_D_ID)).toBe(false);

      // Adding A -> D WOULD create cycle A -> D -> B -> A
      expect(hasDependencyPath(diamondEdges, TASK_D_ID, TASK_A_ID)).toBe(true);
    });

    it("rejects self-reference, cross-project, duplicate, DONE->incomplete, and cycles with advisory lock", async () => {
      await expectAppError(
        addTaskDependencyService(leaderActor, TASK_A_ID, { dependsOnTaskId: TASK_A_ID }),
        409,
        "TASK_DEPENDENCY_SELF_REFERENCE"
      );

      prismaMock.task.findUnique
        .mockResolvedValueOnce({ projectId: PROJECT_ID })
        .mockResolvedValueOnce(makeTaskRecord({ id: TASK_A_ID }))
        .mockResolvedValueOnce({ id: TASK_A_ID, status: TaskStatus.TODO })
        .mockResolvedValueOnce({
          id: TASK_B_ID,
          projectId: OTHER_PROJECT_ID,
          title: "Other Project Task",
          status: TaskStatus.TODO,
        });
      prismaMock.project.findUnique.mockResolvedValue(
        makeProjectRecord({ members: [{ projectRole: ProjectMemberRole.LEADER }] })
      );

      await expectAppError(
        addTaskDependencyService(leaderActor, TASK_A_ID, { dependsOnTaskId: TASK_B_ID }),
        400,
        "VALIDATION_ERROR"
      );
      expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1);

      // Cycle detection case: B -> A exists, try A -> B
      prismaMock.task.findUnique
        .mockResolvedValueOnce({ projectId: PROJECT_ID })
        .mockResolvedValueOnce(makeTaskRecord({ id: TASK_A_ID }))
        .mockResolvedValueOnce({ id: TASK_A_ID, status: TaskStatus.TODO })
        .mockResolvedValueOnce({
          id: TASK_B_ID,
          projectId: PROJECT_ID,
          title: "Task B",
          status: TaskStatus.TODO,
        });
      prismaMock.taskDependency.findUnique.mockResolvedValue(null);
      taskRepoMock.getProjectDependencyEdges.mockResolvedValue([
        { taskId: TASK_B_ID, dependsOnTaskId: TASK_A_ID },
      ]);

      await expectAppError(
        addTaskDependencyService(leaderActor, TASK_A_ID, { dependsOnTaskId: TASK_B_ID }),
        409,
        "TASK_DEPENDENCY_CYCLE"
      );

      // Duplicate case
      prismaMock.task.findUnique
        .mockResolvedValueOnce({ projectId: PROJECT_ID })
        .mockResolvedValueOnce(makeTaskRecord({ id: TASK_A_ID }))
        .mockResolvedValueOnce({ id: TASK_A_ID, status: TaskStatus.TODO })
        .mockResolvedValueOnce({
          id: TASK_B_ID,
          projectId: PROJECT_ID,
          title: "Task B",
          status: TaskStatus.DONE,
        });
      prismaMock.taskDependency.findUnique.mockResolvedValue({ id: "dep-existing" });
      await expectAppError(
        addTaskDependencyService(leaderActor, TASK_A_ID, { dependsOnTaskId: TASK_B_ID }),
        409,
        "TASK_DEPENDENCY_EXISTS"
      );

      // DONE task is read-only and rejects adding any predecessor dependency (SEC-08)
      prismaMock.task.findUnique
        .mockResolvedValueOnce({ projectId: PROJECT_ID })
        .mockResolvedValueOnce(makeTaskRecord({ id: TASK_A_ID, status: TaskStatus.DONE }))
        .mockResolvedValueOnce({ id: TASK_A_ID, status: TaskStatus.DONE })
        .mockResolvedValueOnce({
          id: TASK_B_ID,
          projectId: PROJECT_ID,
          title: "Task B",
          status: TaskStatus.TODO,
        });
      await expectAppError(
        addTaskDependencyService(leaderActor, TASK_A_ID, { dependsOnTaskId: TASK_B_ID }),
        409,
        "TASK_ALREADY_COMPLETED"
      );
    });

    it("removes dependency and appends DEPENDENCY_REMOVED history", async () => {
      prismaMock.task.findUnique.mockResolvedValue(makeTaskRecord());
      prismaMock.project.findUnique.mockResolvedValue(makeProjectRecord());
      prismaMock.taskDependency.findUnique.mockResolvedValue({
        id: "dep-1",
        dependsOnTask: { id: TASK_B_ID, title: "Task B", status: TaskStatus.DONE },
      });
      taskRepoMock.listTaskDependencies.mockResolvedValue([]);

      await removeTaskDependencyService(adminActor, TASK_A_ID, TASK_B_ID);

      expect(prismaMock.taskDependency.delete).toHaveBeenCalledWith({ where: { id: "dep-1" } });
      expect(taskHistoryRepoMock.appendTaskHistory).toHaveBeenCalledWith(
        expect.objectContaining({ action: TaskHistoryAction.DEPENDENCY_REMOVED }),
        prismaMock
      );
    });
  });

  describe("Task History Read", () => {
    it("allows project INSTRUCTOR to read task history and rejects missing task or non-member", async () => {
      prismaMock.task.findUnique.mockResolvedValue(makeTaskRecord());
      prismaMock.project.findUnique.mockResolvedValue(
        makeProjectRecord({ members: [{ projectRole: ProjectMemberRole.INSTRUCTOR }] })
      );
      taskHistoryRepoMock.findTaskHistoryPaginated.mockResolvedValue({
        items: [],
        page: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 1,
      });

      const history = await listTaskHistoryService(instructorActor, TASK_A_ID, { page: 1 });
      expect(history.totalItems).toBe(0);

      prismaMock.project.findUnique.mockResolvedValue(
        makeProjectRecord({ leaderId: LEADER_ID, members: [] })
      );
      await expectAppError(
        listTaskHistoryService(instructorActor, TASK_A_ID, {}),
        403,
        "FORBIDDEN"
      );
    });
  });
});
