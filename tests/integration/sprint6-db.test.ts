import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  ProjectMemberRole,
  ProjectStatus,
  TaskHistoryAction,
  TaskPriority,
  TaskStatus,
  UserStatus,
} from "@prisma/client";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { listUnifiedActivityService } from "@/modules/activity/activity.service";
import { ROLES } from "@/modules/authorization/constants";
import { loadTrustedAuthContext } from "@/modules/authorization/policy.service";
import { getOperationalDashboardService } from "@/modules/dashboard/dashboard.service";
import { removeProjectMemberService } from "@/modules/project-members/member.service";
import {
  activateProjectService,
  archiveProjectService,
  createProjectService,
} from "@/modules/projects/project.service";
import { getMemberContributionReportService } from "@/modules/reports/member-contribution.service";
import { getProjectAnalyticsService } from "@/modules/reports/project-analytics.service";
import { getProjectSprintReportService } from "@/modules/reports/sprint-report.service";
import { getSprintProgressAndBurndownService } from "@/modules/sprints/sprint-analytics.service";
import {
  completeSprintService,
  getSprintCompletionPreviewService,
} from "@/modules/sprints/sprint-completion.service";
import { assignTasksToSprintService } from "@/modules/sprints/sprint-planning.service";
import { activateSprintService, createSprintService } from "@/modules/sprints/sprint.service";
import { syncTaskAssigneesService } from "@/modules/tasks/task-assignment.service";
import { createTaskService, updateTaskService } from "@/modules/tasks/task.service";
import {
  approveTaskReviewService,
  submitTaskForReviewService,
  updateTaskStatusService,
} from "@/modules/tasks/task-workflow.service";
import type { AuthContext } from "@/types/auth";

vi.mock("server-only", () => ({}));

const runTag = randomUUID().slice(0, 8);
const createdUserIds: string[] = [];
const createdProjectIds: string[] = [];
let parkedActiveProjectId: string | null = null;

function getHcmDayYmdOffset(daysOffset: number): string {
  const hcmNowMs = Date.now() + 7 * 3_600_000 + daysOffset * 86_400_000;
  return new Date(hcmNowMs).toISOString().slice(0, 10);
}

async function createSeededUser(
  prefix: string,
  roleName: (typeof ROLES)[keyof typeof ROLES]
): Promise<AuthContext> {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
  const passwordHash = await hashPassword("Sprint6Pass@123");
  const user = await prisma.user.create({
    data: {
      email: `s6-${prefix}-${runTag}@test.akatsuki.local`,
      fullName: `Sprint6 ${prefix}`,
      passwordHash,
      status: UserStatus.ACTIVE,
      approvedAt: new Date(),
      userRoles: { create: { roleId: role.id } },
    },
    select: { id: true },
  });
  createdUserIds.push(user.id);
  return loadTrustedAuthContext(user.id);
}

async function parkCreatedActiveProjects(): Promise<void> {
  if (createdProjectIds.length === 0) return;
  await prisma.project.updateMany({
    where: {
      id: { in: createdProjectIds },
      status: ProjectStatus.ACTIVE,
    },
    data: {
      status: ProjectStatus.ARCHIVED,
      archivedAt: new Date(),
    },
  });
}

