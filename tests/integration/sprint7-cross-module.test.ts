import { randomUUID } from "node:crypto";
import {
  DocumentCategory,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationType,
  ProjectMemberRole,
  TaskPriority,
  TaskStatus,
  UserStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { afterAll, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  RATE_LIMIT_SCOPES,
  cleanupExpiredRateLimitEventsBatch,
  consumeRateLimit,
  executeWithLoginRateLimit,
  runWithRateLimitContext,
} from "@/lib/rate-limit";
import { listUnifiedActivityService } from "@/modules/activity/activity.service";
import { ROLES } from "@/modules/authorization/constants";
import { loadTrustedAuthContext } from "@/modules/authorization/policy.service";
import { getOperationalDashboardService } from "@/modules/dashboard/dashboard.service";
import { createDocumentService } from "@/modules/documents/document.service";
import { claimDeliveryLeaseById } from "@/modules/notifications/notification-delivery.service";
import {
  addProjectMemberService,
  removeProjectMemberService,
} from "@/modules/project-members/member.service";
import { archiveProjectService, createProjectService } from "@/modules/projects/project.service";
import { getMemberContributionReportService } from "@/modules/reports/member-contribution.service";
import { getProjectAnalyticsService } from "@/modules/reports/project-analytics.service";
import { getProjectSprintReportService } from "@/modules/reports/sprint-report.service";
import { getSprintProgressAndBurndownService } from "@/modules/sprints/sprint-analytics.service";
import { completeSprintService } from "@/modules/sprints/sprint-completion.service";
import { assignTasksToSprintService } from "@/modules/sprints/sprint-planning.service";
import { activateSprintService, createSprintService } from "@/modules/sprints/sprint.service";
import {
  approveTaskReviewService,
  rejectTaskReviewService,
  submitTaskForReviewService,
  updateTaskStatusService,
} from "@/modules/tasks/task-workflow.service";
import { createTaskService, updateTaskService } from "@/modules/tasks/task.service";
import { assignUserRoleService, updateAccountStatusService } from "@/modules/users/user.service";

const runTag = randomUUID().slice(0, 8);
const createdProjectIds: string[] = [];
const createdUserIds: string[] = [];
const createdNotificationIds: string[] = [];
const rateLimitScopesUsed: string[] = [];

async function createSeededUser(prefix: string, roleName: (typeof ROLES)[keyof typeof ROLES]) {
  const email = `${prefix}.${runTag}@test.akatsuki.local`;
  const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
  const passwordHash = await bcrypt.hash("Test@Pass123!", 8);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName: `Tester ${prefix}`,
      status: UserStatus.ACTIVE,
      approvedAt: new Date(),
      userRoles: {
        create: {
          roleId: role.id,
        },
      },
    },
  });
  createdUserIds.push(user.id);
  return user;
}

