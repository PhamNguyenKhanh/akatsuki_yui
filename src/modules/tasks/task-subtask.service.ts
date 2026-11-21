import "server-only";
import type { Prisma } from "@prisma/client";
import { badRequestError, notFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { uuidSchema } from "@/lib/validations/common";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { assertPermission } from "@/modules/authorization/policy.service";
import {
  assertProjectNotArchivedForTaskMutation,
  assertTaskNotDoneForMutation,
  assertTaskProgressOrReviewActorAccess,
  assertTaskReadAccess,
  parseTaskId,
} from "@/modules/tasks/task.access";
import {
  createTaskSubtaskSchema,
  toggleTaskSubtaskSchema,
  type CreateTaskSubtaskInput,
} from "@/modules/tasks/task-subtask.schema";
import type { AuthContext } from "@/types/auth";

export interface TaskSubtaskDTO {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    fullName: string;
  };
}

const taskSubtaskSelect = {
  id: true,
  taskId: true,
  title: true,
  isCompleted: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: {
      id: true,
      fullName: true,
    },
  },
} satisfies Prisma.TaskSubtaskSelect;

function mapTaskSubtask(
  row: Prisma.TaskSubtaskGetPayload<{ select: typeof taskSubtaskSelect }>
): TaskSubtaskDTO {
  return {
    id: row.id,
    taskId: row.taskId,
    title: row.title,
    isCompleted: row.isCompleted,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdBy,
  };
}

function parseSubtaskId(subtaskId: string): string {
  const parsed = uuidSchema.safeParse(subtaskId);
  if (!parsed.success) {
    throw badRequestError("Subtask ID không đúng định dạng UUID.", [
      { field: "subtaskId", message: "Subtask ID không hợp lệ." },
    ]);
  }
  return parsed.data;
}

export async function listTaskSubtasksService(
  actor: AuthContext,
  taskId: string
): Promise<TaskSubtaskDTO[]> {
  assertPermission(actor, PERMISSIONS.TASK_READ);
  const validTaskId = parseTaskId(taskId);
  await assertTaskReadAccess(actor, validTaskId);

  const rows = await prisma.taskSubtask.findMany({
    where: { taskId: validTaskId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: taskSubtaskSelect,
  });

  return rows.map(mapTaskSubtask);
}

export async function createTaskSubtaskService(
  actor: AuthContext,
  taskId: string,
  rawInput: CreateTaskSubtaskInput
): Promise<TaskSubtaskDTO> {
  assertPermission(actor, PERMISSIONS.TASK_UPDATE);
  const validTaskId = parseTaskId(taskId);

  const parsed = createTaskSubtaskSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequestError(
      parsed.error.issues[0]?.message ?? "Dữ liệu đầu việc không hợp lệ.",
      parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "title",
        message: issue.message,
      }))
    );
  }

  return prisma.$transaction(async (tx) => {
    const { task, project } = await assertTaskProgressOrReviewActorAccess(actor, validTaskId, tx);
    assertProjectNotArchivedForTaskMutation(project.status);
    assertTaskNotDoneForMutation(task.status);

    const last = await tx.taskSubtask.findFirst({
      where: { taskId: validTaskId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const created = await tx.taskSubtask.create({
      data: {
        taskId: validTaskId,
        createdById: actor.userId,
        title: parsed.data.title,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
      select: taskSubtaskSelect,
    });

    return mapTaskSubtask(created);
  });
}

export async function toggleTaskSubtaskService(
  actor: AuthContext,
  taskId: string,
  subtaskId: string,
  isCompleted: boolean
): Promise<TaskSubtaskDTO> {
  assertPermission(actor, PERMISSIONS.TASK_UPDATE);
  const validTaskId = parseTaskId(taskId);
  const validSubtaskId = parseSubtaskId(subtaskId);

  const parsed = toggleTaskSubtaskSchema.safeParse({ isCompleted });
  if (!parsed.success) {
    throw badRequestError("Trạng thái đầu việc không hợp lệ.");
  }

  return prisma.$transaction(async (tx) => {
    const { task, project } = await assertTaskProgressOrReviewActorAccess(actor, validTaskId, tx);
    assertProjectNotArchivedForTaskMutation(project.status);
    assertTaskNotDoneForMutation(task.status);

    const existing = await tx.taskSubtask.findFirst({
      where: { id: validSubtaskId, taskId: validTaskId },
      select: { id: true },
    });

    if (!existing) {
      throw notFoundError("Không tìm thấy đầu việc yêu cầu.");
    }

    const updated = await tx.taskSubtask.update({
      where: { id: validSubtaskId },
      data: { isCompleted: parsed.data.isCompleted },
      select: taskSubtaskSelect,
    });

    return mapTaskSubtask(updated);
  });
}

export async function deleteTaskSubtaskService(
  actor: AuthContext,
  taskId: string,
  subtaskId: string
): Promise<{ subtaskId: string }> {
  assertPermission(actor, PERMISSIONS.TASK_UPDATE);
  const validTaskId = parseTaskId(taskId);
  const validSubtaskId = parseSubtaskId(subtaskId);

  return prisma.$transaction(async (tx) => {
    const { task, project } = await assertTaskProgressOrReviewActorAccess(actor, validTaskId, tx);
    assertProjectNotArchivedForTaskMutation(project.status);
    assertTaskNotDoneForMutation(task.status);

    const existing = await tx.taskSubtask.findFirst({
      where: { id: validSubtaskId, taskId: validTaskId },
      select: { id: true },
    });

    if (!existing) {
      throw notFoundError("Không tìm thấy đầu việc yêu cầu.");
    }

    await tx.taskSubtask.delete({
      where: { id: validSubtaskId },
    });

    return { subtaskId: validSubtaskId };
  });
}
