import "server-only";
import { TaskHistoryAction } from "@prisma/client";
import {
  acquireAdvisoryXactLock,
  acquireProjectShareLock,
  acquireTaskUpdateLock,
} from "@/lib/db-locks";
import { badRequestError, conflictError, notFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";
import { uuidSchema } from "@/lib/validations/common";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { assertPermission } from "@/modules/authorization/policy.service";
import { taskHistoryRepository } from "@/modules/tasks/task-history.repository";
import { taskRepository, type TaskDependencyItemDTO } from "@/modules/tasks/task.repository";
import {
  assertProjectNotArchivedForTaskMutation,
  assertTaskLeaderAccess,
  assertTaskNotDoneForMutation,
  assertTaskReadAccess,
  parseTaskId,
} from "@/modules/tasks/task.access";
import { addTaskDependencySchema, formatTaskCode } from "@/modules/tasks/task.schema";
import type { AuthContext } from "@/types/auth";

/**
 * Checks whether there is a directed dependency path from `startTaskId` to `targetTaskId`
 * across edges of shape `{ taskId, dependsOnTaskId }`.
 * When adding `taskId -> dependsOnTaskId`, a cycle exists iff `dependsOnTaskId` can reach `taskId`.
 */
export function hasDependencyPath(
  edges: { taskId: string; dependsOnTaskId: string }[],
  startTaskId: string,
  targetTaskId: string
): boolean {
  if (startTaskId === targetTaskId) return true;

  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const neighbors = adjacency.get(edge.taskId);
    if (neighbors) {
      neighbors.push(edge.dependsOnTaskId);
    } else {
      adjacency.set(edge.taskId, [edge.dependsOnTaskId]);
    }
  }

  const visited = new Set<string>([startTaskId]);
  const queue: string[] = [startTaskId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current);
    if (!neighbors) continue;

    for (const next of neighbors) {
      if (next === targetTaskId) {
        return true;
      }
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return false;
}

export async function listTaskDependenciesService(
  actor: AuthContext,
  taskId: string
): Promise<TaskDependencyItemDTO[]> {
  assertPermission(actor, PERMISSIONS.TASK_READ);
  const validTaskId = parseTaskId(taskId);
  await assertTaskReadAccess(actor, validTaskId);
  return taskRepository.listTaskDependencies(validTaskId);
}

export async function addTaskDependencyService(
  actor: AuthContext,
  taskId: string,
  rawInput: unknown
): Promise<TaskDependencyItemDTO[]> {
  assertPermission(actor, PERMISSIONS.TASK_UPDATE);
  const validTaskId = parseTaskId(taskId);

  const parsed = addTaskDependencySchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequestError(
      parsed.error.issues[0]?.message ?? "Dữ liệu thiết lập phụ thuộc Task không hợp lệ.",
      parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "dependsOnTaskId",
        message: issue.message,
      }))
    );
  }

  const dependsOnTaskId = parsed.data.dependsOnTaskId;

  if (validTaskId === dependsOnTaskId) {
    throw conflictError(
      "TASK_DEPENDENCY_SELF_REFERENCE",
      "Một Task không thể phụ thuộc vào chính nó.",
      [
        {
          field: "dependsOnTaskId",
          taskId: validTaskId,
          message: "Self-reference dependency không được phép.",
        },
      ]
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const preTask = await tx.task.findUnique({
        where: { id: validTaskId },
        select: { projectId: true },
      });
      if (preTask) {
        await acquireProjectShareLock(tx, preTask.projectId);
        await acquireAdvisoryXactLock(tx, `task_dep:${preTask.projectId}`);
        await acquireTaskUpdateLock(tx, validTaskId);
      }
      const { task, project } = await assertTaskLeaderAccess(actor, validTaskId, tx);
      assertProjectNotArchivedForTaskMutation(project.status);

      // Acquire advisory lock only if preTask missed (e.g. non-existent or mock edge)
      if (!preTask || preTask.projectId !== project.id) {
        await acquireAdvisoryXactLock(tx, `task_dep:${project.id}`);
      }

      const [freshTask, dependsOnTask] = await Promise.all([
        tx.task.findUnique({
          where: { id: task.id },
          select: { id: true, status: true },
        }),
        tx.task.findUnique({
          where: { id: dependsOnTaskId },
          select: { id: true, projectId: true, title: true, status: true },
        }),
      ]);

      if (!freshTask) {
        throw notFoundError("Không tìm thấy Task yêu cầu.");
      }
      if (!dependsOnTask) {
        throw notFoundError("Không tìm thấy Task tiền điều kiện.");
      }

      if (dependsOnTask.projectId !== project.id) {
        throw badRequestError(
          "Chỉ được thiết lập phụ thuộc giữa các Task trong cùng một Project.",
          [
            {
              field: "dependsOnTaskId",
              taskId: dependsOnTask.id,
              taskTitle: dependsOnTask.title,
              taskStatus: dependsOnTask.status,
              message: "Task tiền điều kiện không thuộc cùng Project.",
            },
          ]
        );
      }

      assertTaskNotDoneForMutation(freshTask.status);

      const existing = await tx.taskDependency.findUnique({
        where: {
          taskId_dependsOnTaskId: {
            taskId: task.id,
            dependsOnTaskId,
          },
        },
        select: { id: true },
      });

      if (existing) {
        throw conflictError(
          "TASK_DEPENDENCY_EXISTS",
          "Liên kết phụ thuộc giữa hai Task này đã tồn tại.",
          [
            {
              field: "dependsOnTaskId",
              taskId: dependsOnTask.id,
              taskTitle: dependsOnTask.title,
              taskStatus: dependsOnTask.status,
              message: "Dependency đã tồn tại.",
            },
          ]
        );
      }

      const edges = await taskRepository.getProjectDependencyEdges(project.id, tx);
      if (hasDependencyPath(edges, dependsOnTaskId, task.id)) {
        throw conflictError(
          "TASK_DEPENDENCY_CYCLE",
          "Không thể thêm phụ thuộc vì sẽ tạo thành chu trình phụ thuộc (cycle) trong Project.",
          [
            {
              field: "dependsOnTaskId",
              taskId: dependsOnTask.id,
              taskTitle: dependsOnTask.title,
              taskStatus: dependsOnTask.status,
              message: `Phát hiện chu trình khi thêm phụ thuộc ${formatTaskCode(dependsOnTask.id)}.`,
            },
          ]
        );
      }

      await tx.taskDependency.create({
        data: {
          taskId: task.id,
          dependsOnTaskId,
          createdById: actor.userId,
        },
      });

      await taskHistoryRepository.appendTaskHistory(
        {
          taskId: task.id,
          actorId: actor.userId,
          action: TaskHistoryAction.DEPENDENCY_ADDED,
          newValue: {
            dependsOnTaskId: dependsOnTask.id,
            code: formatTaskCode(dependsOnTask.id),
            title: dependsOnTask.title,
            status: dependsOnTask.status,
          },
        },
        tx
      );

      await tx.task.update({
        where: { id: task.id },
        data: { updatedAt: new Date() },
        select: { id: true },
      });

      return taskRepository.listTaskDependencies(task.id, tx);
    });
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      throw conflictError(
        "TASK_DEPENDENCY_EXISTS",
        "Liên kết phụ thuộc giữa hai Task này đã tồn tại."
      );
    }
    throw error;
  }
}