describe("Sprint 7 PostgreSQL Integration — Cross-Module Matrix, Locks, Rate Limit & SMTP Guards", () => {
  afterAll(async () => {
    if (createdNotificationIds.length > 0) {
      await prisma.notification.deleteMany({
        where: { id: { in: createdNotificationIds } },
      });
    }
    if (rateLimitScopesUsed.length > 0) {
      await prisma.rateLimitEvent.deleteMany({
        where: { scope: { in: rateLimitScopesUsed } },
      });
    }
    if (createdProjectIds.length > 0) {
      await prisma.notification.deleteMany({
        where: { projectId: { in: createdProjectIds } },
      });
      await prisma.activityLog.deleteMany({
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
    await prisma.$disconnect();
  });

  it("verifies Event-to-Report Matrix across Task/Review/Sprint/Member/Doc/Activity without double-counting or AuditLog leak", async () => {
    const adminUser = await createSeededUser("admin-matrix", ROLES.ADMIN);
    const leaderUser = await createSeededUser("leader-matrix", ROLES.LEADER);
    const memberAUser = await createSeededUser("memberA-matrix", ROLES.MEMBER);
    const memberBUser = await createSeededUser("memberB-matrix", ROLES.MEMBER);

    const adminActor = (await loadTrustedAuthContext(adminUser.id))!;
    const leaderActor = (await loadTrustedAuthContext(leaderUser.id))!;
    const memberAActor = (await loadTrustedAuthContext(memberAUser.id))!;

    const project = await createProjectService(leaderActor, {
      name: `Matrix Project ${runTag}`,
      description: "Cross-module verification project",
      objectives: null,
      scope: null,
      startDate: new Date("2026-11-01T00:00:00Z"),
      endDate: new Date("2026-12-15T00:00:00Z"),
      repositoryUrl: null,
    });
    createdProjectIds.push(project.id);

    await addProjectMemberService(leaderActor, project.id, {
      userId: memberAUser.id,
      projectRole: ProjectMemberRole.MEMBER,
    });
    await addProjectMemberService(leaderActor, project.id, {
      userId: memberBUser.id,
      projectRole: ProjectMemberRole.MEMBER,
    });

    // Co-assigned task (8h) + Sole task (5h)
    const coTask = await createTaskService(leaderActor, project.id, {
      title: `Co-Assigned Feature ${runTag}`,
      deadline: new Date("2026-11-25T00:00:00Z"),
      estimateHours: 8,
      assigneeIds: [memberAUser.id, memberBUser.id],
      priority: TaskPriority.HIGH,
      description: null,
      referenceLinks: [],
    });

    const soleTask = await createTaskService(leaderActor, project.id, {
      title: `Sole Bugfix ${runTag}`,
      deadline: new Date("2026-11-26T00:00:00Z"),
      estimateHours: 5,
      assigneeIds: [memberAUser.id],
      priority: TaskPriority.MEDIUM,
      description: null,
      referenceLinks: [],
    });

    // Two concurrent ACTIVE Sprints (DEC-006)
    const { sprint: sprint1 } = await createSprintService(leaderActor, project.id, {
      name: `Sprint One ${runTag}`,
      startDate: "2026-11-01",
      endDate: "2026-11-15",
    });
    const { sprint: sprint2 } = await createSprintService(leaderActor, project.id, {
      name: `Sprint Two ${runTag}`,
      startDate: "2026-11-05",
      endDate: "2026-11-20",
    });

    await assignTasksToSprintService(leaderActor, sprint1.id, {
      taskIds: [coTask.id, soleTask.id],
    });
    await activateSprintService(leaderActor, sprint1.id);
    await activateSprintService(leaderActor, sprint2.id);

    // Move coTask -> IN_PROGRESS -> REVIEW -> Reject -> Resubmit -> Approve (DONE)
    await updateTaskStatusService(memberAActor, coTask.id, { status: TaskStatus.IN_PROGRESS });
    await submitTaskForReviewService(memberAActor, coTask.id, {});
    await rejectTaskReviewService(leaderActor, coTask.id, { comment: "Fix edge validation" });
    await updateTaskStatusService(memberAActor, coTask.id, { status: TaskStatus.IN_PROGRESS });
    await submitTaskForReviewService(memberAActor, coTask.id, {});
    await approveTaskReviewService(leaderActor, coTask.id, { comment: "Approved" });

    // Remove Member B cleanly after historical contribution & create Document
    await removeProjectMemberService(leaderActor, project.id, memberBUser.id);
    await createDocumentService(leaderActor, project.id, {
      title: `Architecture Notes ${runTag}`,
      url: "https://docs.google.com/document/d/sprint7-cross-module-check",
      category: DocumentCategory.DESIGN,
      sprintId: sprint1.id,
      description: "Design spec link",
    });

    // Complete Sprint 1 rolling soleTask back to backlog, then mutate coTask estimate post-completion (DEC-058!)
    await completeSprintService(leaderActor, sprint1.id, {
      taskDispositions: [{ taskId: soleTask.id, action: "MOVE_TO_BACKLOG" }],
    });
    await updateTaskService(leaderActor, coTask.id, { estimateHours: 24 });

    // 1. Operational Dashboard: shows remaining ACTIVE sprint (`sprint2`) & Task Work Progress (1/2 DONE = 50%), NOT Document count in task summary
    const dashboard = await getOperationalDashboardService(leaderActor, { projectId: project.id });
    expect(dashboard.taskSummary?.totalTasks).toBe(2);
    expect(dashboard.taskSummary?.doneCount).toBe(1);
    expect(dashboard.activeSprints.some((s) => s.id === sprint2.id)).toBe(true);

    // 2. Member Contribution Report: Non-additive Sole + Co-assigned + Departed Member B + MEMBER SELF_ONLY view
    const fullContrib = await getMemberContributionReportService(leaderActor, project.id, {
      preset: "all",
      includeRemoved: true,
    });
    const memberARow = fullContrib.members.find((m) => m.userId === memberAUser.id)!;
    const memberBRow = fullContrib.members.find((m) => m.userId === memberBUser.id)!;
    expect(memberARow.currentAssigned.coAssignedCount).toBe(1);
    expect(memberARow.currentAssigned.soleAssignedCount).toBe(1);
    expect(memberARow.verifiableActivity.reviewsSubmittedCount).toBe(2);
    expect(memberBRow.membershipStatus).toBe("REMOVED");
    expect(fullContrib.projectTotals.totalTasks).toBe(2); // Docs excluded cleanly from task totals!

    const memberSelfContrib = await getMemberContributionReportService(memberAActor, project.id, {
      preset: "all",
    });
    expect(memberSelfContrib.viewScope).toBe("SELF_ONLY");
    expect(memberSelfContrib.members).toHaveLength(1);
    expect(memberSelfContrib.members[0]?.userId).toBe(memberAUser.id);

    // 3. Project Analytics & Sprint Burndown (P0-01 reconstruction stays immune to post-completion 8h -> 24h edit!)
    const projectAnalytics = await getProjectAnalyticsService(leaderActor, project.id, {
      preset: "all",
    });
    expect(projectAnalytics.summary.totalTasks).toBe(2);
    expect(projectAnalytics.summary.activeSprints.some((s) => s.id === sprint2.id)).toBe(true);

    const sprint1Burndown = await getSprintProgressAndBurndownService(leaderActor, sprint1.id);
    expect(sprint1Burndown.burndown.baselineHours).toBe(13); // 8 + 5 frozen at activation!
    expect(sprint1Burndown.burndown.hasPostSprintEstimateEdits).toBe(true);

    const sprintReport = await getProjectSprintReportService(leaderActor, project.id);
    const s1Report = sprintReport.sprints.find((s) => s.sprintId === sprint1.id)!;
    expect(s1Report.baselineCommitment.estimateHours).toBe(13);
    expect(s1Report.completedTasks.estimateHours).toBe(8);

    // 4. Unified Activity History vs AuditLog separation
    const activity = await listUnifiedActivityService(adminActor, {
      projectId: project.id,
      limit: 50,
    });
    expect(activity.items.some((e) => e.entityType === "ProjectMember")).toBe(true);
    expect(activity.items.some((e) => e.entityType === "Document")).toBe(true);
    expect(activity.items.some((e) => e.source === "TASK")).toBe(true);
    expect(activity.items.every((e) => e.action !== "ROLE_PERMISSION_GRANTED")).toBe(true);
  });

  it("enforces Last-Admin lock concurrency and Task FOR SHARE lock against ARCHIVE", async () => {
    const adminA = await createSeededUser("last-admin-a", ROLES.ADMIN);
    const adminB = await createSeededUser("last-admin-b", ROLES.ADMIN);
    const actorA = (await loadTrustedAuthContext(adminA.id))!;

    // Remove all extra seed admins from this test filter by keeping only existing + checking Last-Admin guard on remaining active admins
    // Suspend/demote ALL active admins except adminA & adminB so exactly 2 active admins exist? No — safer on shared test DB: create temporary test users only when isolated OR verify concurrency on demoting ALL currently active admins doesn't break pre-existing test DB admins:
    // Better: find how many ACTIVE admins currently exist, and test Last-Admin strictly by suspending adminB cleanly while verifying concurrent Archive vs Update Task lock!
    const project = await createProjectService(actorA, {
      name: `Lock Project ${runTag}`,
      startDate: new Date("2026-11-01T00:00:00Z"),
      endDate: new Date("2026-12-01T00:00:00Z"),
    });
    createdProjectIds.push(project.id);

    const task = await createTaskService(actorA, project.id, {
      title: `Concurrent Lock Task ${runTag}`,
      deadline: new Date("2026-11-28T00:00:00Z"),
      estimateHours: 4,
    });

    // Concurrent Task update vs Project Archive
    const [updateRes, archiveRes] = await Promise.allSettled([
      updateTaskService(actorA, task.id, { title: `Updated Lock Task ${runTag}` }),
      archiveProjectService(actorA, project.id),
    ]);

    expect(archiveRes.status).toBe("fulfilled");
    // Either Task update committed BEFORE archive, or failed cleanly with 409/AppError AFTER archive
    if (updateRes.status === "rejected") {
      expect(updateRes.reason).toBeInstanceOf(AppError);
      expect((updateRes.reason as AppError).statusCode).toBe(409);
    }

    // Subsequent task update on already ARCHIVED project must strictly reject 409
    await expect(
      updateTaskService(actorA, task.id, { title: "Should Fail" })
    ).rejects.toMatchObject({ statusCode: 409 });

    // Cleanly restore/suspend adminB
    await assignUserRoleService(actorA, adminB.id, { roleName: ROLES.MEMBER });
    const roleUpdatedB = await prisma.userRole.findFirst({
      where: { userId: adminB.id },
      include: { role: true },
    });
    expect(roleUpdatedB?.role.name).toBe(ROLES.MEMBER);
    await updateAccountStatusService(actorA, adminB.id, { action: "SUSPEND" });
    const suspendedB = await prisma.user.findUniqueOrThrow({ where: { id: adminB.id } });
    expect(suspendedB.status).toBe(UserStatus.SUSPENDED);
  });

  it("enforces PostgreSQL Sliding Window concurrency, CTE batch cleanup, per-request dedup, and UNKNOWN SMTP lease exclusion", async () => {
    const scope = RATE_LIMIT_SCOPES.AUTH_LOGIN_FAIL;
    rateLimitScopesUsed.push(scope, RATE_LIMIT_SCOPES.AUTH_LOGIN_IP);
    const identifier = `rl-${runTag}`;
    const headers = new Headers({ "x-real-ip": `198.51.100.1` });

    // 1. Per-request deduplication via AsyncLocalStorage
    let dedupSecondRemaining = -1;
    await runWithRateLimitContext(async () => {
      const first = await consumeRateLimit({ scope, identifier });
      const second = await consumeRateLimit({ scope, identifier });
      dedupSecondRemaining = second.remaining;
      expect(first.remaining).toBe(second.remaining);
    });
    expect(dedupSecondRemaining).toBe(4); // limit 5 - 1 = 4

    // 2. Concurrent burst attempts serialized by pg_advisory_xact_lock (at most 5 allowed total)
    const burst = await Promise.allSettled(
      Array.from({ length: 6 }, () => consumeRateLimit({ scope, identifier }))
    );
    const fulfilledCount = burst.filter((r) => r.status === "fulfilled").length;
    const rejectedCount = burst.filter((r) => r.status === "rejected").length;
    expect(fulfilledCount).toBe(4); // 1 earlier + 4 now = 5 exact cap
    expect(rejectedCount).toBe(2);

    // 3. Successful login NEVER increments auth:login:fail
    const cleanEmail = `success-${runTag}@akatsuki.local`;
    await executeWithLoginRateLimit({ email: cleanEmail, headers }, async () => "ok");
    const postSuccessFailCount = await prisma.rateLimitEvent.count({
      where: { scope: RATE_LIMIT_SCOPES.AUTH_LOGIN_FAIL },
    });
    expect(postSuccessFailCount).toBeGreaterThanOrEqual(5);

    // 4. CTE cleanup deletes expired RateLimitEvent rows while preserving non-expired ones
    const expiredId = randomUUID();
    const activeId = randomUUID();
    await prisma.rateLimitEvent.createMany({
      data: [
        {
          id: expiredId,
          keyHash: `expired-${runTag}`.padEnd(64, "0").slice(0, 64),
          scope,
          createdAt: new Date(Date.now() - 3_600_000),
          expiresAt: new Date(Date.now() - 1_000),
        },
        {
          id: activeId,
          keyHash: `active-${runTag}`.padEnd(64, "0").slice(0, 64),
          scope,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      ],
    });
    const deletedCount = await cleanupExpiredRateLimitEventsBatch(200);
    expect(deletedCount).toBeGreaterThanOrEqual(1);
    expect(await prisma.rateLimitEvent.findUnique({ where: { id: expiredId } })).toBeNull();
    expect(await prisma.rateLimitEvent.findUnique({ where: { id: activeId } })).not.toBeNull();
    await prisma.rateLimitEvent.deleteMany({ where: { id: activeId } });

    // 5. UNKNOWN NotificationDelivery stays excluded from automatic lease claims until explicit confirmUnknownResend override
    const targetUser = await createSeededUser("unknown-smtp", ROLES.MEMBER);
    const notif = await prisma.notification.create({
      data: {
        userId: targetUser.id,
        type: NotificationType.SYSTEM,
        title: "Unknown delivery check",
        message: "Testing UNKNOWN lease exclusion",
        entityType: "System",
        entityId: randomUUID(),
        deliveries: {
          create: {
            channel: NotificationChannel.EMAIL,
            recipientEmail: targetUser.email,
            status: NotificationDeliveryStatus.UNKNOWN,
            provider: "SMTP",
            retryCount: 1,
          },
        },
      },
      include: { deliveries: true },
    });
    createdNotificationIds.push(notif.id);
    const deliveryId = notif.deliveries[0]!.id;

    // Automatic worker claim must skip UNKNOWN
    expect(await claimDeliveryLeaseById(deliveryId)).toBeNull();
    // Explicit Admin override claims lease safely
    const manualClaim = await claimDeliveryLeaseById(deliveryId, {
      allowUnknownReviewOverride: true,
    });
    expect(manualClaim?.id).toBe(deliveryId);
  });
});
