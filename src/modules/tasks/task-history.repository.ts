import "server-only";
import type { Prisma, TaskHistoryAction, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface TaskHistoryActorDTO {
  id: string;
  fullName: string;
  email: string;
}

export interface TaskHistoryItemDTO {
  id: string;
  taskId: string;
  actorId: string;
  actor: TaskHistoryActorDTO;
  action: TaskHistoryAction;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus | null;
  reason: string | null;
  oldValue: Prisma.JsonValue | null;
  newValue: Prisma.JsonValue | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
}

export interface AppendTaskHistoryInput {
  taskId: string;
  actorId: string;
  action: TaskHistoryAction;
  fromStatus?: TaskStatus | null;
  toStatus?: TaskStatus | null;
  reason?: string | null;
  oldValue?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  newValue?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  metadata?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
}

const taskHistorySelect = {
  id: true,
  taskId: true,
  actorId: true,
  action: true,
  fromStatus: true,
  toStatus: true,
  reason: true,
  oldValue: true,
  newValue: true,
  metadata: true,
  createdAt: true,
  actor: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
} satisfies Prisma.TaskHistorySelect;

export const taskHistoryRepository = {
  async appendTaskHistory(
    input: AppendTaskHistoryInput,
    tx: Prisma.TransactionClient = prisma
  ): Promise<TaskHistoryItemDTO> {
    return tx.taskHistory.create({
      data: {
        taskId: input.taskId,
        actorId: input.actorId,
        action: input.action,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus ?? null,
        reason: input.reason ?? null,
        oldValue: input.oldValue ?? undefined,
        newValue: input.newValue ?? undefined,
        metadata: input.metadata ?? undefined,
      },
      select: taskHistorySelect,
    });
  },

  async appendManyTaskHistories(
    inputs: AppendTaskHistoryInput[],
    tx: Prisma.TransactionClient = prisma
  ): Promise<{ count: number }> {
    if (inputs.length === 0) {
      return { count: 0 };
    }

    return tx.taskHistory.createMany({
      data: inputs.map((input) => ({
        taskId: input.taskId,
        actorId: input.actorId,
        action: input.action,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus ?? null,
        reason: input.reason ?? null,
        oldValue: input.oldValue ?? undefined,
        newValue: input.newValue ?? undefined,
        metadata: input.metadata ?? undefined,
      })),
    });
  },

  async findTaskHistoryPaginated(
    taskId: string,
    page: number,
    pageSize: number,
    tx: Prisma.TransactionClient = prisma
  ): Promise<{
    items: TaskHistoryItemDTO[];
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * pageSize;

    const [totalItems, items] = await Promise.all([
      tx.taskHistory.count({ where: { taskId } }),
      tx.taskHistory.findMany({
        where: { taskId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: pageSize,
        select: taskHistorySelect,
      }),
    ]);

    return {
      items,
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    };
  },
};
