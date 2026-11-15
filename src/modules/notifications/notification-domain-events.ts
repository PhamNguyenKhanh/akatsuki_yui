import "server-only";
import { NotificationType, ProjectMemberRole, UserStatus, type Prisma } from "@prisma/client";
import { ROLES } from "@/modules/authorization/constants";
import { createNotificationsInTransaction } from "@/modules/notifications/notification.service";
import type {
  CreatedNotificationDispatchHandle,
  CreateTransactionalNotificationInput,
} from "@/modules/notifications/notification.types";
import type { TaskDomainEvent } from "@/modules/tasks/task-events";

function hasNotificationModel(tx: Prisma.TransactionClient): boolean {
  const txNotif = (tx as { notification?: { create?: unknown } }).notification;
  return Boolean(txNotif && typeof txNotif.create === "function");
}

/**
 * BR-NOTIF-001 / DEC-038: Notify all ACTIVE Admins when a new user registers.
 * If no active Admin exists, registration still succeeds.
 */
export async function recordAccountRegisteredNotifications(
  tx: Prisma.TransactionClient,
  input: {
    newUserId: string;
    newUserEmail: string;
    newUserFullName: string;
  }
): Promise<CreatedNotificationDispatchHandle[]> {
  if (!hasNotificationModel(tx)) {
    return [];
  }

  const activeAdmins = await tx.user.findMany({
    where: {
      status: UserStatus.ACTIVE,
      userRoles: {
        some: {
          role: {
            name: ROLES.ADMIN,
          },
        },
      },
    },
    select: {
      id: true,
      email: true,
    },
  });

  if (activeAdmins.length === 0) {
    return [];
  }

  const items: CreateTransactionalNotificationInput[] = activeAdmins.map((admin) => ({
    recipientUserId: admin.id,
    recipientEmail: admin.email,
    actorId: input.newUserId,
    projectId: null,
    type: NotificationType.ACCOUNT_REGISTERED,
    title: `Tài khoản mới chờ phê duyệt: ${input.newUserFullName}`,
    message: `Người dùng ${input.newUserFullName} (${input.newUserEmail}) vừa đăng ký tài khoản và đang chờ Admin phê duyệt.`,
    targetUrl: "/admin/users",
    entityType: "User",
    entityId: input.newUserId,
    metadata: {
      registeredUserId: input.newUserId,
      registeredEmail: input.newUserEmail,
      registeredFullName: input.newUserFullName,
    },
    sendEmail: true,
  }));

  return createNotificationsInTransaction(tx, items);
}

/**
 * BR-NOTIF-002 / DEC-038: Notify user when their PENDING account is APPROVED or REJECTED.
 * SUSPEND and ACTIVATE do not emit notifications in Sprint 5.
 */
export async function recordAccountStatusDecisionNotifications(
  tx: Prisma.TransactionClient,
  input: {
    actorId: string;
    targetUserId: string;
    targetUserEmail: string;
    targetUserFullName: string;
    action: "APPROVE" | "REJECT" | "SUSPEND" | "ACTIVATE";
  }
): Promise<CreatedNotificationDispatchHandle[]> {
  if (!hasNotificationModel(tx)) {
    return [];
  }

  if (input.action !== "APPROVE" && input.action !== "REJECT") {
    return [];
  }

  const isApproved = input.action === "APPROVE";

  return createNotificationsInTransaction(tx, [
    {
      recipientUserId: input.targetUserId,
      recipientEmail: input.targetUserEmail,
      actorId: input.actorId,
      projectId: null,
      type: isApproved ? NotificationType.ACCOUNT_APPROVED : NotificationType.ACCOUNT_REJECTED,
      title: isApproved
        ? "Tài khoản Akatsuki Yui của bạn đã được phê duyệt"
        : "Thông báo kết quả đăng ký tài khoản Akatsuki Yui",
      message: isApproved
        ? `Xin chúc mừng ${input.targetUserFullName}, tài khoản (${input.targetUserEmail}) đã được Admin phê duyệt. Bạn đã có thể đăng nhập vào hệ thống.`
        : `Yêu cầu đăng ký tài khoản (${input.targetUserEmail}) của bạn đã bị từ chối bởi Quản trị viên. Vui lòng liên hệ Admin nhóm nếu bạn cần hỗ trợ thêm.`,
      targetUrl: isApproved ? "/dashboard" : null,
      entityType: "User",
      entityId: input.targetUserId,
      metadata: {
        action: input.action,
        reviewedById: input.actorId,
      },
      sendEmail: true,
      allowNonActiveRecipient: !isApproved,
    },
  ]);
}

