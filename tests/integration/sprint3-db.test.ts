import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, ROLES, type PermissionCode } from "@/modules/authorization/constants";
import { removeProjectMemberService } from "@/modules/project-members/member.service";
import {
  addTaskAssigneeService,
  removeTaskAssigneeService,
  syncTaskAssigneesService,
} from "@/modules/tasks/task-assignment.service";
import {
  addTaskDependencyService,
  removeTaskDependencyService,
} from "@/modules/tasks/task-dependency.service";
import { registerTaskEventHandler, type TaskDomainEvent } from "@/modules/tasks/task-events";
import { listTaskHistoryService } from "@/modules/tasks/task-history.service";
import {
  createTaskService,
  getTaskDetailService,
  updateTaskService,
} from "@/modules/tasks/task.service";
import {
  approveTaskReviewService,
  rejectTaskReviewService,
  submitTaskForReviewService,
  updateTaskStatusService,
} from "@/modules/tasks/task-workflow.service";
import type { AuthContext } from "@/types/auth";

vi.mock("server-only", () => ({}));

const testSuffix = randomUUID().slice(0, 8);
const createdUserIds: string[] = [];
const createdProjectIds: string[] = [];

function makeActor(
  userId: string,
  role: keyof typeof ROLES,
  permissions: PermissionCode[],
  fullName: string
): AuthContext {
  return {
    userId,
    email: `${role.toLowerCase()}-${testSuffix}@akatsuki.test`,
    fullName,
    status: UserStatus.ACTIVE,
    roles: [ROLES[role]],
    permissions,
  };
}

let leaderActor: AuthContext;
let memberActor: AuthContext;
let instructorActor: AuthContext;
let outsiderActor: AuthContext;
let pendingUserId: string;

