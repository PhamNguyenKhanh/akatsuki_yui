import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import { loadTrustedAuthContext } from "@/modules/authorization/policy.service";
import { archiveProjectService } from "@/modules/projects/project.service";
import {
  grantRolePermissionService,
  revokeRolePermissionService,
} from "@/modules/roles/role.service";
import { getKanbanBoardService } from "@/modules/sprints/kanban.service";
import { getSprintProgressAndBurndownService } from "@/modules/sprints/sprint-analytics.service";
import {
  completeSprintService,
  getSprintCompletionPreviewService,
} from "@/modules/sprints/sprint-completion.service";
import {
  assignTasksToSprintService,
  listBacklogTasksService,
  moveSprintTaskService,
} from "@/modules/sprints/sprint-planning.service";
import {
  activateSprintService,
  cancelSprintService,
  createSprintService,
  getSprintDetailService,
  listProjectSprintsService,
  updateSprintService,
} from "@/modules/sprints/sprint.service";
import { addTaskDependencyService } from "@/modules/tasks/task-dependency.service";
import { createTaskService } from "@/modules/tasks/task.service";
import {
  approveTaskReviewService,
  rejectTaskReviewService,
  submitTaskForReviewService,
  updateTaskStatusService,
} from "@/modules/tasks/task-workflow.service";
import type { AuthContext } from "@/types/auth";

vi.mock("server-only", () => ({}));

const runTag = randomUUID().slice(0, 8);
const createdUserIds: string[] = [];
const createdProjectIds: string[] = [];
let parkedActiveProjectId: string | null = null;

async function createSeededUser(
  prefix: string,
  roleName: (typeof ROLES)[keyof typeof ROLES]
): Promise<string> {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
  const passwordHash = await hashPassword("Sprint4Pass@123");
  const user = await prisma.user.create({
    data: {
      email: `s4-${prefix}-${runTag}@test.akatsuki.local`,
      fullName: `Sprint4 ${prefix}`,
      passwordHash,
      status: UserStatus.ACTIVE,
      userRoles: { create: { roleId: role.id } },
    },
    select: { id: true },
  });
  createdUserIds.push(user.id);
  return user.id;
}