/**
 * BR-NOTIF-003 / DEC-037: Project membership and leader change notifications.
 */
export async function recordProjectMemberAddedNotification(
  tx: Prisma.TransactionClient,
  input: {
    actorId: string;
    projectId: string;
    projectName: string;
    memberUserId: string;
    memberEmail?: string;
    projectRole: ProjectMemberRole;
  }
): Promise<CreatedNotificationDispatchHandle[]> {
  if (!hasNotificationModel(tx)) {
    return [];
  }

  return createNotificationsInTransaction(tx, [
    {
      recipientUserId: input.memberUserId,
      recipientEmail: input.memberEmail,
      actorId: input.actorId,
      projectId: input.projectId,
      type: NotificationType.PROJECT_MEMBER_ADDED,
      title: `Bạn đã được thêm vào Project "${input.projectName}"`,
      message: `Bạn vừa được thêm vào Project "${input.projectName}" với vai trò ${input.projectRole}.`,
      targetUrl: `/projects/${input.projectId}`,
      entityType: "Project",
      entityId: input.projectId,
      metadata: {
        projectId: input.projectId,
        projectName: input.projectName,
        projectRole: input.projectRole,
      },
      sendEmail: true,
    },
  ]);
}

export async function recordProjectMemberRemovedNotification(
  tx: Prisma.TransactionClient,
  input: {
    actorId: string;
    projectId: string;
    projectName: string;
    memberUserId: string;
    memberEmail?: string;
    previousRole: ProjectMemberRole;
  }
): Promise<CreatedNotificationDispatchHandle[]> {
  if (!hasNotificationModel(tx)) {
    return [];
  }

  return createNotificationsInTransaction(tx, [
    {
      recipientUserId: input.memberUserId,
      recipientEmail: input.memberEmail,
      actorId: input.actorId,
      projectId: input.projectId,
      type: NotificationType.PROJECT_MEMBER_REMOVED,
      title: `Cập nhật tư cách thành viên tại Project "${input.projectName}"`,
      message: `Bạn không còn là thành viên hoạt động trong Project "${input.projectName}" (vai trò trước đó: ${input.previousRole}).`,
      targetUrl: "/projects",
      entityType: "Project",
      entityId: input.projectId,
      metadata: {
        projectId: input.projectId,
        projectName: input.projectName,
        previousRole: input.previousRole,
      },
      sendEmail: true,
    },
  ]);
}

export async function recordProjectLeaderChangedNotifications(
  tx: Prisma.TransactionClient,
  input: {
    actorId: string;
    projectId: string;
    projectName: string;
    previousLeaderId: string;
    nextLeaderId: string;
  }
): Promise<CreatedNotificationDispatchHandle[]> {
  if (!hasNotificationModel(tx)) {
    return [];
  }

  const items: CreateTransactionalNotificationInput[] = [];

  if (input.nextLeaderId !== input.actorId) {
    items.push({
      recipientUserId: input.nextLeaderId,
      actorId: input.actorId,
      projectId: input.projectId,
      type: NotificationType.PROJECT_LEADER_CHANGED,
      title: `Bạn được bổ nhiệm làm Leader của Project "${input.projectName}"`,
      message: `Vai trò Trưởng nhóm (Leader) của Project "${input.projectName}" đã được chuyển giao cho bạn.`,
      targetUrl: `/projects/${input.projectId}`,
      entityType: "Project",
      entityId: input.projectId,
      metadata: {
        projectId: input.projectId,
        previousLeaderId: input.previousLeaderId,
        nextLeaderId: input.nextLeaderId,
        roleTransition: "ASSIGNED_LEADER",
      },
      sendEmail: true,
    });
  }

  if (input.previousLeaderId !== input.nextLeaderId && input.previousLeaderId !== input.actorId) {
    items.push({
      recipientUserId: input.previousLeaderId,
      actorId: input.actorId,
      projectId: input.projectId,
      type: NotificationType.PROJECT_LEADER_CHANGED,
      title: `Thay đổi Leader tại Project "${input.projectName}"`,
      message: `Vai trò Leader của Project "${input.projectName}" đã được chuyển giao sang thành viên mới. Bạn tiếp tục tham gia Project với vai trò MEMBER.`,
      targetUrl: `/projects/${input.projectId}`,
      entityType: "Project",
      entityId: input.projectId,
      metadata: {
        projectId: input.projectId,
        previousLeaderId: input.previousLeaderId,
        nextLeaderId: input.nextLeaderId,
        roleTransition: "FORMER_LEADER",
      },
      sendEmail: true,
    });
  }

  return createNotificationsInTransaction(tx, items);
}