export async function removeTaskDependencyService(
  actor: AuthContext,
  taskId: string,
  dependsOnTaskId: string
): Promise<TaskDependencyItemDTO[]> {
  assertPermission(actor, PERMISSIONS.TASK_UPDATE);
  const validTaskId = parseTaskId(taskId);

  const parsedDepId = uuidSchema.safeParse(dependsOnTaskId);
  if (!parsedDepId.success) {
    throw badRequestError("Depends-On Task ID không đúng định dạng UUID.", [
      { field: "dependsOnTaskId", message: "Task ID phụ thuộc không hợp lệ." },
    ]);
  }
  const validDependsOnTaskId = parsedDepId.data;

  return prisma.$transaction(async (tx) => {
    const { task, project } = await assertTaskLeaderAccess(actor, validTaskId, tx, {
      lockForMutation: true,
      advisoryLockKey: (projectId) => `task_dep:${projectId}`,
    });
    assertProjectNotArchivedForTaskMutation(project.status);
    assertTaskNotDoneForMutation(task.status);

    const existing = await tx.taskDependency.findUnique({
      where: {
        taskId_dependsOnTaskId: {
          taskId: task.id,
          dependsOnTaskId: validDependsOnTaskId,
        },
      },
      select: {
        id: true,
        dependsOnTask: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    if (!existing) {
      throw notFoundError("Không tìm thấy liên kết phụ thuộc cần gỡ bỏ.");
    }

    await tx.taskDependency.delete({
      where: { id: existing.id },
    });

    await taskHistoryRepository.appendTaskHistory(
      {
        taskId: task.id,
        actorId: actor.userId,
        action: TaskHistoryAction.DEPENDENCY_REMOVED,
        oldValue: {
          dependsOnTaskId: existing.dependsOnTask.id,
          code: formatTaskCode(existing.dependsOnTask.id),
          title: existing.dependsOnTask.title,
          status: existing.dependsOnTask.status,
        },
      },
      tx
    );

    await tx.task.update({
      where: { id: task.id },
      data: { updatedAt: new Date() },
      select: { id: true },
    });

    return taskRepository.listTaskDependencies(task.id, tx);
  });
}
