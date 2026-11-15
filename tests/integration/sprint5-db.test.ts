import { randomUUID } from "node:crypto";
import {
  DocumentCategory,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationType,
  ProjectMemberRole,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
  UserStatus,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerAccount } from "@/modules/auth/auth.service";
import { PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import { loadTrustedAuthContext } from "@/modules/authorization/policy.service";
import {
  createDocumentService,
  deleteDocumentService,
  getDocumentDetailService,
  listGlobalDocumentsService,
  listProjectDocumentsService,
  updateDocumentService,
} from "@/modules/documents/document.service";
import { runDeadlineReminderBatch } from "@/modules/notifications/notification-deadline.service";
import {
  claimDeliveryLeaseById,
  listAdminNotificationDeliveriesService,
  manualRetryNotificationDeliveryService,
} from "@/modules/notifications/notification-delivery.service";
import {
  getUserUnreadNotificationCountService,
  listUserNotificationsService,
  markAllNotificationsReadService,
  markNotificationReadStateService,
} from "@/modules/notifications/notification.service";
import {
  addProjectMemberService,
  changeProjectLeaderService,
  removeProjectMemberService,
} from "@/modules/project-members/member.service";
import {
  activateProjectService,
  archiveProjectService,
  createProjectService,
  restoreProjectService,
} from "@/modules/projects/project.service";
import { createSprintService } from "@/modules/sprints/sprint.service";
import {
  approveTaskReviewService,
  rejectTaskReviewService,
  submitTaskForReviewService,
} from "@/modules/tasks/task-workflow.service";
import { createTaskService } from "@/modules/tasks/task.service";
import { updateAccountStatusService } from "@/modules/users/user.service";
import type { AuthContext } from "@/types/auth";

const runTag = randomUUID().slice(0, 8);
const createdUserIds: string[] = [];
const createdProjectIds: string[] = [];
let displacedActiveProjectId: string | null = null;

function makeEmail(prefix: string): string {
  return `s5.${prefix}.${runTag}@test.akatsuki.local`;
}

describe("Sprint 5 PostgreSQL Integration Tests — Documents, Notifications, Retries & Deadline Reminders", () => {
  let adminActor: AuthContext;
  let leaderActor: AuthContext;
  let memberActor: AuthContext;
  let secondLeaderActor: AuthContext;

  beforeAll(async () => {
    const existingActive = await prisma.project.findFirst({
      where: { status: ProjectStatus.ACTIVE },
      select: { id: true },
    });
    if (existingActive) {
      displacedActiveProjectId = existingActive.id;
      await prisma.project.update({
        where: { id: existingActive.id },
        data: { status: ProjectStatus.CREATED },
      });
    }

    const roles = await prisma.role.findMany();
    const roleMap = new Map(roles.map((r) => [r.name, r.id]));

    const createActiveUserWithRole = async (prefix: string, fullName: string, roleName: string) => {
      const user = await prisma.user.create({
        data: {
          email: makeEmail(prefix),
          fullName,
          passwordHash: "hash-not-used-in-direct-context",
          status: UserStatus.ACTIVE,
          approvedAt: new Date(),
          userRoles: {
            create: {
              roleId: roleMap.get(roleName)!,
            },
          },
        },
      });
      createdUserIds.push(user.id);
      return loadTrustedAuthContext(user.id);
    };

    adminActor = await createActiveUserWithRole("admin", "S5 Admin", ROLES.ADMIN);
    leaderActor = await createActiveUserWithRole("leader1", "S5 Leader One", ROLES.LEADER);
    secondLeaderActor = await createActiveUserWithRole("leader2", "S5 Leader Two", ROLES.LEADER);
    memberActor = await createActiveUserWithRole("member1", "S5 Member One", ROLES.MEMBER);
  });

  afterAll(async () => {
    if (createdProjectIds.length > 0) {
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

    if (displacedActiveProjectId) {
      await prisma.project
        .update({
          where: { id: displacedActiveProjectId },
          data: { status: ProjectStatus.ACTIVE },
        })
        .catch(() => undefined);
    }

    await prisma.$disconnect();
  });

  it("enforces Document CRUD, Soft Delete, Archive lock, Member permission grant, and PostgreSQL trigger trg_document_sprint_same_project", async () => {
    const projectA = await createProjectService(leaderActor, {
      name: `S5 Doc Project A ${runTag}`,
      startDate: "2026-11-01",
      endDate: "2026-12-31",
      memberIds: [memberActor.userId],
      technologies: ["Next.js", "PostgreSQL"],
    });
    createdProjectIds.push(projectA.id);

    const projectB = await createProjectService(secondLeaderActor, {
      name: `S5 Doc Project B ${runTag}`,
      startDate: "2026-11-01",
      endDate: "2026-12-31",
      memberIds: [],
      technologies: ["Prisma"],
    });
    createdProjectIds.push(projectB.id);

    const sprintA = await createSprintService(leaderActor, projectA.id, {
      name: "Sprint 1 - Project A",
      startDate: "2026-11-02",
      endDate: "2026-11-15",
    });

    const sprintB = await createSprintService(secondLeaderActor, projectB.id, {
      name: "Sprint 1 - Project B",
      startDate: "2026-11-02",
      endDate: "2026-11-15",
    });

    // 1. Default MEMBER without document.manage is rejected (403 FORBIDDEN)
    await expect(
      createDocumentService(memberActor, projectA.id, {
        title: "Unauthorized Member Doc",
        url: "https://docs.google.com/document/d/member123/edit",
        category: DocumentCategory.OTHER,
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });

    // 2. When MEMBER has document.manage granted (DEC-034), they can create in accessible Project A, but NOT in inaccessible Project B
    const grantedMemberActor: AuthContext = {
      ...memberActor,
      permissions: [...memberActor.permissions, PERMISSIONS.DOCUMENT_MANAGE],
    };

    const createdDoc = await createDocumentService(grantedMemberActor, projectA.id, {
      title: "SRS Document v1.0",
      url: "https://docs.google.com/document/d/srs-v1/edit",
      category: DocumentCategory.SPECIFICATION,
      description: "Initial SRS specification",
      sprintId: sprintA.sprint.id,
    });

    expect(createdDoc.title).toBe("SRS Document v1.0");
    expect(createdDoc.sprintId).toBe(sprintA.sprint.id);

    await expect(
      createDocumentService(grantedMemberActor, projectB.id, {
        title: "Cross Project Attempt",
        url: "https://docs.google.com/document/d/cross/edit",
        category: DocumentCategory.OTHER,
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });

    // 3. PostgreSQL Trigger `trg_document_sprint_same_project` blocks linking Project A Document to Project B Sprint at raw DB level!
    await expect(
      prisma.document.create({
        data: {
          projectId: projectA.id,
          sprintId: sprintB.sprint.id,
          uploadedById: leaderActor.userId,
          title: "Raw DB Trigger Bypass Attempt",
          url: "https://drive.google.com/file/d/bypass/view",
          category: DocumentCategory.OTHER,
        },
      })
    ).rejects.toThrow(/cannot be linked to Sprint/i);

    // 4. Update Document
    const updatedDoc = await updateDocumentService(leaderActor, createdDoc.id, {
      title: "SRS Document v1.1 (Final)",
      category: DocumentCategory.REPORT,
    });
    expect(updatedDoc.title).toBe("SRS Document v1.1 (Final)");
    expect(updatedDoc.category).toBe(DocumentCategory.REPORT);

    // 5. Archive Project A -> blocks Document mutations, Restore Project A -> allows Soft Delete
    await archiveProjectService(leaderActor, projectA.id);
    await expect(deleteDocumentService(leaderActor, createdDoc.id)).rejects.toMatchObject({
      statusCode: 409,
      code: "PROJECT_ARCHIVED",
    });

    await restoreProjectService(adminActor, projectA.id, { targetStatus: ProjectStatus.CREATED });

    // 6. Soft Delete Document (DEC-036)
    const softDeleted = await deleteDocumentService(leaderActor, createdDoc.id);
    expect(softDeleted.deletedAt).toBeTruthy();

    const projectDocsAfterDelete = await listProjectDocumentsService(leaderActor, projectA.id);
    expect(projectDocsAfterDelete.items.find((d) => d.id === createdDoc.id)).toBeUndefined();

    const globalDocsAfterDelete = await listGlobalDocumentsService(leaderActor, {
      projectId: projectA.id,
    });
    expect(globalDocsAfterDelete.items.find((d) => d.id === createdDoc.id)).toBeUndefined();

    await expect(getDocumentDetailService(leaderActor, createdDoc.id)).rejects.toMatchObject({
      statusCode: 404,
      code: "DOCUMENT_NOT_FOUND",
    });

    const rawDbDoc = await prisma.document.findUnique({ where: { id: createdDoc.id } });
    expect(rawDbDoc).not.toBeNull();
    expect(rawDbDoc?.deletedAt).not.toBeNull();
  });

  it("persists transactional Notifications + EMAIL Deliveries for Account, Project Membership, and Task Workflow events", async () => {
    // 1. Account Registration -> notifies active Admins (BR-NOTIF-001)
    const pendingCandidate = await registerAccount({
      fullName: "Pending Candidate S5",
      email: makeEmail("candidate"),
      password: "Password@123",
      confirmPassword: "Password@123",
    });
    createdUserIds.push(pendingCandidate.id);

    const adminRegNotif = await prisma.notification.findFirst({
      where: {
        userId: adminActor.userId,
        type: NotificationType.ACCOUNT_REGISTERED,
        entityId: pendingCandidate.id,
      },
      include: { deliveries: true },
    });
    expect(adminRegNotif).not.toBeNull();
    expect(adminRegNotif?.deliveries).toHaveLength(1);
    expect(adminRegNotif?.deliveries[0].channel).toBe(NotificationChannel.EMAIL);
    expect(adminRegNotif?.deliveries[0].status).toBe(NotificationDeliveryStatus.PENDING);

    // 2. Account Approve -> notifies approved user (BR-NOTIF-002)
    await updateAccountStatusService(adminActor, pendingCandidate.id, { action: "APPROVE" });
    const approvedNotif = await prisma.notification.findFirst({
      where: {
        userId: pendingCandidate.id,
        type: NotificationType.ACCOUNT_APPROVED,
      },
      include: { deliveries: true },
    });
    expect(approvedNotif).not.toBeNull();
    expect(approvedNotif?.deliveries).toHaveLength(1);

    // 3. Account Reject -> persists Notification + EMAIL Delivery for rejected user (DEC-038)
    const rejectedCandidate = await registerAccount({
      fullName: "Rejected Candidate S5",
      email: makeEmail("rejected"),
      password: "Password@123",
      confirmPassword: "Password@123",
    });
    createdUserIds.push(rejectedCandidate.id);

    await updateAccountStatusService(adminActor, rejectedCandidate.id, { action: "REJECT" });
    const rejectedNotif = await prisma.notification.findFirst({
      where: {
        userId: rejectedCandidate.id,
        type: NotificationType.ACCOUNT_REJECTED,
      },
      include: { deliveries: true },
    });
    expect(rejectedNotif).not.toBeNull();
    expect(rejectedNotif?.deliveries).toHaveLength(1);
    expect(rejectedNotif?.deliveries[0].recipientEmail).toBe(rejectedCandidate.email);

    // 4. Project Membership & Leader Change notifications (BR-NOTIF-003 / DEC-037)
    const project = await createProjectService(leaderActor, {
      name: `S5 Workflow Project ${runTag}`,
      startDate: "2026-11-01",
      endDate: "2026-12-31",
      memberIds: [],
      technologies: ["TypeScript"],
    });
    createdProjectIds.push(project.id);

    await addProjectMemberService(leaderActor, project.id, {
      userId: memberActor.userId,
      projectRole: ProjectMemberRole.MEMBER,
    });

    const memberAddedNotif = await prisma.notification.findFirst({
      where: {
        userId: memberActor.userId,
        projectId: project.id,
        type: NotificationType.PROJECT_MEMBER_ADDED,
      },
    });
    expect(memberAddedNotif).not.toBeNull();

    await changeProjectLeaderService(adminActor, project.id, {
      leaderId: secondLeaderActor.userId,
    });

    const leaderChangedNotifs = await prisma.notification.findMany({
      where: {
        projectId: project.id,
        type: NotificationType.PROJECT_LEADER_CHANGED,
      },
    });
    expect(leaderChangedNotifs.map((n) => n.userId)).toEqual(
      expect.arrayContaining([leaderActor.userId, secondLeaderActor.userId])
    );

    // Switch leader back to leaderActor for task workflow tests
    await changeProjectLeaderService(adminActor, project.id, {
      leaderId: leaderActor.userId,
    });
    await removeProjectMemberService(leaderActor, project.id, secondLeaderActor.userId);

    const memberRemovedNotif = await prisma.notification.findFirst({
      where: {
        userId: secondLeaderActor.userId,
        projectId: project.id,
        type: NotificationType.PROJECT_MEMBER_REMOVED,
      },
    });
    expect(memberRemovedNotif).not.toBeNull();

    // 5. Task Assignment & Review Workflow notifications (BR-NOTIF-004..006)
    await activateProjectService(leaderActor, project.id);

    const now = new Date();
    const upcomingDeadline = new Date(now.getTime() + 6 * 60 * 60 * 1000); // +6 hours

    const task = await createTaskService(leaderActor, project.id, {
      title: "Implement Notification Center UI",
      priority: TaskPriority.HIGH,
      deadline: upcomingDeadline.toISOString(),
      assigneeIds: [memberActor.userId],
    });

    const taskAssignedNotif = await prisma.notification.findFirst({
      where: {
        userId: memberActor.userId,
        type: NotificationType.TASK_ASSIGNED,
        entityId: task.id,
      },
    });
    expect(taskAssignedNotif).not.toBeNull();

    // Move task to IN_PROGRESS, then submit for review -> notifies leaderActor
    await prisma.task.update({
      where: { id: task.id },
      data: { status: TaskStatus.IN_PROGRESS },
    });

    await submitTaskForReviewService(memberActor, task.id, {
      note: "Ready for leader review",
    });

    const submittedNotif = await prisma.notification.findFirst({
      where: {
        userId: leaderActor.userId,
        type: NotificationType.TASK_SUBMITTED_FOR_REVIEW,
        entityId: task.id,
      },
    });
    expect(submittedNotif).not.toBeNull();

    // Reject review -> notifies memberActor
    await rejectTaskReviewService(leaderActor, task.id, {
      reason: "Please add unit tests for edge cases",
    });

    const rejectedTaskNotif = await prisma.notification.findFirst({
      where: {
        userId: memberActor.userId,
        type: NotificationType.TASK_REVIEW_REJECTED,
        entityId: task.id,
      },
    });
    expect(rejectedTaskNotif).not.toBeNull();

    // Re-submit & Approve review -> notifies memberActor
    await submitTaskForReviewService(memberActor, task.id, {
      note: "Added unit tests",
    });
    await approveTaskReviewService(leaderActor, task.id, {
      reason: "All tests pass!",
    });

    const approvedTaskNotif = await prisma.notification.findFirst({
      where: {
        userId: memberActor.userId,
        type: NotificationType.TASK_REVIEW_APPROVED,
        entityId: task.id,
      },
    });
    expect(approvedTaskNotif).not.toBeNull();

    // 6. Notification Center Read / Unread / Mark All Read & Cross-User Isolation (DEC-043)
    const unreadBefore = await getUserUnreadNotificationCountService(memberActor);
    expect(unreadBefore.unreadCount).toBeGreaterThanOrEqual(3);

    const markedRead = await markNotificationReadStateService(memberActor, taskAssignedNotif!.id, {
      isRead: true,
    });
    expect(markedRead.isRead).toBe(true);
    expect(markedRead.readAt).toBeTruthy();

    const markedUnread = await markNotificationReadStateService(
      memberActor,
      taskAssignedNotif!.id,
      { isRead: false }
    );
    expect(markedUnread.isRead).toBe(false);
    expect(markedUnread.readAt).toBeNull();

    // Cross-user access is forbidden
    await expect(
      markNotificationReadStateService(leaderActor, taskAssignedNotif!.id, { isRead: true })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });

    await markAllNotificationsReadService(memberActor);
    const listAfterMarkAll = await listUserNotificationsService(memberActor, { status: "unread" });
    expect(listAfterMarkAll.unreadCount).toBe(0);
    expect(listAfterMarkAll.items).toHaveLength(0);
  });

  it("enforces FOR UPDATE SKIP LOCKED lease claiming, 3-retry cap, and daily Deadline Reminder deduplication", async () => {
    const activeProject = await prisma.project.findFirstOrThrow({
      where: {
        id: { in: createdProjectIds },
        status: ProjectStatus.ACTIVE,
      },
    });

    const now = new Date();
    const dueSoon = new Date(now.getTime() + 4 * 60 * 60 * 1000); // +4h (upcoming)
    const recentlyOverdue = new Date(now.getTime() - 4 * 60 * 60 * 1000); // -4h (recently overdue)

    const upcomingTask = await createTaskService(leaderActor, activeProject.id, {
      title: `Upcoming Task ${runTag}`,
      priority: TaskPriority.MEDIUM,
      deadline: dueSoon.toISOString(),
      assigneeIds: [memberActor.userId],
    });

    // Create a recently overdue task directly via Prisma (since createTaskSchema requires future deadline on initial UI creation)
    const overdueTask = await prisma.task.create({
      data: {
        projectId: activeProject.id,
        createdById: leaderActor.userId,
        title: `Overdue Task ${runTag}`,
        priority: TaskPriority.HIGH,
        status: TaskStatus.IN_PROGRESS,
        deadline: recentlyOverdue,
        assignees: {
          create: {
            userId: memberActor.userId,
            assignedById: leaderActor.userId,
          },
        },
      },
    });

    // 1. First run of Deadline Reminder batch creates reminders for both upcoming and recently overdue tasks
    const batchRun1 = await runDeadlineReminderBatch(now);
    expect(batchRun1.createdReminders).toBeGreaterThanOrEqual(2);

    const reminderNotifs = await prisma.notification.findMany({
      where: {
        userId: memberActor.userId,
        type: NotificationType.TASK_DEADLINE_REMINDER,
        entityId: { in: [upcomingTask.id, overdueTask.id] },
      },
    });
    expect(reminderNotifs).toHaveLength(2);

    // 2. Second run on the same day in Asia/Ho_Chi_Minh is idempotent via (userId, dedupKey) -> creates 0 duplicates
    const batchRun2 = await runDeadlineReminderBatch(now);
    expect(batchRun2.createdReminders).toBe(0);

    // 3. Test FOR UPDATE SKIP LOCKED lease claiming and 3-retry terminal cap
    const sampleDelivery = await prisma.notificationDelivery.findFirstOrThrow({
      where: {
        notification: {
          userId: memberActor.userId,
          entityId: upcomingTask.id,
          type: NotificationType.TASK_DEADLINE_REMINDER,
        },
      },
    });

    const lease1 = await claimDeliveryLeaseById(sampleDelivery.id);
    expect(lease1).not.toBeNull();
    expect(lease1?.lockToken).toBeTruthy();

    // While lease1 is active (lockedAt is fresh), a second concurrent worker cannot claim the same delivery
    const lease2WhileLocked = await claimDeliveryLeaseById(sampleDelivery.id);
    expect(lease2WhileLocked).toBeNull();

    // Simulate terminal failure at retryCount = 3
    await prisma.notificationDelivery.update({
      where: { id: sampleDelivery.id },
      data: {
        status: NotificationDeliveryStatus.FAILED,
        retryCount: 3,
        nextRetryAt: null,
        lockedAt: null,
        lockToken: null,
        failedAt: new Date(),
        errorCode: "TERMINAL_TEST_ERROR",
        errorMessage: "Exhausted 3 retries",
      },
    });

    // Admin Delivery History returns the delivery record
    const adminHistory = await listAdminNotificationDeliveriesService(adminActor, {
      status: "FAILED_TERMINAL",
    });
    expect(adminHistory.items.some((item) => item.id === sampleDelivery.id)).toBe(true);

    // Manual Retry must reject when retryCount == 3 (DEC-040)
    await expect(
      manualRetryNotificationDeliveryService(adminActor, sampleDelivery.id)
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "DELIVERY_RETRY_LIMIT_EXCEEDED",
    });

    // 4. Transactional atomicity: if notification insert fails inside $transaction,
    // the accompanying domain write (Document) must roll back completely
    const rollbackTitle = `Rollback Check ${runTag}`;
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.document.create({
          data: {
            projectId: activeProject.id,
            title: rollbackTitle,
            url: "https://docs.google.com/document/d/rollback-check/edit",
            category: DocumentCategory.OTHER,
            uploadedById: leaderActor.userId,
          },
        });
        await tx.notification.create({
          data: {
            userId: "99999999-9999-4999-8999-999999999999",
            type: NotificationType.TASK_ASSIGNED,
            title: "Should trigger FK rollback",
            message: "Missing user row",
            entityType: "Document",
            entityId: activeProject.id,
          },
        });
      })
    ).rejects.toMatchObject({ code: "P2003" });

    const leakedDoc = await prisma.document.findFirst({
      where: {
        projectId: activeProject.id,
        title: rollbackTitle,
      },
    });
    expect(leakedDoc).toBeNull();
  });
});
