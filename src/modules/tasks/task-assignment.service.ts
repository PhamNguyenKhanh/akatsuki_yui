import "server-only";
import { ProjectMemberRole, TaskHistoryAction, type Prisma } from "@prisma/client";
import { badRequestError, conflictError, notFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { assertPermission } from "@/modules/authorization/policy.service";
import { schedulePostCommitEmailDispatch } from "@/modules/notifications/notification-delivery.service";
import { recordTaskEventNotifications } from "@/modules/notifications/notification-domain-events";
import { assertActiveUsersExist } from "@/modules/projects/project.access";
import { emitTaskEventAfterCommit } from "@/modules/tasks/task-events";
import { taskHistoryRepository } from "@/modules/tasks/task-history.repository";
import { taskRepository, type TaskAssigneeDTO } from "@/modules/tasks/task.repository";
import {
  assertProjectNotArchivedForTaskMutation,
  assertTaskLeaderAccess,
  assertTaskNotDoneForMutation,
  assertTaskReadAccess,
  parseTaskId,
  parseTaskScopedUserId,
} from "@/modules/tasks/task.access";
import { addTaskAssigneeSchema, syncTaskAssigneesSchema } from "@/modules/tasks/task.schema";
import type { AuthContext } from "@/types/auth";

/**
 * Validates that every candidate user is an ACTIVE system user and holds an active
 * execution membership (LEADER or MEMBER, excluding read-only INSTRUCTOR) in the Project.
 */
export async function validateEligibleTaskAssignees(
  tx: Prisma.TransactionClient,
  projectId: string,
  leaderId: string,
  userIds: string[],
  errorField = "assigneeIds"
): Promise<void> {
  if (userIds.length === 0) return;

  await assertActiveUsersExist(tx, userIds, errorField);

  const memberships = await tx.projectMember.findMany({
    where: {
      projectId,
      leftAt: null,
      userId: { in: userIds },
    },
    select: {
      userId: true,
      projectRole: true,
    },
  });

  const membershipByUserId = new Map(memberships.map((item) => [item.userId, item]));
  const ineligibleIds = userIds.filter((userId) => {
    const member = membershipByUserId.get(userId);
    if (member) {
      return member.projectRole === ProjectMemberRole.INSTRUCTOR;
    }
    return userId !== leaderId;
  });

  if (ineligibleIds.length > 0) {
    throw conflictError(
      "ASSIGNEE_NOT_PROJECT_MEMBER",
      "Chỉ thành viên thực thi đang hoạt động trong Project (Leader/Member) mới được giao Task.",
      ineligibleIds.map((userId) => ({
        field: errorField,
        message: `User ${userId} không phải thành viên thực thi đang hoạt động trong Project này.`,
      }))
    );
  }
}

export async function listTaskAssigneesService(
  actor: AuthContext,
  taskId: string
): Promise<TaskAssigneeDTO[]> {
  assertPermission(actor, PERMISSIONS.TASK_READ);
  const validTaskId = parseTaskId(taskId);
  await assertTaskReadAccess(actor, validTaskId);
  return taskRepository.listTaskAssignees(validTaskId);
}

export async function syncTaskAssigneesService(
  actor: AuthContext,
  taskId: string,
  rawInput: unknown
): Promise<TaskAssigneeDTO[]> {
  assertPermission(actor, PERMISSIONS.TASK_ASSIGN);
  const validTaskId = parseTaskId(taskId);

  const parsed = syncTaskAssigneesSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequestError(
      parsed.error.issues[0]?.message ?? "Danh sách thành viên phân công không hợp lệ.",
      parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "assigneeIds",
        message: issue.message,
      }))
    );
  }

  const desiredIds = parsed.data.assigneeIds;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const { task, project } = await assertTaskLeaderAccess(actor, validTaskId, tx, {
        lockForMutation: true,
      });
      assertProjectNotArchivedForTaskMutation(project.status);
      assertTaskNotDoneForMutation(task.status);

      await validateEligibleTaskAssignees(
        tx,
        project.id,
        project.leaderId,
        desiredIds,
        "assigneeIds"
      );

      const currentRows = await tx.taskAssignee.findMany({
        where: {
          taskId: task.id,
          removedAt: null,
        },
        select: {
          id: true,
          userId: true,
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      });

      const currentSet = new Set(currentRows.map((row) => row.userId));
      const desiredSet = new Set(desiredIds);
      const addedIds = desiredIds.filter((userId) => !currentSet.has(userId));
      const removedRows = currentRows.filter((row) => !desiredSet.has(row.userId));

      if (removedRows.length === 0 && addedIds.length === 0) {
        const assignees = await taskRepository.listTaskAssignees(task.id, tx);
        return {
          assignees,
          addedIds: [] as string[],
          projectId: project.id,
          taskId: task.id,
          taskTitle: task.title,
          notificationHandles: [],
        };
      }

      const now = new Date();

      if (removedRows.length > 0) {
        await tx.taskAssignee.updateMany({
          where: {
            id: { in: removedRows.map((row) => row.id) },
            removedAt: null,
          },
          data: { removedAt: now },
        });
      }

      let addedUsers: { id: string; fullName: string; email: string }[] = [];
      if (addedIds.length > 0) {
        await tx.taskAssignee.createMany({
          data: addedIds.map((userId) => ({
            taskId: task.id,
            userId,
            assignedById: actor.userId,
            assignedAt: now,
          })),
        });

        addedUsers = await tx.user.findMany({
          where: { id: { in: addedIds } },
          select: { id: true, fullName: true, email: true },
        });
      }

      const addedUserMap = new Map(addedUsers.map((user) => [user.id, user]));

      await taskHistoryRepository.appendManyTaskHistories(
        [
          ...removedRows.map((row) => ({
            taskId: task.id,
            actorId: actor.userId,
            action: TaskHistoryAction.ASSIGNEE_REMOVED,
            oldValue: {
              userId: row.userId,
              fullName: row.user.fullName,
              email: row.user.email,
            },
            metadata: { source: "sync" },
          })),
          ...addedIds.map((userId) => {
            const addedUser = addedUserMap.get(userId);
            return {
              taskId: task.id,
              actorId: actor.userId,
              action: TaskHistoryAction.ASSIGNEE_ADDED,
              newValue: {
                userId,
                fullName: addedUser?.fullName ?? null,
                email: addedUser?.email ?? null,
              },
              metadata: { source: "sync" },
            };
          }),
        ],
        tx
      );

      await tx.task.update({
        where: { id: task.id },
        data: { updatedAt: now },
        select: { id: true },
      });

      const assignees = await taskRepository.listTaskAssignees(task.id, tx);

      const notificationHandles =
        addedIds.length > 0
          ? await recordTaskEventNotifications(tx, {
              type: "TASK_ASSIGNED",
              projectId: project.id,
              taskId: task.id,
              taskTitle: task.title,
              actorId: actor.userId,
              recipientUserIds: addedIds,
            })
          : [];

      return {
        assignees,
        addedIds,
        projectId: project.id,
        taskId: task.id,
        taskTitle: task.title,
        notificationHandles,
      };
    });

    await schedulePostCommitEmailDispatch(result.notificationHandles);

    if (result.addedIds.length > 0) {
      await emitTaskEventAfterCommit({
        type: "TASK_ASSIGNED",
        projectId: result.projectId,
        taskId: result.taskId,
        taskTitle: result.taskTitle,
        actorId: actor.userId,
        recipientUserIds: result.addedIds,
      });
    }

    return result.assignees;
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      throw conflictError("CONFLICT", "Thành viên đã được phân công vào Task này.");
    }
    throw error;
  }
}