describe("Sprint 6 PostgreSQL Integration Tests — Dashboard, Reports, Analytics & Unified Activity", () => {
  let adminActor: AuthContext;
  let leaderActor: AuthContext;
  let member1Actor: AuthContext;
  let member2Actor: AuthContext;
  let instructorActor: AuthContext;

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

    adminActor = await createSeededUser("admin", ROLES.ADMIN);
    leaderActor = await createSeededUser("leader", ROLES.LEADER);
    member1Actor = await createSeededUser("member1", ROLES.MEMBER);
    member2Actor = await createSeededUser("member2", ROLES.MEMBER);
    instructorActor = await createSeededUser("instructor", ROLES.INSTRUCTOR);
  });

  afterAll(async () => {
    if (createdProjectIds.length > 0) {
      await prisma.activityLog.deleteMany({
        where: {
          OR: [{ projectId: { in: createdProjectIds } }, { entityId: { in: createdProjectIds } }],
        },
      });
      await prisma.document.deleteMany({
        where: { projectId: { in: createdProjectIds } },
      });
      await prisma.project.deleteMany({
        where: { id: { in: createdProjectIds } },
      });
    }

    if (createdUserIds.length > 0) {
      await prisma.notification.deleteMany({
        where: {
          OR: [{ userId: { in: createdUserIds } }, { actorId: { in: createdUserIds } }],
        },
      });
      await prisma.auditLog.deleteMany({
        where: {
          OR: [{ actorId: { in: createdUserIds } }, { entityId: { in: createdUserIds } }],
        },
      });
      await prisma.activityLog.deleteMany({
        where: {
          OR: [{ userId: { in: createdUserIds } }, { entityId: { in: createdUserIds } }],
        },
      });
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }

    if (parkedActiveProjectId) {
      await prisma.project
        .update({
          where: { id: parkedActiveProjectId },
          data: { status: ProjectStatus.ACTIVE },
        })
        .catch(() => undefined);
    }

    await prisma.$disconnect();
  });

  it("preserves Sprint 2–5 custom partial indexes & triggers alongside Sprint 6 reporting indexes", async () => {
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
    `;
    const indexNames = new Set(indexes.map((row) => row.indexname));

    const requiredIndexes = [
      // Pre-existing Sprint 2–4 partial & composite indexes that must survive Sprint 6 migration
      "Project_single_active_idx",
      "ProjectMember_active_project_user_idx",
      "TaskAssignee_active_task_user_idx",
      "Task_projectId_backlog_deadline_idx",
      // Sprint 6 reporting & cursor indexes
      "ActivityLog_projectId_createdAt_id_idx",
      "ActivityLog_userId_createdAt_id_idx",
      "ActivityLog_createdAt_id_idx",
      "Task_projectId_completedAt_idx",
      "TaskHistory_actorId_action_createdAt_idx",
      "TaskHistory_createdAt_id_idx",
      "TaskReview_taskId_decision_reviewedAt_idx",
    ];

    for (const indexName of requiredIndexes) {
      expect(indexNames.has(indexName)).toBe(true);
    }

    const triggers = await prisma.$queryRaw<Array<{ tgname: string }>>`
      SELECT tgname
      FROM pg_trigger
      WHERE NOT tgisinternal
    `;
    const triggerNames = new Set(triggers.map((row) => row.tgname));

    expect(triggerNames.has("trg_task_sprint_same_project")).toBe(true);
    expect(triggerNames.has("trg_document_sprint_same_project")).toBe(true);
  });

  it("handles guarded SQL backfill of ActivityLog.projectId cleanly across valid, malformed, and orphan IDs", async () => {
    await parkCreatedActiveProjects();
    const project = await createProjectService(leaderActor, {
      name: `S6 Backfill Project ${runTag}`,
      startDate: getHcmDayYmdOffset(-10),
      endDate: getHcmDayYmdOffset(20),
      memberIds: [member1Actor.userId],
      technologies: ["TypeScript"],
    });
    createdProjectIds.push(project.id);

    const logProjectEntity = await prisma.activityLog.create({
      data: {
        userId: leaderActor.userId,
        projectId: null,
        action: "LEGACY_PROJECT_LOG",
        entityType: "Project",
        entityId: project.id,
        description: "Legacy Project log without projectId column",
      },
      select: { id: true },
    });

    const logSprintMetadata = await prisma.activityLog.create({
      data: {
        userId: leaderActor.userId,
        projectId: null,
        action: "LEGACY_SPRINT_LOG",
        entityType: "Sprint",
        entityId: randomUUID(),
        description: "Legacy Sprint log with valid metadata.projectId",
        metadata: { projectId: project.id },
      },
      select: { id: true },
    });

    const logMalformedUuid = await prisma.activityLog.create({
      data: {
        userId: leaderActor.userId,
        projectId: null,
        action: "LEGACY_MALFORMED_LOG",
        entityType: "Document",
        entityId: randomUUID(),
        description: "Legacy log with invalid UUID string in metadata",
        metadata: { projectId: "not-a-valid-uuid" },
      },
      select: { id: true },
    });

    const logOrphanUuid = await prisma.activityLog.create({
      data: {
        userId: leaderActor.userId,
        projectId: null,
        action: "LEGACY_ORPHAN_LOG",
        entityType: "Sprint",
        entityId: randomUUID(),
        description: "Legacy log pointing to deleted/nonexistent Project UUID",
        metadata: { projectId: randomUUID() },
      },
      select: { id: true },
    });

    const targetIds = [
      logProjectEntity.id,
      logSprintMetadata.id,
      logMalformedUuid.id,
      logOrphanUuid.id,
    ];

    await prisma.$executeRaw`
      UPDATE "ActivityLog" AS a
      SET "projectId" = a."entityId"
      WHERE a."id" IN (${logProjectEntity.id}::uuid, ${logSprintMetadata.id}::uuid, ${logMalformedUuid.id}::uuid, ${logOrphanUuid.id}::uuid)
        AND a."projectId" IS NULL
        AND a."entityType" = 'Project'
        AND a."entityId" IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM "Project" AS p
          WHERE p."id" = a."entityId"
        )
    `;

    await prisma.$executeRaw`
      UPDATE "ActivityLog" AS a
      SET "projectId" = (a."metadata"->>'projectId')::uuid
      WHERE a."id" IN (${logProjectEntity.id}::uuid, ${logSprintMetadata.id}::uuid, ${logMalformedUuid.id}::uuid, ${logOrphanUuid.id}::uuid)
        AND a."projectId" IS NULL
        AND a."entityType" IN ('Project', 'ProjectMember', 'Sprint', 'Document')
        AND (a."metadata"->>'projectId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND EXISTS (
          SELECT 1
          FROM "Project" AS p
          WHERE p."id" = (a."metadata"->>'projectId')::uuid
        )
    `;

    const refreshed = await prisma.activityLog.findMany({
      where: { id: { in: targetIds } },
      select: { id: true, projectId: true },
    });
    const byId = new Map(refreshed.map((row) => [row.id, row.projectId]));

    expect(byId.get(logProjectEntity.id)).toBe(project.id);
    expect(byId.get(logSprintMetadata.id)).toBe(project.id);
    expect(byId.get(logMalformedUuid.id)).toBeNull();
    expect(byId.get(logOrphanUuid.id)).toBeNull();
  });

  it("reconstructs Sprint commitment/rollover, keeps closure-day Burndown accurate, and stays immune to post-completion estimateHours edits (DEC-058 / P0-01)", async () => {
    await parkCreatedActiveProjects();
    const project = await createProjectService(leaderActor, {
      name: `S6 Sprint Analytics Project ${runTag}`,
      startDate: getHcmDayYmdOffset(-20),
      endDate: getHcmDayYmdOffset(40),
      memberIds: [member1Actor.userId],
      instructorId: instructorActor.userId,
      technologies: ["Next.js", "PostgreSQL"],
    });
    createdProjectIds.push(project.id);
    await activateProjectService(leaderActor, project.id);

    const todayStr = getHcmDayYmdOffset(0);
    const sprint1 = await createSprintService(leaderActor, project.id, {
      name: "Sprint 1 P0-01",
      goal: "Baseline & Freeze",
      startDate: getHcmDayYmdOffset(-3),
      endDate: getHcmDayYmdOffset(4),
    });

    const sprint2 = await createSprintService(leaderActor, project.id, {
      name: "Sprint 2 Target",
      goal: "Rollover Target",
      startDate: getHcmDayYmdOffset(5),
      endDate: getHcmDayYmdOffset(15),
    });

    const tDone = await createTaskService(leaderActor, project.id, {
      title: "Task Done Mid-Sprint Re-estimated",
      priority: TaskPriority.HIGH,
      deadline: `${getHcmDayYmdOffset(4)}T17:00:00+07:00`,
      estimateHours: 6,
      assigneeIds: [member1Actor.userId],
    });
    const tMoveToSprint = await createTaskService(leaderActor, project.id, {
      title: "Task Rolled To Sprint 2",
      priority: TaskPriority.MEDIUM,
      deadline: `${getHcmDayYmdOffset(6)}T17:00:00+07:00`,
      estimateHours: 4,
      assigneeIds: [member1Actor.userId],
    });
    const tMoveToBacklog = await createTaskService(leaderActor, project.id, {
      title: "Task Added Mid-Sprint & Rolled Backlog",
      priority: TaskPriority.LOW,
      deadline: `${getHcmDayYmdOffset(8)}T17:00:00+07:00`,
      estimateHours: 5,
      assigneeIds: [],
    });

    // Baseline commitment before Sprint 1 activation: tDone (6h) + tMoveToSprint (4h) = 2 tasks, 10h
    await assignTasksToSprintService(leaderActor, sprint1.sprint.id, {
      taskIds: [tDone.id, tMoveToSprint.id],
    });
    await activateSprintService(leaderActor, sprint1.sprint.id);

    // Mid-sprint scope addition: tMoveToBacklog (5h)
    await assignTasksToSprintService(leaderActor, sprint1.sprint.id, {
      taskIds: [tMoveToBacklog.id],
    });

    // Mid-sprint estimate edit on tDone: 6h -> 8h before completion
    await updateTaskService(leaderActor, tDone.id, { estimateHours: 8 });

    // Complete tDone through real Member -> Leader workflow
    await updateTaskStatusService(member1Actor, tDone.id, TaskStatus.IN_PROGRESS);
    await submitTaskForReviewService(member1Actor, tDone.id, {});
    await approveTaskReviewService(leaderActor, tDone.id, {
      reason: "Completed and reviewed in Sprint 1",
    });

    // Start tMoveToSprint
    await updateTaskStatusService(member1Actor, tMoveToSprint.id, TaskStatus.IN_PROGRESS);

    // Complete Sprint 1 with rollover dispositions
    const preview = await getSprintCompletionPreviewService(leaderActor, sprint1.sprint.id);
    await completeSprintService(leaderActor, sprint1.sprint.id, {
      expectedUpdatedAt: preview.sprint.updatedAt.toISOString(),
      taskDispositions: [
        {
          taskId: tMoveToSprint.id,
          action: "MOVE_TO_SPRINT",
          targetSprintId: sprint2.sprint.id,
          expectedStatus: TaskStatus.IN_PROGRESS,
        },
        {
          taskId: tMoveToBacklog.id,
          action: "MOVE_TO_BACKLOG",
          expectedStatus: TaskStatus.TODO,
        },
      ],
    });

    // Ensure post-completion INFO_UPDATED events strictly follow Sprint 1 completedAt timestamp
    await new Promise((resolve) => setTimeout(resolve, 25));

    // Mutate estimateHours AFTER Sprint 1 completion on rolled-over tasks (4h->20h, 5h->30h)
    await updateTaskService(leaderActor, tMoveToSprint.id, { estimateHours: 20 });
    await updateTaskService(leaderActor, tMoveToBacklog.id, { estimateHours: 30 });

    const burndownAnalytics = await getSprintProgressAndBurndownService(
      instructorActor,
      sprint1.sprint.id
    );

    expect(burndownAnalytics.burndown.hasPostSprintEstimateEdits).toBe(true);
    expect(burndownAnalytics.burndown.closureScopeHours).toBe(17); // 8 + 4 + 5 (not 8 + 20 + 30)
    expect(burndownAnalytics.burndown.completedEstimateHours).toBe(8);
    expect(burndownAnalytics.burndown.remainingEstimateHours).toBe(9);

    const closureDayPoint = burndownAnalytics.burndown.points.find((p) => p.date === todayStr);
    expect(closureDayPoint).toBeDefined();
    // Closure day does NOT drop remaining work to 0 due to SPRINT_COMPLETION rollover
    expect(closureDayPoint!.actualRemainingHours).toBe(9);
    expect(closureDayPoint!.scopeHours).toBe(17);

    const sprintReport = await getProjectSprintReportService(instructorActor, project.id);
    const s1Report = sprintReport.sprints.find((s) => s.sprintId === sprint1.sprint.id)!;
    const s2Report = sprintReport.sprints.find((s) => s.sprintId === sprint2.sprint.id)!;

    expect(s1Report.isBaselineAvailable).toBe(true);
    expect(s1Report.baselineCommitment).toEqual({ taskCount: 2, estimateHours: 10 });
    expect(s1Report.scopeAdded.taskCount).toBe(1);
    expect(s1Report.scopeAdded.estimateHours).toBe(5);
    expect(s1Report.completedTasks.taskCount).toBe(1);
    expect(s1Report.completedTasks.estimateHours).toBe(8);
    expect(s1Report.rolledOverToSprint).toEqual({ taskCount: 1, estimateHours: 4 });
    expect(s1Report.rolledOverToBacklog).toEqual({ taskCount: 1, estimateHours: 5 });
    expect(s1Report.hasPostSprintEstimateEdits).toBe(true);

    // Sprint 2 PLANNED sees rolled-over task with current 20h planned estimate
    expect(s2Report.plannedTaskCount).toBe(1);
    expect(s2Report.plannedEstimateHours).toBe(20);
  });

  it("enforces Asia/Ho_Chi_Minh UTC+7 midnight & ISO Monday weekly aggregation parity in PostgreSQL", async () => {
    await parkCreatedActiveProjects();
    const project = await createProjectService(leaderActor, {
      name: `S6 Timezone Analytics ${runTag}`,
      startDate: "2026-08-01",
      endDate: "2026-12-31",
      memberIds: [member1Actor.userId],
      technologies: ["PostgreSQL"],
    });
    createdProjectIds.push(project.id);
    await activateProjectService(leaderActor, project.id);

    const taskBeforeMidnight = await createTaskService(leaderActor, project.id, {
      title: "Completed 23:59:59.999+07:00 Sunday",
      priority: TaskPriority.CRITICAL,
      deadline: "2026-11-10T17:00:00+07:00",
      estimateHours: 3,
      assigneeIds: [member1Actor.userId],
    });
    const taskAtMidnight = await createTaskService(leaderActor, project.id, {
      title: "Completed 00:00:00.000+07:00 Monday",
      priority: TaskPriority.MEDIUM,
      deadline: "2026-11-12T17:00:00+07:00",
      estimateHours: 5,
      assigneeIds: [member1Actor.userId],
    });

    await prisma.task.update({
      where: { id: taskBeforeMidnight.id },
      data: {
        status: TaskStatus.DONE,
        createdAt: new Date("2026-11-08T16:59:59.999Z"),
        completedAt: new Date("2026-11-08T16:59:59.999Z"),
      },
    });
    await prisma.task.update({
      where: { id: taskAtMidnight.id },
      data: {
        status: TaskStatus.DONE,
        createdAt: new Date("2026-11-08T17:00:00.000Z"),
        completedAt: new Date("2026-11-08T17:00:00.000Z"),
      },
    });

    // <= 90 days -> daily granularity
    const dailyAnalytics = await getProjectAnalyticsService(leaderActor, project.id, {
      preset: "custom",
      from: "2026-11-05",
      to: "2026-11-12",
    });

    expect(dailyAnalytics.window.granularity).toBe("day");
    const nov08 = dailyAnalytics.completionTrend.find((p) => p.bucketKey === "2026-11-08");
    const nov09 = dailyAnalytics.completionTrend.find((p) => p.bucketKey === "2026-11-09");
    expect(nov08?.completedCount).toBe(1);
    expect(nov08?.createdCount).toBe(1);
    expect(nov09?.completedCount).toBe(1);
    expect(nov09?.createdCount).toBe(1);

    // > 90 days -> auto ISO Monday weekly granularity
    const weeklyAnalytics = await getProjectAnalyticsService(leaderActor, project.id, {
      preset: "custom",
      from: "2026-08-01",
      to: "2026-11-15",
    });

    expect(weeklyAnalytics.window.granularity).toBe("week");
    const weekNov02 = weeklyAnalytics.completionTrend.find((p) => p.bucketKey === "2026-11-02");
    const weekNov09 = weeklyAnalytics.completionTrend.find((p) => p.bucketKey === "2026-11-09");
    expect(weekNov02?.completedCount).toBe(1);
    expect(weekNov09?.completedCount).toBe(1);
  });

  it("enforces non-additive contribution, P0-02 episode deduplication, P1-03 departed member migration, and MEMBER self-only scope (DEC-047..052)", async () => {
    await parkCreatedActiveProjects();
    const project = await createProjectService(leaderActor, {
      name: `S6 Contribution Project ${runTag}`,
      startDate: getHcmDayYmdOffset(-15),
      endDate: getHcmDayYmdOffset(30),
      memberIds: [member1Actor.userId, member2Actor.userId],
      technologies: ["Prisma"],
    });
    createdProjectIds.push(project.id);
    await activateProjectService(leaderActor, project.id);

    // Shared co-assigned task (member1 + member2 -> remove member2 -> re-add -> remove)
    const tShared = await createTaskService(leaderActor, project.id, {
      title: "Shared Multi-Episode Task",
      priority: TaskPriority.HIGH,
      deadline: `${getHcmDayYmdOffset(5)}T17:00:00+07:00`,
      estimateHours: 8,
      assigneeIds: [member1Actor.userId, member2Actor.userId],
    });
    await syncTaskAssigneesService(leaderActor, tShared.id, {
      assigneeIds: [member1Actor.userId],
    });
    await syncTaskAssigneesService(leaderActor, tShared.id, {
      assigneeIds: [member1Actor.userId, member2Actor.userId],
    });
    await syncTaskAssigneesService(leaderActor, tShared.id, {
      assigneeIds: [member1Actor.userId],
    });
    await updateTaskStatusService(member1Actor, tShared.id, TaskStatus.IN_PROGRESS);
    await submitTaskForReviewService(member1Actor, tShared.id, {});
    await approveTaskReviewService(leaderActor, tShared.id, { reason: "Shared task approved" });

    // Co-assigned active task between member1 & leader
    const tCoActive = await createTaskService(leaderActor, project.id, {
      title: "Active Co-Assigned Task",
      priority: TaskPriority.MEDIUM,
      deadline: `${getHcmDayYmdOffset(6)}T17:00:00+07:00`,
      estimateHours: 10,
      assigneeIds: [member1Actor.userId, leaderActor.userId],
    });
    await updateTaskStatusService(member1Actor, tCoActive.id, TaskStatus.IN_PROGRESS);

    // Sole DONE task for member2 before member2 leaves the project (TaskAssignee.removedAt stays NULL!)
    const tSoloMember2 = await createTaskService(leaderActor, project.id, {
      title: "Solo Task Before Leaving",
      priority: TaskPriority.LOW,
      deadline: `${getHcmDayYmdOffset(4)}T17:00:00+07:00`,
      estimateHours: 6,
      assigneeIds: [member2Actor.userId],
    });
    await updateTaskStatusService(member2Actor, tSoloMember2.id, TaskStatus.IN_PROGRESS);
    await submitTaskForReviewService(member2Actor, tSoloMember2.id, {});
    await approveTaskReviewService(leaderActor, tSoloMember2.id, {
      reason: "Completed before offboarding",
    });

    // Remove member2 from Project (permitted because member2 has no unfinished active tasks)
    await removeProjectMemberService(leaderActor, project.id, member2Actor.userId);

    const leaderReport = await getMemberContributionReportService(leaderActor, project.id, {
      includeRemoved: true,
    });

    expect(leaderReport.viewScope).toBe("ALL_MEMBERS");
    expect(leaderReport.hasDepartedMembers).toBe(true);
    expect(leaderReport.projectTotals.totalTasks).toBe(3);
    expect(leaderReport.projectTotals.soleAssignedTasks).toBe(1); // tShared (sole member1 now)
    expect(leaderReport.projectTotals.coAssignedTasks).toBe(1); // tCoActive (member1 + leader)
    expect(leaderReport.projectTotals.unassignedTasks).toBe(1); // tSoloMember2 has only departed member2 (P1-03)

    const member1Row = leaderReport.members.find((m) => m.userId === member1Actor.userId)!;
    const member2Row = leaderReport.members.find((m) => m.userId === member2Actor.userId)!;

    expect(member1Row.membershipStatus).toBe("ACTIVE");
    expect(member1Row.currentAssigned.soleAssignedCount).toBe(1);
    expect(member1Row.currentAssigned.coAssignedCount).toBe(1);
    expect(member1Row.currentAssigned.completedCount).toBe(1);
    expect(member1Row.currentAssigned.inProgressCount).toBe(1);
    expect(member1Row.verifiableActivity.reviewsSubmittedCount).toBeGreaterThanOrEqual(1);

    // P1-03 & P0-02 assertions for departed member2:
    expect(member2Row.membershipStatus).toBe("LEFT_PROJECT");
    expect(member2Row.projectRole).toBe(ProjectMemberRole.MEMBER);
    expect(member2Row.membershipBadge).toBe("Đã rời Project");
    expect(member2Row.currentAssigned.total).toBe(0);
    // Two distinct historical tasks (tShared + tSoloMember2), NOT three from repeated episodes on tShared
    expect(member2Row.historicalAssignments.formerTasksDistinctCount).toBe(2);
    expect(member2Row.historicalAssignments.historicalDoneDistinctCount).toBe(2);
    expect(member2Row.historicalAssignments.totalAssignmentEpisodes).toBe(3); // 2 on tShared + 1 on tSoloMember2
    expect(member2Row.historicalAssignments.removedOrDepartedEpisodeCount).toBe(3);

    const hideRemovedReport = await getMemberContributionReportService(leaderActor, project.id, {
      includeRemoved: false,
    });
    expect(hideRemovedReport.hasDepartedMembers).toBe(true);
    expect(hideRemovedReport.members.some((m) => m.userId === member2Actor.userId)).toBe(false);

    // DEC-052: MEMBER sees SELF_ONLY
    const memberSelfReport = await getMemberContributionReportService(member1Actor, project.id);
    expect(memberSelfReport.viewScope).toBe("SELF_ONLY");
    expect(memberSelfReport.members).toHaveLength(1);
    expect(memberSelfReport.members[0]?.userId).toBe(member1Actor.userId);
  });

  it("paginates Unified Activity with deterministic (createdAt DESC, source DESC, id DESC) cursor and enforces MEMBER isolation", async () => {
    await parkCreatedActiveProjects();
    const project = await createProjectService(leaderActor, {
      name: `S6 Activity Feed Project ${runTag}`,
      startDate: getHcmDayYmdOffset(-10),
      endDate: getHcmDayYmdOffset(20),
      memberIds: [member1Actor.userId],
      technologies: ["Next.js"],
    });
    createdProjectIds.push(project.id);
    await activateProjectService(leaderActor, project.id);

    // Unassigned peer task that member1 must NEVER see in Activity feed
    const hiddenPeerTask = await createTaskService(leaderActor, project.id, {
      title: "Leader Only Confidential Task",
      priority: TaskPriority.MEDIUM,
      deadline: `${getHcmDayYmdOffset(7)}T17:00:00+07:00`,
      estimateHours: 2,
      assigneeIds: [leaderActor.userId],
    });

    // Task assigned to member1 so member1 CAN see its TaskHistory
    const memberTask = await createTaskService(leaderActor, project.id, {
      title: "Member Assigned Activity Task",
      priority: TaskPriority.HIGH,
      deadline: `${getHcmDayYmdOffset(7)}T17:00:00+07:00`,
      estimateHours: 4,
      assigneeIds: [member1Actor.userId],
    });

    // Global workspace log (projectId IS NULL) that ADMIN sees and MEMBER must NOT see
    const globalWorkspaceLog = await prisma.activityLog.create({
      data: {
        userId: adminActor.userId,
        projectId: null,
        action: "GLOBAL_ROLE_AUDIT",
        entityType: "Role",
        entityId: randomUUID(),
        description: "Workspace-wide admin log not tied to any Project",
      },
      select: { id: true },
    });

    // Inject identical createdAt timestamp tie-break across ActivityLog (WORKSPACE) and TaskHistory (TASK)
    const tieTimestamp = new Date();
    const tieWorkspaceLog = await prisma.activityLog.create({
      data: {
        userId: leaderActor.userId,
        projectId: project.id,
        action: "TIE_WORKSPACE_EVENT",
        entityType: "Project",
        entityId: project.id,
        description: "Workspace event sharing timestamp",
        createdAt: tieTimestamp,
      },
      select: { id: true },
    });
    const tieTaskHistory = await prisma.taskHistory.create({
      data: {
        taskId: memberTask.id,
        actorId: leaderActor.userId,
        action: TaskHistoryAction.INFO_UPDATED,
        oldValue: { title: "Before Tie" },
        newValue: { title: "After Tie" },
        createdAt: tieTimestamp,
      },
      select: { id: true },
    });

    // Paginate Leader view across pages with limit=2 and insert a newer log between pages
    const page1 = await listUnifiedActivityService(leaderActor, {
      projectId: project.id,
      limit: 2,
    });
    expect(page1.items).toHaveLength(2);
    expect(page1.pageInfo.hasNextPage).toBe(true);

    // Concurrent insert while Leader paginates -> cursor pagination must NOT shift or duplicate existing items
    await prisma.activityLog.create({
      data: {
        userId: leaderActor.userId,
        projectId: project.id,
        action: "CONCURRENT_NEW_EVENT",
        entityType: "Project",
        entityId: project.id,
        description: "Inserted mid-pagination",
        createdAt: new Date(tieTimestamp.getTime() + 5_000),
      },
    });

    const page2 = await listUnifiedActivityService(leaderActor, {
      projectId: project.id,
      limit: 10,
      cursor: page1.pageInfo.nextCursor!,
    });

    const combined = [...page1.items, ...page2.items];
    const uniqueKeys = new Set(combined.map((item) => item.cursorKey));
    expect(uniqueKeys.size).toBe(combined.length);

    // Verify tie-breaking order: "WORKSPACE" sorts before "TASK" for identical createdAt
    const tieWsIdx = combined.findIndex(
      (i) => i.id === tieWorkspaceLog.id && i.source === "WORKSPACE"
    );
    const tieTaskIdx = combined.findIndex((i) => i.id === tieTaskHistory.id && i.source === "TASK");
    expect(tieWsIdx).toBeGreaterThanOrEqual(0);
    expect(tieTaskIdx).toBeGreaterThan(tieWsIdx);

    // Verify ADMIN sees global workspace log while MEMBER sees neither global logs nor peer tasks
    const adminGlobalFeed = await listUnifiedActivityService(adminActor, { limit: 30 });
    expect(adminGlobalFeed.items.some((i) => i.id === globalWorkspaceLog.id)).toBe(true);

    const memberFeed = await listUnifiedActivityService(member1Actor, { limit: 50 });
    expect(memberFeed.scope.hasRestrictedMemberProjects).toBe(true);
    expect(memberFeed.items.some((i) => i.projectId === null)).toBe(false);
    expect(memberFeed.items.some((i) => i.entityId === hiddenPeerTask.id)).toBe(false);
    expect(
      memberFeed.items.some(
        (i) => i.source === "TASK" && i.entityType === "Task" && i.entityId === memberTask.id
      )
    ).toBe(true);
  });

  it("supports Archived Project read-only inspection across Dashboard, Analytics, Member Contribution, Sprint Report & Activity (DEC-053)", async () => {
    await parkCreatedActiveProjects();
    const project = await createProjectService(leaderActor, {
      name: `S6 Archived Project ${runTag}`,
      startDate: getHcmDayYmdOffset(-15),
      endDate: getHcmDayYmdOffset(15),
      memberIds: [member1Actor.userId],
      instructorId: instructorActor.userId,
      technologies: ["React"],
    });
    createdProjectIds.push(project.id);
    await activateProjectService(leaderActor, project.id);

    const sprint = await createSprintService(leaderActor, project.id, {
      name: "Archived Inspection Sprint",
      startDate: getHcmDayYmdOffset(-2),
      endDate: getHcmDayYmdOffset(5),
    });

    const t = await createTaskService(leaderActor, project.id, {
      title: "Archived Project Task",
      priority: TaskPriority.HIGH,
      deadline: `${getHcmDayYmdOffset(2)}T17:00:00+07:00`,
      estimateHours: 4,
      assigneeIds: [member1Actor.userId],
    });
    await assignTasksToSprintService(leaderActor, sprint.sprint.id, { taskIds: [t.id] });

    // Archive project -> now zero ACTIVE projects remain in workspace test slice
    await archiveProjectService(adminActor, project.id);

    // Operational Dashboard gracefully switches to explicit archived project with isReadOnly=true
    const dashboard = await getOperationalDashboardService(leaderActor, {
      projectId: project.id,
    });
    expect(dashboard.selectedProject?.id).toBe(project.id);
    expect(dashboard.selectedProject?.status).toBe(ProjectStatus.ARCHIVED);
    expect(dashboard.selectedProject?.isReadOnly).toBe(true);
    expect(dashboard.taskSummary?.totalTasks).toBe(1);
    expect(dashboard.permissions.canReadAccounts).toBe(false);

    const adminDashboard = await getOperationalDashboardService(adminActor, {
      projectId: project.id,
    });
    expect(adminDashboard.permissions.canReadAccounts).toBe(true);
    expect(adminDashboard.accountSummary).not.toBeNull();
    expect(adminDashboard.workspaceProjectSummary).not.toBeNull();

    const [analytics, contribution, sprintReport, activity] = await Promise.all([
      getProjectAnalyticsService(instructorActor, project.id),
      getMemberContributionReportService(instructorActor, project.id),
      getProjectSprintReportService(instructorActor, project.id),
      listUnifiedActivityService(instructorActor, { projectId: project.id }),
    ]);

    expect(analytics.projectStatus).toBe(ProjectStatus.ARCHIVED);
    expect(analytics.isReadOnly).toBe(true);
    expect(contribution.projectStatus).toBe(ProjectStatus.ARCHIVED);
    expect(contribution.isReadOnly).toBe(true);
    expect(sprintReport.projectStatus).toBe(ProjectStatus.ARCHIVED);
    expect(sprintReport.isReadOnly).toBe(true);
    expect(activity.items.length).toBeGreaterThan(0);
  });
});