describe("Sprint 3 PostgreSQL Integration Tests", () => {
  beforeAll(async () => {
    const [leaderUser, memberUser, instructorUser, outsiderUser, pendingUser] = await Promise.all([
      prisma.user.create({
        data: {
          email: `s3-leader-${testSuffix}@akatsuki.test`,
          fullName: "Sprint3 Leader",
          passwordHash: "hash",
          status: UserStatus.ACTIVE,
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          email: `s3-member-${testSuffix}@akatsuki.test`,
          fullName: "Sprint3 Member",
          passwordHash: "hash",
          status: UserStatus.ACTIVE,
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          email: `s3-instructor-${testSuffix}@akatsuki.test`,
          fullName: "Sprint3 Instructor",
          passwordHash: "hash",
          status: UserStatus.ACTIVE,
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          email: `s3-outsider-${testSuffix}@akatsuki.test`,
          fullName: "Sprint3 Outsider",
          passwordHash: "hash",
          status: UserStatus.ACTIVE,
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          email: `s3-pending-${testSuffix}@akatsuki.test`,
          fullName: "Sprint3 Pending",
          passwordHash: "hash",
          status: UserStatus.PENDING,
        },
        select: { id: true },
      }),
    ]);

    createdUserIds.push(
      leaderUser.id,
      memberUser.id,
      instructorUser.id,
      outsiderUser.id,
      pendingUser.id
    );
    pendingUserId = pendingUser.id;

    leaderActor = makeActor(
      leaderUser.id,
      "LEADER",
      [
        PERMISSIONS.PROJECT_READ,
        PERMISSIONS.PROJECT_MEMBER_MANAGE,
        PERMISSIONS.TASK_CREATE,
        PERMISSIONS.TASK_READ,
        PERMISSIONS.TASK_UPDATE,
        PERMISSIONS.TASK_ASSIGN,
        PERMISSIONS.TASK_SUBMIT_REVIEW,
        PERMISSIONS.TASK_REVIEW,
        PERMISSIONS.TASK_HISTORY_READ,
      ],
      "Sprint3 Leader"
    );

    memberActor = makeActor(
      memberUser.id,
      "MEMBER",
      [
        PERMISSIONS.PROJECT_READ,
        PERMISSIONS.TASK_READ,
        PERMISSIONS.TASK_UPDATE,
        PERMISSIONS.TASK_SUBMIT_REVIEW,
        PERMISSIONS.TASK_HISTORY_READ,
      ],
      "Sprint3 Member"
    );

    instructorActor = makeActor(
      instructorUser.id,
      "INSTRUCTOR",
      [PERMISSIONS.PROJECT_READ, PERMISSIONS.TASK_READ, PERMISSIONS.TASK_HISTORY_READ],
      "Sprint3 Instructor"
    );

    outsiderActor = makeActor(
      outsiderUser.id,
      "MEMBER",
      [PERMISSIONS.PROJECT_READ, PERMISSIONS.TASK_READ, PERMISSIONS.TASK_UPDATE],
      "Sprint3 Outsider"
    );
  });

  afterAll(async () => {
    // Delete Projects first (cascades Task -> TaskAssignee/TaskDependency/TaskReview/TaskHistory),
    // then Users (satisfying Restrict FKs).
    if (createdProjectIds.length > 0) {
      await prisma.project.deleteMany({
        where: { id: { in: createdProjectIds } },
      });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
  });

  async function createIsolatedProject(status: ProjectStatus = ProjectStatus.CREATED) {
    const project = await prisma.project.create({
      data: {
        name: `S3 Test Project ${randomUUID().slice(0, 8)}`,
        status,
        startDate: new Date("2026-11-01T00:00:00.000Z"),
        endDate: new Date("2026-12-31T00:00:00.000Z"),
        createdById: leaderActor.userId,
        leaderId: leaderActor.userId,
        instructorId: instructorActor.userId,
        members: {
          create: [
            { userId: leaderActor.userId, projectRole: ProjectMemberRole.LEADER },
            { userId: memberActor.userId, projectRole: ProjectMemberRole.MEMBER },
            { userId: instructorActor.userId, projectRole: ProjectMemberRole.INSTRUCTOR },
          ],
        },
      },
      select: { id: true },
    });
    createdProjectIds.push(project.id);
    return project.id;
  }

  it("enforces PostgreSQL CHECK constraints and partial unique index on Sprint 3 tables", async () => {
    const projectId = await createIsolatedProject();
    const task = await createTaskService(leaderActor, projectId, {
      title: "Constraint Verification Task",
      deadline: "2026-12-10T00:00:00.000Z",
      startDate: "2026-11-15T00:00:00.000Z",
    });

    // Task_date_range_chk
    await expect(
      prisma.task.create({
        data: {
          projectId,
          createdById: leaderActor.userId,
          title: "Invalid Dates",
          startDate: new Date("2026-12-20T00:00:00.000Z"),
          deadline: new Date("2026-12-01T00:00:00.000Z"),
        },
      })
    ).rejects.toThrow();

    // Task_estimate_nonnegative_chk
    await expect(
      prisma.task.create({
        data: {
          projectId,
          createdById: leaderActor.userId,
          title: "Negative Hours",
          deadline: new Date("2026-12-01T00:00:00.000Z"),
          estimateHours: -5,
        },
      })
    ).rejects.toThrow();

    // TaskDependency_no_self_chk
    await expect(
      prisma.taskDependency.create({
        data: {
          taskId: task.id,
          dependsOnTaskId: task.id,
          createdById: leaderActor.userId,
        },
      })
    ).rejects.toThrow();

    // TaskReview_reason_nonempty_chk
    await expect(
      prisma.taskReview.create({
        data: {
          taskId: task.id,
          reviewerId: leaderActor.userId,
          decision: ReviewDecision.APPROVED,
          reason: "   ",
        },
      })
    ).rejects.toThrow();

    // TaskAssignee_active_task_user_idx allows soft-unassign -> reassign with history preserved
    await addTaskAssigneeService(leaderActor, task.id, { userId: memberActor.userId });
    await expect(
      prisma.taskAssignee.create({
        data: {
          taskId: task.id,
          userId: memberActor.userId,
          assignedById: leaderActor.userId,
        },
      })
    ).rejects.toThrow();

    await removeTaskAssigneeService(leaderActor, task.id, memberActor.userId);
    await addTaskAssigneeService(leaderActor, task.id, { userId: memberActor.userId });

    const allAssignments = await prisma.taskAssignee.findMany({
      where: { taskId: task.id, userId: memberActor.userId },
      orderBy: { assignedAt: "asc" },
    });
    expect(allAssignments).toHaveLength(2);
    expect(allAssignments[0].removedAt).not.toBeNull();
    expect(allAssignments[1].removedAt).toBeNull();
  });

  it("enforces ProjectMember removal guard via removeProjectMemberService until task is unassigned or DONE", async () => {
    const projectId = await createIsolatedProject();
    const task = await createTaskService(leaderActor, projectId, {
      title: "Blocking Removal Task",
      deadline: "2026-12-10T00:00:00.000Z",
      assigneeIds: [memberActor.userId],
    });

    await expect(
      removeProjectMemberService(leaderActor, projectId, memberActor.userId)
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "TASK_ASSIGNEE_REASSIGN_REQUIRED",
    });

    const activeMembership = await prisma.projectMember.findFirst({
      where: { projectId, userId: memberActor.userId, leftAt: null },
    });
    expect(activeMembership).not.toBeNull();

    // Complete the task -> now DONE no longer blocks member removal
    await updateTaskStatusService(memberActor, task.id, TaskStatus.IN_PROGRESS);
    await submitTaskForReviewService(memberActor, task.id, { note: "Done coding" });
    await approveTaskReviewService(leaderActor, task.id, { reason: "Verified end-to-end" });

    const removedMember = await removeProjectMemberService(
      leaderActor,
      projectId,
      memberActor.userId
    );
    expect(removedMember.leftAt).not.toBeNull();
  });

  it("runs complete Review Workflow, enforces OQ-03/04/05/06/07, and emits post-commit hook", async () => {
    const emitted: TaskDomainEvent[] = [];
    const unregister = registerTaskEventHandler((event) => {
      emitted.push(event);
    });

    try {
      const projectId = await createIsolatedProject(ProjectStatus.CREATED);

      // OQ-06: Creating in CREATED project succeeds
      const task = await createTaskService(leaderActor, projectId, {
        title: "End-to-End Review Flow",
        priority: TaskPriority.CRITICAL,
        deadline: "2026-12-15T00:00:00.000Z",
        assigneeIds: [memberActor.userId],
      });
      expect(task.status).toBe(TaskStatus.TODO);
      expect(task.code).toBe(`#${task.id.slice(0, 8)}`);

      // DEC-015: Member cannot hijack Leader fields
      await expect(
        updateTaskService(memberActor, task.id, { title: "Tampered" })
      ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });

      // Outsider & Instructor write/read restrictions (OQ-07)
      await expect(getTaskDetailService(outsiderActor, task.id)).rejects.toMatchObject({
        statusCode: 403,
        code: "FORBIDDEN",
      });
      const instructorDetail = await getTaskDetailService(instructorActor, task.id);
      expect(instructorDetail.id).toBe(task.id);
      await expect(
        updateTaskService(instructorActor, task.id, { progressNotes: "Edit attempt" })
      ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });

      // Member starts task & updates progress
      await updateTaskService(memberActor, task.id, {
        status: TaskStatus.IN_PROGRESS,
        progressNotes: "Implemented API",
        referenceLinks: ["https://github.com/akatsuki/yui/pull/10"],
      });
      await submitTaskForReviewService(memberActor, task.id, { note: "Ready for review #1" });

      // Leader rejects with reason -> back to IN_PROGRESS
      const rejected = await rejectTaskReviewService(leaderActor, task.id, {
        reason: "Missing unit test coverage",
      });
      expect(rejected.status).toBe(TaskStatus.IN_PROGRESS);
      expect(rejected.completedAt).toBeNull();
      expect(rejected.reviews).toHaveLength(1);
      expect(rejected.reviews[0].decision).toBe(ReviewDecision.REJECTED);

      // Leader self-submits and self-approves (OQ-03)
      await submitTaskForReviewService(leaderActor, task.id, {
        note: "Leader fixed & resubmitted",
      });
      const approved = await approveTaskReviewService(leaderActor, task.id, {
        reason: "Self-verified test fix",
      });
      expect(approved.status).toBe(TaskStatus.DONE);
      expect(approved.completedAt).not.toBeNull();
      expect(approved.reviews).toHaveLength(2);
      expect(approved.reviews[0].decision).toBe(ReviewDecision.APPROVED);

      // OQ-05 / SEC-08: DONE is terminal and strictly read-only
      await expect(
        updateTaskStatusService(leaderActor, task.id, TaskStatus.IN_PROGRESS)
      ).rejects.toMatchObject({ statusCode: 409, code: "TASK_ALREADY_COMPLETED" });

      // History readability for Instructor (OQ-07)
      const history = await listTaskHistoryService(instructorActor, task.id, {
        page: 1,
        pageSize: 50,
      });
      const actions = history.items.map((item) => item.action);
      expect(actions).toContain(TaskHistoryAction.CREATED);
      expect(actions).toContain(TaskHistoryAction.PROGRESS_UPDATED);
      expect(actions).toContain(TaskHistoryAction.STATUS_CHANGED);
      expect(actions).toContain(TaskHistoryAction.REVIEW_SUBMITTED);
      expect(actions).toContain(TaskHistoryAction.REVIEW_REJECTED);
      expect(actions).toContain(TaskHistoryAction.REVIEW_APPROVED);

      // OQ-04: Zero ActivityLog or AuditLog rows written by Task actors
      const [activityCount, auditCount] = await Promise.all([
        prisma.activityLog.count({
          where: { entityType: "TASK", entityId: task.id },
        }),
        prisma.auditLog.count({
          where: { entityType: "TASK", entityId: task.id },
        }),
      ]);
      expect(activityCount).toBe(0);
      expect(auditCount).toBe(0);

      // ARCHIVED project locks all Task mutations
      await prisma.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.ARCHIVED },
      });
      await expect(
        createTaskService(leaderActor, projectId, {
          title: "Blocked on Archive",
          deadline: "2026-12-20T00:00:00.000Z",
        })
      ).rejects.toMatchObject({ statusCode: 409, code: "PROJECT_ARCHIVED" });

      expect(emitted.map((item) => item.type)).toEqual([
        "TASK_ASSIGNED",
        "TASK_SUBMITTED_FOR_REVIEW",
        "TASK_REVIEW_REJECTED",
        "TASK_SUBMITTED_FOR_REVIEW",
        "TASK_REVIEW_APPROVED",
      ]);
    } finally {
      unregister();
    }
  });

  it("enforces dependency gates, diamond DAGs, cycle prevention, and transaction atomicity", async () => {
    const projectId = await createIsolatedProject();
    const [taskA, taskB, taskC, taskD] = await Promise.all([
      createTaskService(leaderActor, projectId, {
        title: "Task A",
        deadline: "2026-12-10T00:00:00.000Z",
      }),
      createTaskService(leaderActor, projectId, {
        title: "Task B",
        deadline: "2026-12-12T00:00:00.000Z",
      }),
      createTaskService(leaderActor, projectId, {
        title: "Task C",
        deadline: "2026-12-14T00:00:00.000Z",
      }),
      createTaskService(leaderActor, projectId, {
        title: "Task D",
        deadline: "2026-12-16T00:00:00.000Z",
      }),
    ]);

    // Build diamond DAG: B->A, C->A, D->B, D->C
    await addTaskDependencyService(leaderActor, taskB.id, { dependsOnTaskId: taskA.id });
    await addTaskDependencyService(leaderActor, taskC.id, { dependsOnTaskId: taskA.id });
    await addTaskDependencyService(leaderActor, taskD.id, { dependsOnTaskId: taskB.id });
    await addTaskDependencyService(leaderActor, taskD.id, { dependsOnTaskId: taskC.id });

    // Indirect cycle A -> D rejected (A -> D -> B -> A)
    await expect(
      addTaskDependencyService(leaderActor, taskA.id, { dependsOnTaskId: taskD.id })
    ).rejects.toMatchObject({ statusCode: 409, code: "TASK_DEPENDENCY_CYCLE" });

    // DEC-005: Task B can still be started & submitted while A is not DONE,
    // but Approve is blocked until A reaches DONE.
    await updateTaskStatusService(leaderActor, taskB.id, TaskStatus.IN_PROGRESS);
    await submitTaskForReviewService(leaderActor, taskB.id, {});
    await expect(
      approveTaskReviewService(leaderActor, taskB.id, { reason: "Blocked test" })
    ).rejects.toMatchObject({ statusCode: 409, code: "TASK_DEPENDENCY_NOT_COMPLETED" });

    // Complete A -> now approving B succeeds
    await updateTaskStatusService(leaderActor, taskA.id, TaskStatus.IN_PROGRESS);
    await submitTaskForReviewService(leaderActor, taskA.id, {});
    await approveTaskReviewService(leaderActor, taskA.id, { reason: "A finished" });

    const approvedB = await approveTaskReviewService(leaderActor, taskB.id, {
      reason: "A is now DONE",
    });
    expect(approvedB.status).toBe(TaskStatus.DONE);

    // SEC-08: DONE Task B is strictly read-only and rejects adding dependencies
    await expect(
      addTaskDependencyService(leaderActor, taskB.id, { dependsOnTaskId: taskC.id })
    ).rejects.toMatchObject({ statusCode: 409, code: "TASK_ALREADY_COMPLETED" });

    // Remove dependency cleanly
    const depsAfterRemove = await removeTaskDependencyService(leaderActor, taskD.id, taskC.id);
    expect(depsAfterRemove.map((d) => d.dependsOnTaskId)).toEqual([taskB.id]);

    // Rollback integrity: creating a task with [valid, pending] assignees creates 0 tasks
    const beforeCount = await prisma.task.count({ where: { projectId } });
    await expect(
      createTaskService(leaderActor, projectId, {
        title: "Atomic Rollback Task",
        deadline: "2026-12-20T00:00:00.000Z",
        assigneeIds: [memberActor.userId, pendingUserId],
      })
    ).rejects.toMatchObject({ statusCode: 409, code: "ACCOUNT_NOT_ACTIVE" });
    const afterCount = await prisma.task.count({ where: { projectId } });
    expect(afterCount).toBe(beforeCount);
  });

  it("serializes concurrent status transitions via CAS and concurrent opposite dependencies via advisory lock", async () => {
    const projectId = await createIsolatedProject();
    const [task1, taskX, taskY] = await Promise.all([
      createTaskService(leaderActor, projectId, {
        title: "Concurrent Review Task",
        deadline: "2026-12-20T00:00:00.000Z",
      }),
      createTaskService(leaderActor, projectId, {
        title: "Race Node X",
        deadline: "2026-12-20T00:00:00.000Z",
      }),
      createTaskService(leaderActor, projectId, {
        title: "Race Node Y",
        deadline: "2026-12-20T00:00:00.000Z",
      }),
    ]);

    await updateTaskStatusService(leaderActor, task1.id, TaskStatus.IN_PROGRESS);
    await submitTaskForReviewService(leaderActor, task1.id, {});

    // Concurrent approve vs reject race on the exact same REVIEW task
    const reviewRace = await Promise.allSettled([
      approveTaskReviewService(leaderActor, task1.id, { reason: "Concurrent approve" }),
      rejectTaskReviewService(leaderActor, task1.id, { reason: "Concurrent reject" }),
    ]);

    const reviewSuccesses = reviewRace.filter((r) => r.status === "fulfilled");
    const reviewFailures = reviewRace.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected"
    );
    expect(reviewSuccesses).toHaveLength(1);
    expect(reviewFailures).toHaveLength(1);
    expect(["TASK_ALREADY_COMPLETED", "INVALID_STATUS_TRANSITION"]).toContain(
      (reviewFailures[0].reason as AppError).code
    );

    const reviewRows = await prisma.taskReview.count({ where: { taskId: task1.id } });
    expect(reviewRows).toBe(1);

    // Concurrent opposite dependency race X->Y vs Y->X protected by pg_advisory_xact_lock
    const depRace = await Promise.allSettled([
      addTaskDependencyService(leaderActor, taskX.id, { dependsOnTaskId: taskY.id }),
      addTaskDependencyService(leaderActor, taskY.id, { dependsOnTaskId: taskX.id }),
    ]);

    const depSuccesses = depRace.filter((r) => r.status === "fulfilled");
    const depFailures = depRace.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(depSuccesses).toHaveLength(1);
    expect(depFailures).toHaveLength(1);
    expect((depFailures[0].reason as AppError).code).toBe("TASK_DEPENDENCY_CYCLE");

    const totalRaceEdges = await prisma.taskDependency.count({
      where: {
        OR: [
          { taskId: taskX.id, dependsOnTaskId: taskY.id },
          { taskId: taskY.id, dependsOnTaskId: taskX.id },
        ],
      },
    });
    expect(totalRaceEdges).toBe(1);

    // Sync assignees idempotent re-check
    const synced = await syncTaskAssigneesService(leaderActor, taskX.id, {
      assigneeIds: [memberActor.userId],
    });
    expect(synced.map((item) => item.userId)).toEqual([memberActor.userId]);
  });
});
