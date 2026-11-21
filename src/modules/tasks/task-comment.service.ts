import "server-only";
import { NotificationType, ProjectMemberRole, type Prisma } from "@prisma/client";
import { badRequestError, forbiddenError, notFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  getTaskCommentsChannel,
  getUserNotificationsChannel,
  PUSHER_EVENTS,
} from "@/lib/pusher-channels";
import { triggerPusherEvent } from "@/lib/pusher-server";
import { uuidSchema } from "@/lib/validations/common";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { assertPermission } from "@/modules/authorization/policy.service";
import { createNotificationsInTransaction } from "@/modules/notifications/notification.service";
import { isWorkspaceAdmin } from "@/modules/projects/project.access";
import {
  assertProjectNotArchivedForTaskMutation,
  assertTaskReadAccess,
  parseTaskId,
} from "@/modules/tasks/task.access";
import {
  createTaskCommentSchema,
  type CreateTaskCommentInput,
} from "@/modules/tasks/task-comment.schema";
import { formatTaskCode } from "@/modules/tasks/task.schema";
import type { AuthContext } from "@/types/auth";

export interface TaskCommentDTO {
  id: string;
  taskId: string;
  content: string;
  mentionedUserIds: string[];
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    fullName: string;
    email: string;
  };
}

export interface TaskMentionableMemberDTO {
  userId: string;
  fullName: string;
  email: string;
  projectRole: ProjectMemberRole;
}

const taskCommentSelect = {
  id: true,
  taskId: true,
  content: true,
  mentionedUserIds: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
} satisfies Prisma.TaskCommentSelect;

function parseMentionedUserIdsJson(raw: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((item): item is string => typeof item === "string");
}

function mapTaskComment(row: Prisma.TaskCommentGetPayload<{ select: typeof taskCommentSelect }>): TaskCommentDTO {
  return {
    id: row.id,
    taskId: row.taskId,
    content: row.content,
    mentionedUserIds: parseMentionedUserIdsJson(row.mentionedUserIds),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    author: row.author,
  };
}