/**
 * BR-NOTIF-004, BR-NOTIF-005, BR-NOTIF-006: Task assignment & review workflow notifications.
 */
export async function recordTaskEventNotifications(
  tx: Prisma.TransactionClient,
  event: TaskDomainEvent
): Promise<CreatedNotificationDispatchHandle[]> {
  if (!hasNotificationModel(tx) || event.recipientUserIds.length === 0) {
    return [];
  }

  const targetUrl = `/projects/${event.projectId}/tasks/${event.taskId}`;

  const items: CreateTransactionalNotificationInput[] = event.recipientUserIds.map(
    (recipientUserId) => {
      switch (event.type) {
        case "TASK_ASSIGNED":
          return {
            recipientUserId,
            actorId: event.actorId,
            projectId: event.projectId,
            type: NotificationType.TASK_ASSIGNED,
            title: `Bạn được giao Task mới: "${event.taskTitle}"`,
            message: `Bạn vừa được phân công thực hiện Task "${event.taskTitle}". Vui lòng kiểm tra yêu cầu và hạn chót (Deadline).`,
            targetUrl,
            entityType: "Task",
            entityId: event.taskId,
            metadata: {
              taskId: event.taskId,
              taskTitle: event.taskTitle,
              projectId: event.projectId,
            },
            sendEmail: true,
          };

        case "TASK_SUBMITTED_FOR_REVIEW":
          return {
            recipientUserId,
            actorId: event.actorId,
            projectId: event.projectId,
            type: NotificationType.TASK_SUBMITTED_FOR_REVIEW,
            title: `Task chờ Review: "${event.taskTitle}"`,
            message: event.note
              ? `Task "${event.taskTitle}" đã được gửi sang trạng thái REVIEW. Ghi chú: ${event.note}`
              : `Task "${event.taskTitle}" đã được gửi sang trạng thái REVIEW và đang chờ bạn phê duyệt.`,
            targetUrl,
            entityType: "Task",
            entityId: event.taskId,
            metadata: {
              taskId: event.taskId,
              taskTitle: event.taskTitle,
              projectId: event.projectId,
              note: event.note,
            },
            sendEmail: true,
          };

        case "TASK_REVIEW_APPROVED":
          return {
            recipientUserId,
            actorId: event.actorId,
            projectId: event.projectId,
            type: NotificationType.TASK_REVIEW_APPROVED,
            title: `Task đã được duyệt (DONE): "${event.taskTitle}"`,
            message: `Task "${event.taskTitle}" đã được phê duyệt hoàn thành. Nhận xét từ Reviewer: ${event.reason}`,
            targetUrl,
            entityType: "Task",
            entityId: event.taskId,
            metadata: {
              taskId: event.taskId,
              taskTitle: event.taskTitle,
              projectId: event.projectId,
              reason: event.reason,
            },
            sendEmail: true,
          };

        case "TASK_REVIEW_REJECTED":
          return {
            recipientUserId,
            actorId: event.actorId,
            projectId: event.projectId,
            type: NotificationType.TASK_REVIEW_REJECTED,
            title: `Task cần chỉnh sửa lại: "${event.taskTitle}"`,
            message: `Task "${event.taskTitle}" đã được trả về trạng thái IN_PROGRESS để bổ sung/chỉnh sửa. Lý do: ${event.reason}`,
            targetUrl,
            entityType: "Task",
            entityId: event.taskId,
            metadata: {
              taskId: event.taskId,
              taskTitle: event.taskTitle,
              projectId: event.projectId,
              reason: event.reason,
            },
            sendEmail: true,
          };
      }
    }
  );

  return createNotificationsInTransaction(tx, items);
}