describe("Sprint 4 PostgreSQL Integration & Concurrency Tests", () => {
  let adminActor: AuthContext;
  let leaderActor: AuthContext;
  let leader2Actor: AuthContext;
  let memberActor: AuthContext;
  let instructorActor: AuthContext;
  let leader2Id: string;

  beforeAll(async () => {
    const existingActive = await prisma.project.findFirst({
      where: { status: ProjectStatus.ACTIVE },
      select: { id: true },
    });
    if (existingActive) {
      parkedActiveProjectId = existingActive.id;
      await prisma.project.update({
        where: { id: existingActive.id },
        data: { status: ProjectStatus.CREATED },
      });
    }

    const [adminId, leaderId, l2Id, memberId, instructorId] = await Promise.all([
      createSeededUser("admin", ROLES.ADMIN),
      createSeededUser("leader", ROLES.LEADER),
      createSeededUser("leader2", ROLES.LEADER),
      createSeededUser("member", ROLES.MEMBER),
      createSeededUser("instructor", ROLES.INSTRUCTOR),
    ]);
    leader2Id = l2Id;

    [adminActor, leaderActor, leader2Actor, memberActor, instructorActor] = await Promise.all([
      loadTrustedAuthContext(adminId),
      loadTrustedAuthContext(leaderId),
      loadTrustedAuthContext(l2Id),
      loadTrustedAuthContext(memberId),
      loadTrustedAuthContext(instructorId),
    ]);
  });

  afterAll(async () => {
    if (createdProjectIds.length > 0) {
      await prisma.activityLog.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await prisma.auditLog.deleteMany({
        where: { actorId: { in: createdUserIds } },
      });
      await prisma.project.deleteMany({
        where: { id: { in: createdProjectIds } },
      });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
    if (parkedActiveProjectId) {
      await prisma.project.update({
        where: { id: parkedActiveProjectId },
        data: { status: ProjectStatus.ACTIVE },
      });
    }
  });

  async function createTestProject(status: ProjectStatus = ProjectStatus.ACTIVE): Promise<string> {
    if (status === ProjectStatus.ACTIVE) {
      // Archive any leftover ACTIVE test project from this file before activating a new one
      await prisma.project.updateMany({
        where: { id: { in: createdProjectIds }, status: ProjectStatus.ACTIVE },
        data: { status: ProjectStatus.ARCHIVED, archivedAt: new Date() },
      });
    }

    const project = await prisma.project.create({
      data: {
        name: `S4 Project ${randomUUID().slice(0, 8)}`,
        status,
        startDate: new Date("2026-11-01T00:00:00.000Z"),
        endDate: new Date("2026-12-31T00:00:00.000Z"),
        createdById: leaderActor.userId,
        leaderId: leaderActor.userId,
        instructorId: instructorActor.userId,
        members: {
          create: [
            { userId: leaderActor.userId, projectRole: ProjectMemberRole.LEADER },
            { userId: leader2Id, projectRole: ProjectMemberRole.LEADER },
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

  it("enforces Sprint DB constraints and trg_task_sprint_same_project cross-project trigger", async () => {
    const projectA = await createTestProject(ProjectStatus.CREATED);
    const projectB = await createTestProject(ProjectStatus.CREATED);

    // Sprint_date_range_chk
    await expect(
      prisma.sprint.create({
        data: {
          projectId: projectA,
          createdById: leaderActor.userId,
          name: "Bad Dates",
          startDate: new Date("2026-11-20T00:00:00.000Z"),
          endDate: new Date("2026-11-10T00:00:00.000Z"),
        },
      })
    ).rejects.toThrow();

    // Sprint_name_nonempty_chk
    await expect(
      prisma.sprint.create({
        data: {
          projectId: projectA,
          createdById: leaderActor.userId,
          name: "   ",
          startDate: new Date("2026-11-10T00:00:00.000Z"),
          endDate: new Date("2026-11-20T00:00:00.000Z"),
        },
      })
    ).rejects.toThrow();

    const sprintB = await createSprintService(leaderActor, projectB, {
      name: "Sprint Project B",
      startDate: "2026-11-10",
      endDate: "2026-11-20",
    });

    const taskA = await createTaskService(leaderActor, projectA, {
      title: "Task in Project A",
      deadline: "2026-12-01T00:00:00.000Z",
    });

    // Cross-project service check (400)
    await expect(
      assignTasksToSprintService(leaderActor, sprintB.sprint.id, { taskIds: [taskA.id] })
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });

    // Cross-project PostgreSQL Trigger trg_task_sprint_same_project directly in SQL
    await expect(
      prisma.$executeRaw`UPDATE "Task" SET "sprintId" = ${sprintB.sprint.id}::uuid WHERE "id" = ${taskA.id}::uuid`
    ).rejects.toThrow();
  });

  it("enforces Sprint Lifecycle (CREATED vs ACTIVE project gate, multiple ACTIVE Sprints DEC-006, locked startDate, and PLANNED-only Cancel DEC-028)", async () => {
    const createdProjectId = await createTestProject(ProjectStatus.CREATED);
    const plannedInCreated = await createSprintService(leaderActor, createdProjectId, {
      name: "Planned Early Sprint",
      startDate: "2026-11-10",
      endDate: "2026-11-20",
    });
    expect(plannedInCreated.sprint.status).toBe(SprintStatus.PLANNED);

    // DEC-026: Cannot activate Sprint while Project is CREATED
    await expect(
      activateSprintService(leaderActor, plannedInCreated.sprint.id)
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "INVALID_STATUS_TRANSITION",
    });

    // Now test on an ACTIVE project
    const projectId = await createTestProject(ProjectStatus.ACTIVE);
    const futureStart = "2099-01-10";
    const s1 = await createSprintService(leaderActor, projectId, {
      name: "Frontend Track",
      goal: "Build UI",
      startDate: futureStart,
      endDate: "2099-01-24",
    });

    // Overlapping date returns non-blocking warning metadata
    const s2 = await createSprintService(leaderActor, projectId, {
      name: "Backend Track",
      goal: "Build API",
      startDate: "2099-01-15",
      endDate: "2099-01-30",
    });
    expect(s2.overlappingSprints.map((x) => x.id)).toContain(s1.sprint.id);

    // DEC-026 & DEC-006: Activate both Sprints before startDate simultaneously
    const activated1 = await activateSprintService(leaderActor, s1.sprint.id);
    const activated2 = await activateSprintService(leaderActor, s2.sprint.id);
    expect(activated1.status).toBe(SprintStatus.ACTIVE);
    expect(activated1.startDate.toISOString().slice(0, 10)).toBe(futureStart);
    expect(activated2.status).toBe(SprintStatus.ACTIVE);

    const activeList = await listProjectSprintsService(memberActor, projectId, {
      status: SprintStatus.ACTIVE,
    });
    expect(activeList).toHaveLength(2);

    // DEC-027: ACTIVE Sprint locks startDate, allows name/endDate update
    await expect(
      updateSprintService(leaderActor, s1.sprint.id, { startDate: "2099-01-12" })
    ).rejects.toMatchObject({ statusCode: 409, code: "SPRINT_INVALID_STATUS" });

    const updatedActive = await updateSprintService(leaderActor, s1.sprint.id, {
      name: "Frontend Track v2",
      endDate: "2099-01-26",
      expectedUpdatedAt: activated1.updatedAt.toISOString(),
    });
    expect(updatedActive.sprint.name).toBe("Frontend Track v2");

    // DEC-028: ACTIVE Sprint CANNOT be cancelled
    await expect(cancelSprintService(leaderActor, s1.sprint.id)).rejects.toMatchObject({
      statusCode: 409,
      code: "INVALID_STATUS_TRANSITION",
    });

    // Create PLANNED Sprint 3 with a Task -> Cancel PLANNED Sprint returns Task to Backlog with history
    const s3 = await createSprintService(leaderActor, projectId, {
      name: "Cancelled Track",
      startDate: "2099-02-01",
      endDate: "2099-02-14",
    });
    const backlogTask = await createTaskService(leaderActor, projectId, {
      title: "Task To Return On Cancel",
      deadline: "2099-02-10T00:00:00.000Z",
    });
    await assignTasksToSprintService(leaderActor, s3.sprint.id, { taskIds: [backlogTask.id] });

    const cancelledS3 = await cancelSprintService(leaderActor, s3.sprint.id, {
      reason: "Scope shifted",
    });
    expect(cancelledS3.status).toBe(SprintStatus.CANCELLED);

    const taskAfterCancel = await prisma.task.findUniqueOrThrow({
      where: { id: backlogTask.id },
      select: { sprintId: true },
    });
    expect(taskAfterCancel.sprintId).toBeNull();

    const cancelHistory = await prisma.taskHistory.findFirst({
      where: { taskId: backlogTask.id, action: TaskHistoryAction.SPRINT_REMOVED },
    });
    expect(cancelHistory).not.toBeNull();
  });

  it("handles Backlog filters, Sprint Planning (batch add, REVIEW warning/move, DONE lock, history), and concurrent Planning Race", async () => {
    const projectId = await createTestProject(ProjectStatus.ACTIVE);
    const sprintA = await createSprintService(leaderActor, projectId, {
      name: "Sprint Alpha",
      startDate: "2026-11-01",
      endDate: "2026-11-15",
    });
    const sprintB = await createSprintService(leaderActor, projectId, {
      name: "Sprint Beta",
      startDate: "2026-11-16",
      endDate: "2026-11-30",
    });

    // New Tasks always land in Backlog (sprintId = null)
    const tReview = await createTaskService(leaderActor, projectId, {
      title: "Backlog Review Item",
      priority: TaskPriority.CRITICAL,
      deadline: "2026-11-12T10:00:00.000Z",
      estimateHours: 5,
      assigneeIds: [memberActor.userId],
    });
    expect(tReview.sprintId).toBeNull();

    const tDone = await createTaskService(leaderActor, projectId, {
      title: "Backlog Already Done",
      priority: TaskPriority.LOW,
      deadline: "2026-11-18T10:00:00.000Z",
    });
    await updateTaskStatusService(leaderActor, tDone.id, TaskStatus.IN_PROGRESS);
    await submitTaskForReviewService(leaderActor, tDone.id, { note: "Ready" });
    await approveTaskReviewService(leaderActor, tDone.id, { reason: "LGTM" });

    const tRace = await createTaskService(leaderActor, projectId, {
      title: "Race Target Backlog Task",
      priority: TaskPriority.HIGH,
      deadline: "2026-11-10T10:00:00.000Z",
    });

    // Backlog search & multi-filter
    const backlogFiltered = await listBacklogTasksService(memberActor, projectId, {
      priority: TaskPriority.CRITICAL,
      assigneeId: memberActor.userId,
      deadlineFrom: "2026-11-12",
      deadlineTo: "2026-11-12",
    });
    expect(backlogFiltered.items.map((t) => t.id)).toEqual([tReview.id]);

    // Done Task cannot be assigned to Sprint (DEC-030)
    await expect(
      assignTasksToSprintService(leaderActor, sprintA.sprint.id, { taskIds: [tDone.id] })
    ).rejects.toMatchObject({ statusCode: 409, code: "TASK_ALREADY_COMPLETED" });

    // Move tReview to REVIEW state, assign to Sprint A, then move straight to Sprint B while preserving REVIEW
    await updateTaskStatusService(memberActor, tReview.id, TaskStatus.IN_PROGRESS);
    await submitTaskForReviewService(memberActor, tReview.id, { note: "Please check" });

    await assignTasksToSprintService(leaderActor, sprintA.sprint.id, { taskIds: [tReview.id] });
    const movedReview = await moveSprintTaskService(leaderActor, sprintA.sprint.id, tReview.id, {
      targetSprintId: sprintB.sprint.id,
    });
    expect(movedReview.sprintId).toBe(sprintB.sprint.id);
    expect(movedReview.status).toBe(TaskStatus.REVIEW);

    // Move back to Backlog
    const returnedToBacklog = await moveSprintTaskService(
      leaderActor,
      sprintB.sprint.id,
      tReview.id,
      { targetSprintId: null }
    );
    expect(returnedToBacklog.sprintId).toBeNull();

    // Concurrent Planning Race (Promise.allSettled): Leader 1 & Leader 2 assign same Backlog task into Sprint A vs Sprint B
    const results = await Promise.allSettled([
      assignTasksToSprintService(leaderActor, sprintA.sprint.id, { taskIds: [tRace.id] }),
      assignTasksToSprintService(leader2Actor, sprintB.sprint.id, { taskIds: [tRace.id] }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(AppError);
    expect((rejected[0].reason as AppError).code).toBe("SPRINT_TASK_ALREADY_ASSIGNED");

    const raceHistoryCount = await prisma.taskHistory.count({
      where: { taskId: tRace.id, action: TaskHistoryAction.SPRINT_ASSIGNED },
    });
    expect(raceHistoryCount).toBe(1);
  });

  it("handles Complete Sprint atomicity, rollback on invalid target, concurrent Complete vs Workflow/Planning races, and Archive Project vs Sprint Mutation race", async () => {
    const projectId = await createTestProject(ProjectStatus.ACTIVE);
    const sprintActive = await createSprintService(leaderActor, projectId, {
      name: "Active Sprint Close",
      startDate: "2026-11-01",
      endDate: "2026-11-15",
    });
    await activateSprintService(leaderActor, sprintActive.sprint.id);

    const sprintNext = await createSprintService(leaderActor, projectId, {
      name: "Next Planned Sprint",
      startDate: "2026-11-16",
      endDate: "2026-11-30",
    });

    const tDone = await createTaskService(leaderActor, projectId, {
      title: "Finish In Sprint",
      deadline: "2026-11-10T00:00:00.000Z",
      estimateHours: 8,
    });
    const tBacklogMove = await createTaskService(leaderActor, projectId, {
      title: "Return Backlog On Complete",
      deadline: "2026-11-12T00:00:00.000Z",
      estimateHours: 4,
    });
    const tNextMove = await createTaskService(leaderActor, projectId, {
      title: "Carry Over To Next Sprint",
      deadline: "2026-11-14T00:00:00.000Z",
      estimateHours: 6,
    });

    await assignTasksToSprintService(leaderActor, sprintActive.sprint.id, {
      taskIds: [tDone.id, tBacklogMove.id, tNextMove.id],
    });

    await updateTaskStatusService(leaderActor, tDone.id, TaskStatus.IN_PROGRESS);
    await submitTaskForReviewService(leaderActor, tDone.id, { note: "Done" });
    await approveTaskReviewService(leaderActor, tDone.id, { reason: "Verified" });

    // Atomicity/Rollback test: 1 invalid targetSprintId fails entire complete transaction
    await expect(
      completeSprintService(leaderActor, sprintActive.sprint.id, {
        taskDispositions: [
          { taskId: tBacklogMove.id, action: "MOVE_TO_BACKLOG" },
          {
            taskId: tNextMove.id,
            action: "MOVE_TO_SPRINT",
            targetSprintId: sprintActive.sprint.id, // invalid self-target
          },
        ],
      })
    ).rejects.toMatchObject({ statusCode: 409, code: "SPRINT_INVALID_DISPOSITION_TARGET" });

    // Verify rollback left everything unchanged
    const afterFailedComplete = await getSprintDetailService(leaderActor, sprintActive.sprint.id);
    expect(afterFailedComplete.status).toBe(SprintStatus.ACTIVE);
    expect(afterFailedComplete.tasks).toHaveLength(3);

    // Concurrent Complete vs Assign Task race
    const extraBacklogTask = await createTaskService(leaderActor, projectId, {
      title: "Late Added Task",
      deadline: "2026-11-15T00:00:00.000Z",
    });

    const raceCompleteVsAssign = await Promise.allSettled([
      assignTasksToSprintService(leader2Actor, sprintActive.sprint.id, {
        taskIds: [extraBacklogTask.id],
      }),
      completeSprintService(leaderActor, sprintActive.sprint.id, {
        taskDispositions: [
          { taskId: tBacklogMove.id, action: "MOVE_TO_BACKLOG" },
          {
            taskId: tNextMove.id,
            action: "MOVE_TO_SPRINT",
            targetSprintId: sprintNext.sprint.id,
          },
        ],
      }),
    ]);

    // Either Assign wins first (Complete sees missing disposition -> rejects 409)
    // OR Complete wins first (Assign sees sprint not planning eligible -> rejects 409).
    // NEVER can both succeed or leave extraBacklogTask stranded inside COMPLETED sprint!
    expect(raceCompleteVsAssign.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(raceCompleteVsAssign.filter((r) => r.status === "rejected")).toHaveLength(1);

    const sprintStateAfterRace = await getSprintDetailService(leaderActor, sprintActive.sprint.id);
    if (sprintStateAfterRace.status === SprintStatus.ACTIVE) {
      // Now test Concurrent Complete vs Workflow Approve (tNextMove transitions REVIEW -> DONE concurrently)
      await updateTaskStatusService(leaderActor, tNextMove.id, TaskStatus.IN_PROGRESS);
      await submitTaskForReviewService(leaderActor, tNextMove.id, { note: "Review race" });

      const preview = await getSprintCompletionPreviewService(leaderActor, sprintActive.sprint.id);
      const completePayload = {
        expectedUpdatedAt: preview.sprint.updatedAt.toISOString(),
        taskDispositions: preview.unfinishedTasks.map((t) => ({
          taskId: t.id,
          action: "MOVE_TO_BACKLOG" as const,
          expectedStatus: t.status,
        })),
      };

      const raceCompleteVsApprove = await Promise.allSettled([
        approveTaskReviewService(leader2Actor, tNextMove.id, { reason: "Concurrent approve" }),
        completeSprintService(leaderActor, sprintActive.sprint.id, completePayload),
      ]);

      expect(raceCompleteVsApprove.some((r) => r.status === "fulfilled")).toBe(true);

      // Re-fetch current state; if still ACTIVE, finish cleanly with updated preview
      const postApproveCheck = await getSprintDetailService(leaderActor, sprintActive.sprint.id);
      if (postApproveCheck.status === SprintStatus.ACTIVE) {
        const freshPreview = await getSprintCompletionPreviewService(
          leaderActor,
          sprintActive.sprint.id
        );
        await completeSprintService(leaderActor, sprintActive.sprint.id, {
          expectedUpdatedAt: freshPreview.sprint.updatedAt.toISOString(),
          taskDispositions: freshPreview.unfinishedTasks.map((t) => ({
            taskId: t.id,
            action: "MOVE_TO_BACKLOG",
            expectedStatus: t.status,
          })),
        });
      }
    }

    const finalClosed = await getSprintDetailService(leaderActor, sprintActive.sprint.id);
    expect(finalClosed.status).toBe(SprintStatus.COMPLETED);
    expect(finalClosed.tasks.every((t) => t.status === TaskStatus.DONE)).toBe(true);
    expect(finalClosed.tasks.some((t) => t.id === tDone.id)).toBe(true);

    // Concurrent Archive Project vs Sprint Mutation race on sprintNext
    const archiveVsCreate = await Promise.allSettled([
      archiveProjectService(leaderActor, projectId),
      createSprintService(leader2Actor, projectId, {
        name: "Race Against Archive",
        startDate: "2026-12-01",
        endDate: "2026-12-10",
      }),
    ]);

    const archivedProjectRow = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { status: true },
    });
    expect(archivedProjectRow.status).toBe(ProjectStatus.ARCHIVED);
    expect(archiveVsCreate[0].status).toBe("fulfilled");
    // Post-archive mutation always rejected with 409 PROJECT_ARCHIVED
    await expect(activateSprintService(leaderActor, sprintNext.sprint.id)).rejects.toMatchObject({
      statusCode: 409,
      code: "PROJECT_ARCHIVED",
    });
  });

  it("integrates Kanban Board filters, Dependency Gate via Workflow, Burndown reconstruction, and live RBAC revocation", async () => {
    const projectId = await createTestProject(ProjectStatus.ACTIVE);
    const hcmNowMs = Date.now() + 7 * 3600_000;
    const todayStr = new Date(hcmNowMs).toISOString().slice(0, 10);
    const twoWeeksLaterStr = new Date(hcmNowMs + 14 * 24 * 3600_000).toISOString().slice(0, 10);
    const sprint = await createSprintService(leaderActor, projectId, {
      name: "Kanban & Burndown Sprint",
      startDate: todayStr,
      endDate: twoWeeksLaterStr,
    });
    await activateSprintService(leaderActor, sprint.sprint.id);

    const predecessor = await createTaskService(leaderActor, projectId, {
      title: "Predecessor Auth",
      deadline: "2099-12-10T00:00:00.000Z",
      estimateHours: 6,
      assigneeIds: [memberActor.userId],
    });
    const blockedTask = await createTaskService(leaderActor, projectId, {
      title: "Blocked Kanban Card",
      deadline: "2099-12-15T00:00:00.000Z",
      estimateHours: 4,
      assigneeIds: [memberActor.userId],
    });
    await addTaskDependencyService(leaderActor, blockedTask.id, {
      dependsOnTaskId: predecessor.id,
    });
    await assignTasksToSprintService(leaderActor, sprint.sprint.id, {
      taskIds: [predecessor.id, blockedTask.id],
    });

    // Kanban Sprint-filtered board shows blockedByCount
    const sprintBoard = await getKanbanBoardService(memberActor, projectId, {
      scope: "SPRINT",
      sprintId: sprint.sprint.id,
    });
    expect(sprintBoard.columns.TODO).toHaveLength(2);
    const blockedCard = sprintBoard.columns.TODO.find((c) => c.id === blockedTask.id)!;
    expect(blockedCard.blockedByCount).toBe(1);

    // Workflow progression through Sprint 3 services: blockedTask cannot be APPROVED while predecessor is not DONE (DEC-005)
    await updateTaskStatusService(memberActor, blockedTask.id, TaskStatus.IN_PROGRESS);
    await submitTaskForReviewService(memberActor, blockedTask.id, { note: "Attempt early" });
    await expect(
      approveTaskReviewService(leaderActor, blockedTask.id, { reason: "Try approve" })
    ).rejects.toMatchObject({ statusCode: 409, code: "TASK_DEPENDENCY_NOT_COMPLETED" });

    // Reject requires reason, returns to IN_PROGRESS
    await rejectTaskReviewService(leaderActor, blockedTask.id, { reason: "Wait for predecessor" });
    const afterReject = await getKanbanBoardService(leaderActor, projectId, {
      scope: "SPRINT",
      sprintId: sprint.sprint.id,
    });
    expect(afterReject.columns.IN_PROGRESS.map((t) => t.id)).toContain(blockedTask.id);

    // Complete predecessor, then approve blockedTask
    await updateTaskStatusService(memberActor, predecessor.id, TaskStatus.IN_PROGRESS);
    await submitTaskForReviewService(memberActor, predecessor.id, { note: "Done pred" });
    await approveTaskReviewService(leaderActor, predecessor.id, { reason: "Approved pred" });

    await submitTaskForReviewService(memberActor, blockedTask.id, { note: "Retry after pred" });
    await approveTaskReviewService(leaderActor, blockedTask.id, { reason: "Now complete" });

    const analytics = await getSprintProgressAndBurndownService(instructorActor, sprint.sprint.id);
    expect(analytics.progress.progressPercent).toBe(100);
    expect(analytics.burndown.hasEstimateData).toBe(true);
    expect(analytics.burndown.completedEstimateHours).toBe(10);

    // Real DB RBAC check: Instructor cannot mutate; revoking sprint.manage blocks Leader immediately
    await expect(
      createSprintService(instructorActor, projectId, {
        name: "Instructor Forbidden",
        startDate: "2099-03-01",
        endDate: "2099-03-10",
      })
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });

    const leaderRole = await prisma.role.findUniqueOrThrow({ where: { name: ROLES.LEADER } });
    const sprintManagePerm = await prisma.permission.findUniqueOrThrow({
      where: { code: PERMISSIONS.SPRINT_MANAGE },
    });

    await revokeRolePermissionService(adminActor, leaderRole.id, {
      permissionId: sprintManagePerm.id,
    });
    try {
      const staleRemovedActor = await loadTrustedAuthContext(leaderActor.userId);
      await expect(
        createSprintService(staleRemovedActor, projectId, {
          name: "Revoked Leader",
          startDate: "2099-03-01",
          endDate: "2099-03-10",
        })
      ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
    } finally {
      await grantRolePermissionService(adminActor, leaderRole.id, {
        permissionId: sprintManagePerm.id,
      });
    }
  });
});