export async function addTaskAssigneeService(
  actor: AuthContext,
  taskId: string,
  rawInput: unknown
): Promise<TaskAssigneeDTO[]> {
  assertPermission(actor, PERMISSIONS.TASK_ASSIGN);
  const validTaskId = parseTaskId(taskId);

  const parsed = addTaskAssigneeSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequestError(
      parsed.error.issues[0]?.message ?? "Dữ liệu phân công thành viên không hợp lệ.",
      parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "userId",
        message: issue.message,
      }))
    );
  }

  const targetUserId = parsed.data.userId;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const { task, project } = await assertTaskLeaderAccess(actor, validTaskId, tx, {
        lockForMutation: true,
      });
      assertProjectNotArchivedForTaskMutation(project.status);
      assertTaskNotDoneForMutation(task.status);

      await validateEligibleTaskAssignees(
        tx,
        project.id,
        project.leaderId,
        [targetUserId],
        "userId"
      );

      const existingActive = await tx.taskAssignee.findFirst({
        where: {
          taskId: task.id,
          userId: targetUserId,
          removedAt: null,
        },
        select: { id: true },
      });

      if (existingActive) {
        throw conflictError("CONFLICT", "Thành viên này đã được phân công vào Task.");
      }

      const now = new Date();
      const created = await tx.taskAssignee.create({
        data: {
          taskId: task.id,
          userId: targetUserId,
          assignedById: actor.userId,
          assignedAt: now,
        },
        select: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      });

      await taskHistoryRepository.appendTaskHistory(
        {
          taskId: task.id,
          actorId: actor.userId,
          action: TaskHistoryAction.ASSIGNEE_ADDED,
          newValue: {
            userId: targetUserId,
            fullName: created.user.fullName,
            email: created.user.email,
          },
          metadata: { source: "add" },
        },
        tx
      );

      await tx.task.update({
        where: { id: task.id },
        data: { updatedAt: now },
        select: { id: true },
      });

      const assignees = await taskRepository.listTaskAssignees(task.id, tx);

      const notificationHandles = await recordTaskEventNotifications(tx, {
        type: "TASK_ASSIGNED",
        projectId: project.id,
        taskId: task.id,
        taskTitle: task.title,
        actorId: actor.userId,
        recipientUserIds: [targetUserId],
      });

      return {
        assignees,
        projectId: project.id,
        taskId: task.id,
        taskTitle: task.title,
        notificationHandles,
      };
    });

    await schedulePostCommitEmailDispatch(result.notificationHandles);

    await emitTaskEventAfterCommit({
      type: "TASK_ASSIGNED",
      projectId: result.projectId,
      taskId: result.taskId,
      taskTitle: result.taskTitle,
      actorId: actor.userId,
      recipientUserIds: [targetUserId],
    });

    return result.assignees;
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      throw conflictError("CONFLICT", "Thành viên này đã được phân công vào Task.");
    }
    throw error;
  }
}

