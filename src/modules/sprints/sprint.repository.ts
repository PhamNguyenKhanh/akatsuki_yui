import "server-only";
import {
  SprintStatus,
  TaskHistoryAction,
  TaskStatus,
  type ProjectStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { type ParsedSprintListQuery } from "@/modules/sprints/sprint.schema";
import {
  mapTaskSummary,
  taskSummarySelect,
  type TaskSummaryDTO,
} from "@/modules/tasks/task.repository";

export interface SprintTaskStatsDTO {
  totalTasks: number;
  todoCount: number;
  inProgressCount: number;
  reviewCount: number;
  doneCount: number;
  remainingTaskCount: number;
  overdueCount: number;
  progressPercent: number;
  tasksWithEstimateCount: number;
  totalEstimateHours: number;
  completedEstimateHours: number;
  remainingEstimateHours: number;
}

export interface SprintOverlapWarningDTO {
  id: string;
  name: string;
  status: SprintStatus;
  startDate: Date;
  endDate: Date;
}

export interface SprintTargetOptionDTO {
  id: string;
  name: string;
  status: SprintStatus;
  startDate: Date;
  endDate: Date;
}

export interface SprintActivityItemDTO {
  id: string;
  action: string;
  description: string | null;
  actorName: string | null;
  createdAt: Date;
}

export interface SprintSummaryDTO {
  id: string;
  projectId: string;
  createdById: string;
  createdBy: {
    id: string;
    fullName: string;
    email: string;
  };
  name: string;
  goal: string | null;
  startDate: Date;
  endDate: Date;
  status: SprintStatus;
  activatedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  taskStats: SprintTaskStatsDTO;
}

export interface SprintDetailDTO extends SprintSummaryDTO {
  project: {
    id: string;
    name: string;
    status: ProjectStatus;
    leaderId: string;
  };
  tasks: TaskSummaryDTO[];
  activities: SprintActivityItemDTO[];
}

export interface SprintCompletionPreviewDTO {
  sprint: SprintSummaryDTO;
  project: {
    id: string;
    name: string;
    status: ProjectStatus;
  };
  doneTasksCount: number;
  unfinishedTasks: TaskSummaryDTO[];
  availableTargetSprints: SprintTargetOptionDTO[];
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeSprintTaskStats(
  tasks: ReadonlyArray<{
    status: TaskStatus;
    deadline: Date;
    estimateHours: number | null;
  }>,
  now: Date = new Date()
): SprintTaskStatsDTO {
  let todoCount = 0;
  let inProgressCount = 0;
  let reviewCount = 0;
  let doneCount = 0;
  let overdueCount = 0;
  let tasksWithEstimateCount = 0;
  let totalEstimateHours = 0;
  let completedEstimateHours = 0;

  for (const task of tasks) {
    switch (task.status) {
      case TaskStatus.TODO:
        todoCount += 1;
        break;
      case TaskStatus.IN_PROGRESS:
        inProgressCount += 1;
        break;
      case TaskStatus.REVIEW:
        reviewCount += 1;
        break;
      case TaskStatus.DONE:
        doneCount += 1;
        break;
    }

    if (task.status !== TaskStatus.DONE && task.deadline.getTime() < now.getTime()) {
      overdueCount += 1;
    }

    if (typeof task.estimateHours === "number" && Number.isFinite(task.estimateHours)) {
      tasksWithEstimateCount += 1;
      totalEstimateHours += task.estimateHours;
      if (task.status === TaskStatus.DONE) {
        completedEstimateHours += task.estimateHours;
      }
    }
  }

  const totalTasks = tasks.length;
  const remainingTaskCount = totalTasks - doneCount;
  const progressPercent = totalTasks === 0 ? 0 : Math.round((doneCount / totalTasks) * 100);
  const roundedTotal = roundHours(totalEstimateHours);
  const roundedCompleted = roundHours(completedEstimateHours);
  const roundedRemaining = roundHours(Math.max(0, totalEstimateHours - completedEstimateHours));

  return {
    totalTasks,
    todoCount,
    inProgressCount,
    reviewCount,
    doneCount,
    remainingTaskCount,
    overdueCount,
    progressPercent,
    tasksWithEstimateCount,
    totalEstimateHours: roundedTotal,
    completedEstimateHours: roundedCompleted,
    remainingEstimateHours: roundedRemaining,
  };
}

const sprintSummaryBaseSelect = {
  id: true,
  projectId: true,
  createdById: true,
  createdBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  name: true,
  goal: true,
  startDate: true,
  endDate: true,
  status: true,
  activatedAt: true,
  completedAt: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
  tasks: {
    select: {
      status: true,
      deadline: true,
      estimateHours: true,
    },
  },
} satisfies Prisma.SprintSelect;

type RawSprintSummary = Prisma.SprintGetPayload<{ select: typeof sprintSummaryBaseSelect }>;

function mapSprintSummary(row: RawSprintSummary, now: Date): SprintSummaryDTO {
  return {
    id: row.id,
    projectId: row.projectId,
    createdById: row.createdById,
    createdBy: row.createdBy,
    name: row.name,
    goal: row.goal,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    activatedAt: row.activatedAt,
    completedAt: row.completedAt,
    cancelledAt: row.cancelledAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    taskStats: computeSprintTaskStats(row.tasks, now),
  };
}

const STATUS_SORT_WEIGHT: Record<SprintStatus, number> = {
  ACTIVE: 0,
  PLANNED: 1,
  COMPLETED: 2,
  CANCELLED: 3,
};

export const sprintRepository = {
  async findManyByProject(
    projectId: string,
    query: ParsedSprintListQuery,
    tx: Prisma.TransactionClient = prisma
  ): Promise<SprintSummaryDTO[]> {
    const now = new Date();
    const andConditions: Prisma.SprintWhereInput[] = [{ projectId }];

    if (query.status) {
      andConditions.push({ status: query.status });
    }

    const normalizedSearch = query.search?.trim();
    if (normalizedSearch && normalizedSearch.length > 0) {
      andConditions.push({
        OR: [
          { name: { contains: normalizedSearch, mode: "insensitive" } },
          { goal: { contains: normalizedSearch, mode: "insensitive" } },
        ],
      });
    }

    const rows = await tx.sprint.findMany({
      where: andConditions.length === 1 ? andConditions[0] : { AND: andConditions },
      orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
      select: sprintSummaryBaseSelect,
    });

    rows.sort((a, b) => {
      const weightDiff = STATUS_SORT_WEIGHT[a.status] - STATUS_SORT_WEIGHT[b.status];
      if (weightDiff !== 0) return weightDiff;
      return b.startDate.getTime() - a.startDate.getTime();
    });

    return rows.map((row) => mapSprintSummary(row, now));
  },

  async findSummaryById(
    sprintId: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<SprintSummaryDTO | null> {
    const row = await tx.sprint.findUnique({
      where: { id: sprintId },
      select: sprintSummaryBaseSelect,
    });
    if (!row) return null;
    return mapSprintSummary(row, new Date());
  },

  async findDetailById(
    sprintId: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<SprintDetailDTO | null> {
    const now = new Date();
    const row = await tx.sprint.findUnique({
      where: { id: sprintId },
      select: {
        id: true,
        projectId: true,
        createdById: true,
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            status: true,
            leaderId: true,
          },
        },
        name: true,
        goal: true,
        startDate: true,
        endDate: true,
        status: true,
        activatedAt: true,
        completedAt: true,
        cancelledAt: true,
        createdAt: true,
        updatedAt: true,
        tasks: {
          orderBy: [{ deadline: "asc" }, { priority: "desc" }, { createdAt: "asc" }],
          select: taskSummarySelect,
        },
      },
    });

    if (!row) return null;

    const activityRows = await tx.activityLog.findMany({
      where: {
        entityType: "Sprint",
        entityId: sprintId,
      },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        action: true,
        description: true,
        createdAt: true,
        user: {
          select: {
            fullName: true,
          },
        },
      },
    });

    const mappedTasks = row.tasks.map((task) => mapTaskSummary(task, now));

    return {
      id: row.id,
      projectId: row.projectId,
      createdById: row.createdById,
      createdBy: row.createdBy,
      project: row.project,
      name: row.name,
      goal: row.goal,
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status,
      activatedAt: row.activatedAt,
      completedAt: row.completedAt,
      cancelledAt: row.cancelledAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      taskStats: computeSprintTaskStats(mappedTasks, now),
      tasks: mappedTasks,
      activities: activityRows.map((entry) => ({
        id: entry.id,
        action: entry.action,
        description: entry.description,
        actorName: entry.user?.fullName ?? null,
        createdAt: entry.createdAt,
      })),
    };
  },

  async findOverlappingSprints(
    projectId: string,
    startDate: Date,
    endDate: Date,
    excludeSprintId?: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<SprintOverlapWarningDTO[]> {
    return tx.sprint.findMany({
      where: {
        projectId,
        status: { in: [SprintStatus.PLANNED, SprintStatus.ACTIVE] },
        ...(excludeSprintId ? { id: { not: excludeSprintId } } : {}),
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    });
  },

  async findAvailablePlanningSprints(
    projectId: string,
    excludeSprintId?: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<SprintTargetOptionDTO[]> {
    const rows = await tx.sprint.findMany({
      where: {
        projectId,
        status: { in: [SprintStatus.PLANNED, SprintStatus.ACTIVE] },
        ...(excludeSprintId ? { id: { not: excludeSprintId } } : {}),
      },
      orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    });

    rows.sort((a, b) => {
      const weightDiff = STATUS_SORT_WEIGHT[a.status] - STATUS_SORT_WEIGHT[b.status];
      if (weightDiff !== 0) return weightDiff;
      return a.startDate.getTime() - b.startDate.getTime();
    });

    return rows;
  },

  async findCompletionPreviewData(
    sprintId: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<SprintCompletionPreviewDTO | null> {
    const now = new Date();
    const sprintRow = await tx.sprint.findUnique({
      where: { id: sprintId },
      select: {
        id: true,
        projectId: true,
        createdById: true,
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        name: true,
        goal: true,
        startDate: true,
        endDate: true,
        status: true,
        activatedAt: true,
        completedAt: true,
        cancelledAt: true,
        createdAt: true,
        updatedAt: true,
        tasks: {
          orderBy: [{ deadline: "asc" }, { priority: "desc" }, { createdAt: "asc" }],
          select: taskSummarySelect,
        },
      },
    });

    if (!sprintRow) return null;

    const mappedTasks = sprintRow.tasks.map((task) => mapTaskSummary(task, now));
    const unfinishedTasks = mappedTasks.filter((task) => task.status !== TaskStatus.DONE);
    const doneTasksCount = mappedTasks.length - unfinishedTasks.length;

    const availableTargetSprints = await sprintRepository.findAvailablePlanningSprints(
      sprintRow.projectId,
      sprintRow.id,
      tx
    );

    return {
      sprint: {
        id: sprintRow.id,
        projectId: sprintRow.projectId,
        createdById: sprintRow.createdById,
        createdBy: sprintRow.createdBy,
        name: sprintRow.name,
        goal: sprintRow.goal,
        startDate: sprintRow.startDate,
        endDate: sprintRow.endDate,
        status: sprintRow.status,
        activatedAt: sprintRow.activatedAt,
        completedAt: sprintRow.completedAt,
        cancelledAt: sprintRow.cancelledAt,
        createdAt: sprintRow.createdAt,
        updatedAt: sprintRow.updatedAt,
        taskStats: computeSprintTaskStats(mappedTasks, now),
      },
      project: sprintRow.project,
      doneTasksCount,
      unfinishedTasks,
      availableTargetSprints,
    };
  },

  async findBurndownSourceData(sprintId: string, tx: Prisma.TransactionClient = prisma) {
    const sprint = await tx.sprint.findUnique({
      where: { id: sprintId },
      select: {
        id: true,
        projectId: true,
        name: true,
        startDate: true,
        endDate: true,
        status: true,
        activatedAt: true,
        completedAt: true,
        cancelledAt: true,
        createdAt: true,
      },
    });

    if (!sprint) return null;

    // Fetch both tasks currently in this sprint and any tasks in the same project
    // whose TaskHistory records a sprint assignment/removal/move referencing sprintId.
    const sprintHistoryEvents = await tx.taskHistory.findMany({
      where: {
        task: { projectId: sprint.projectId },
        action: {
          in: [
            TaskHistoryAction.SPRINT_ASSIGNED,
            TaskHistoryAction.SPRINT_REMOVED,
            TaskHistoryAction.SPRINT_MOVED,
          ],
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        taskId: true,
        action: true,
        oldValue: true,
        newValue: true,
        metadata: true,
        createdAt: true,
      },
    });

    const relatedTaskIds = new Set<string>();
    for (const event of sprintHistoryEvents) {
      const oldSprintId =
        event.oldValue && typeof event.oldValue === "object" && !Array.isArray(event.oldValue)
          ? (event.oldValue as Record<string, unknown>).sprintId
          : undefined;
      const newSprintId =
        event.newValue && typeof event.newValue === "object" && !Array.isArray(event.newValue)
          ? (event.newValue as Record<string, unknown>).sprintId
          : undefined;
      if (oldSprintId === sprint.id || newSprintId === sprint.id) {
        relatedTaskIds.add(event.taskId);
      }
    }

    const tasks = await tx.task.findMany({
      where: {
        projectId: sprint.projectId,
        OR: [
          { sprintId: sprint.id },
          ...(relatedTaskIds.size > 0 ? [{ id: { in: Array.from(relatedTaskIds) } }] : []),
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        sprintId: true,
        deadline: true,
        estimateHours: true,
        completedAt: true,
        createdAt: true,
      },
    });

    const taskIdSet = new Set(tasks.map((t) => t.id));
    const filteredEvents = sprintHistoryEvents.filter((e) => taskIdSet.has(e.taskId));
    const taskIds = Array.from(taskIdSet);

    const [estimateHistoryEvents, activationLog] = await Promise.all([
      taskIds.length > 0
        ? tx.taskHistory.findMany({
            where: {
              taskId: { in: taskIds },
              action: {
                in: [TaskHistoryAction.CREATED, TaskHistoryAction.INFO_UPDATED],
              },
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: {
              id: true,
              taskId: true,
              action: true,
              oldValue: true,
              newValue: true,
              metadata: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
      tx.activityLog.findFirst({
        where: {
          entityType: "Sprint",
          entityId: sprint.id,
          action: "SPRINT_ACTIVATED",
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          metadata: true,
        },
      }),
    ]);

    let activationBaselineTasks:
      Array<{ taskId: string; estimateHours: number | null }> | undefined;
    if (
      activationLog?.metadata &&
      typeof activationLog.metadata === "object" &&
      !Array.isArray(activationLog.metadata)
    ) {
      const rawBaselineTasks = (activationLog.metadata as Record<string, unknown>).baselineTasks;
      if (Array.isArray(rawBaselineTasks)) {
        activationBaselineTasks = rawBaselineTasks
          .filter(
            (item): item is { taskId: string; estimateHours?: unknown } =>
              typeof item === "object" &&
              item !== null &&
              typeof (item as { taskId?: unknown }).taskId === "string"
          )
          .map((item) => ({
            taskId: item.taskId,
            estimateHours:
              typeof item.estimateHours === "number" && Number.isFinite(item.estimateHours)
                ? item.estimateHours
                : null,
          }));
      }
    }

    return {
      sprint,
      tasks,
      historyEvents: filteredEvents,
      estimateHistoryEvents,
      activationBaselineTasks,
    };
  },
};