export async function listTaskCommentsService(
  actor: AuthContext,
  taskId: string
): Promise<TaskCommentDTO[]> {
  assertPermission(actor, PERMISSIONS.TASK_READ);
  const validTaskId = parseTaskId(taskId);
  await assertTaskReadAccess(actor, validTaskId);

  const rows = await prisma.taskComment.findMany({
    where: { taskId: validTaskId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: taskCommentSelect,
  });

  return rows.map(mapTaskComment);
}

export async function listTaskMentionableMembersService(
  actor: AuthContext,
  taskId: string
): Promise<TaskMentionableMemberDTO[]> {
  assertPermission(actor, PERMISSIONS.TASK_READ);
  const validTaskId = parseTaskId(taskId);
  const { project } = await assertTaskReadAccess(actor, validTaskId);

  const members = await prisma.projectMember.findMany({
    where: {
      projectId: project.id,
      leftAt: null,
    },
    orderBy: [{ user: { fullName: "asc" } }],
    select: {
      userId: true,
      projectRole: true,
      user: {
        select: {
          fullName: true,
          email: true,
        },
      },
    },
  });

  return members.map((member) => ({
    userId: member.userId,
    fullName: member.user.fullName,
    email: member.user.email,
    projectRole: member.projectRole,
  }));
}

export async function createTaskCommentService(
  actor: AuthContext,
  taskId: string,
  rawInput: CreateTaskCommentInput
): Promise<TaskCommentDTO> {
  assertPermission(actor, PERMISSIONS.TASK_READ);
  const validTaskId = parseTaskId(taskId);

  const parsed = createTaskCommentSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequestError(
      parsed.error.issues[0]?.message ?? "Dữ liệu bình luận không hợp lệ.",
      parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "content",
        message: issue.message,
      }))
    );
  }

  const candidateMentionIds = Array.from(
    new Set(parsed.data.mentionedUserIds.filter((id) => id !== actor.userId))
  );

  const { comment, notificationHandles, notificationPayloadMap } = await prisma.$transaction(
    async (tx) => {
      const { task, project } = await assertTaskReadAccess(actor, validTaskId, tx);
      assertProjectNotArchivedForTaskMutation(project.status);

      let validMentionIds: string[] = [];
      if (candidateMentionIds.length > 0) {
        const activeMembers = await tx.projectMember.findMany({
          where: {
            projectId: project.id,
            leftAt: null,
            userId: { in: candidateMentionIds },
          },
          select: { userId: true },
        });
        const memberIdSet = new Set(activeMembers.map((m) => m.userId));
        validMentionIds = candidateMentionIds.filter((id) => memberIdSet.has(id));
      }

      const created = await tx.taskComment.create({
        data: {
          taskId: task.id,
          authorId: actor.userId,
          content: parsed.data.content,
          mentionedUserIds: validMentionIds,
        },
        select: taskCommentSelect,
      });

      const taskCode = formatTaskCode(task.id);
      const preview =
        parsed.data.content.length > 140
          ? `${parsed.data.content.slice(0, 139)}…`
          : parsed.data.content;
      const targetUrl = `/projects/${task.projectId}/tasks/${task.id}`;
      const notifTitle = `${actor.fullName} đã nhắc đến bạn trong [${taskCode}]`;
      const notifMessage = `${actor.fullName} đã bình luận trong "${task.title}": "${preview}"`;

      const handles =
        validMentionIds.length > 0
          ? await createNotificationsInTransaction(
              tx,
              validMentionIds.map((recipientUserId) => ({
                recipientUserId,
                actorId: actor.userId,
                projectId: task.projectId,
                type: NotificationType.TASK_COMMENT_MENTION,
                title: notifTitle,
                message: notifMessage,
                targetUrl,
                entityType: "TaskComment",
                entityId: created.id,
                metadata: {
                  taskId: task.id,
                  taskCode,
                  commentId: created.id,
                },
                sendEmail: false,
              }))
            )
          : [];

      const payloadMap = new Map<string, { title: string; message: string; targetUrl: string }>();
      for (const h of handles) {
        payloadMap.set(h.recipientUserId, {
          title: notifTitle,
          message: notifMessage,
          targetUrl,
        });
      }

      return {
        comment: mapTaskComment(created),
        notificationHandles: handles,
        notificationPayloadMap: payloadMap,
      };
    }
  );

  await Promise.all([
    triggerPusherEvent(getTaskCommentsChannel(validTaskId), PUSHER_EVENTS.TASK_COMMENT_CREATED, comment),
    ...notificationHandles.map((handle) => {
      const payload = notificationPayloadMap.get(handle.recipientUserId);
      return triggerPusherEvent(
        getUserNotificationsChannel(handle.recipientUserId),
        PUSHER_EVENTS.NOTIFICATION_CREATED,
        {
          notificationId: handle.notificationId,
          title: payload?.title ?? "Bạn có thông báo mới",
          message: payload?.message ?? "",
          targetUrl: payload?.targetUrl ?? null,
        }
      );
    }),
  ]);

  return comment;
}

export async function deleteTaskCommentService(
  actor: AuthContext,
  taskId: string,
  commentId: string
): Promise<{ commentId: string; projectId: string }> {
  assertPermission(actor, PERMISSIONS.TASK_READ);
  const validTaskId = parseTaskId(taskId);
  const parsedCommentId = uuidSchema.safeParse(commentId);
  if (!parsedCommentId.success) {
    throw badRequestError("Comment ID không đúng định dạng UUID.", [
      { field: "commentId", message: "Comment ID không hợp lệ." },
    ]);
  }
  const validCommentId = parsedCommentId.data;

  const projectId = await prisma.$transaction(async (tx) => {
    const { task, project } = await assertTaskReadAccess(actor, validTaskId, tx);
    assertProjectNotArchivedForTaskMutation(project.status);

    const comment = await tx.taskComment.findFirst({
      where: {
        id: validCommentId,
        taskId: validTaskId,
      },
      select: {
        id: true,
        authorId: true,
      },
    });

    if (!comment) {
      throw notFoundError("Không tìm thấy bình luận yêu cầu.");
    }

    const canDelete =
      comment.authorId === actor.userId ||
      isWorkspaceAdmin(actor) ||
      project.leaderId === actor.userId;

    if (!canDelete) {
      throw forbiddenError("Bạn chỉ có thể xóa bình luận của chính mình hoặc là Project Leader.");
    }

    await tx.taskComment.delete({
      where: { id: validCommentId },
    });

    return task.projectId;
  });

  await triggerPusherEvent(
    getTaskCommentsChannel(validTaskId),
    PUSHER_EVENTS.TASK_COMMENT_DELETED,
    { commentId: validCommentId }
  );

  return { commentId: validCommentId, projectId };
}