export async function removeTaskAssigneeService(
  actor: AuthContext,
  taskId: string,
  targetUserId: string
): Promise<TaskAssigneeDTO[]> {
  assertPermission(actor, PERMISSIONS.TASK_ASSIGN);
  const validTaskId = parseTaskId(taskId);
  const validUserId = parseTaskScopedUserId(targetUserId, "userId");

  return prisma.$transaction(async (tx) => {
    const { task, project } = await assertTaskLeaderAccess(actor, validTaskId, tx, {
      lockForMutation: true,
    });
    assertProjectNotArchivedForTaskMutation(project.status);
    assertTaskNotDoneForMutation(task.status);

    const activeAssignment = await tx.taskAssignee.findFirst({
      where: {
        taskId: task.id,
        userId: validUserId,
        removedAt: null,
      },
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!activeAssignment) {
      throw notFoundError("Thành viên này hiện không được phân công vào Task.");
    }

    const now = new Date();
    const updated = await tx.taskAssignee.updateMany({
      where: {
        id: activeAssignment.id,
        removedAt: null,
      },
      data: { removedAt: now },
    });

    if (updated.count === 0) {
      throw notFoundError("Thành viên này hiện không được phân công vào Task.");
    }

    await taskHistoryRepository.appendTaskHistory(
      {
        taskId: task.id,
        actorId: actor.userId,
        action: TaskHistoryAction.ASSIGNEE_REMOVED,
        oldValue: {
          userId: activeAssignment.userId,
          fullName: activeAssignment.user.fullName,
          email: activeAssignment.user.email,
        },
        metadata: { source: "remove" },
      },
      tx
    );

    await tx.task.update({
      where: { id: task.id },
      data: { updatedAt: now },
      select: { id: true },
    });

    return taskRepository.listTaskAssignees(task.id, tx);
  });
}
