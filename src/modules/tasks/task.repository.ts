import "server-only";
import {
  ProjectStatus,
  TaskPriority,
  TaskStatus,
  type Prisma,
  type ReviewDecision,
  type SprintStatus,
  type UserStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sanitizeExternalHttpUrl } from "@/lib/safe-url";
import { formatTaskCode, type ParsedTaskListQuery } from "@/modules/tasks/task.schema";

export interface TaskSprintRefDTO {
  id: string;
  name: string;
  status: SprintStatus;
}

export interface TaskUserSummaryDTO {
  id: string;
  fullName: string;
  email: string;
  status: UserStatus;
}

export interface TaskAssigneeDTO {
  id: string;
  taskId: string;
  userId: string;
  assignedById: string;
  assignedAt: Date;
  user: TaskUserSummaryDTO;
  assignedBy: {
    id: string;
    fullName: string;
    email: string;
  };
}

export interface TaskDependencyItemDTO {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  createdById: string;
  createdAt: Date;
  dependsOnTask: {
    id: string;
    code: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    deadline: Date;
  };
}

export interface TaskDependentItemDTO {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  task: {
    id: string;
    code: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    deadline: Date;
  };
}

export interface TaskReviewDTO {
  id: string;
  taskId: string;
  submittedById: string | null;
  reviewerId: string;
  decision: ReviewDecision;
  reason: string;
  reviewedAt: Date;
  submittedBy: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  reviewer: {
    id: string;
    fullName: string;
    email: string;
  };
}

export interface TaskBlockerRefDTO {
  id: string;
  code: string;
  title: string;
  status: TaskStatus;
}

export interface MemberWorkloadDTO {
  activeTaskCount: number;
  activeEstimateHours: number;
}

export interface TaskSummaryDTO {
  id: string;
  code: string;
  projectId: string;
  sprintId?: string | null;
  sprint?: TaskSprintRefDTO | null;
  createdById: string;
  createdBy: {
    id: string;
    fullName: string;
    email: string;
  };
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  startDate: Date | null;
  deadline: Date;
  estimateHours: number | null;
  referenceLinks: string[];
  progressNotes: string | null;
  completedAt: Date | null;
  isOverdue: boolean;
  assignees: TaskAssigneeDTO[];
  dependencyCount: number;
  blockedByCount: number;
  blockedByTasks?: TaskBlockerRefDTO[];
  dependentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskDetailDTO extends TaskSummaryDTO {
  project: {
    id: string;
    name: string;
    status: ProjectStatus;
    leaderId: string;
  };
  dependencies: TaskDependencyItemDTO[];
  dependents: TaskDependentItemDTO[];
  reviews: TaskReviewDTO[];
}

export interface ProjectTaskSummaryStatsDTO {
  totalTasks: number;
  todoCount: number;
  inProgressCount: number;
  reviewCount: number;
  doneCount: number;
  overdueCount: number;
}

export interface MyAssignedTaskDTO {
  id: string;
  code: string;
  projectId: string;
  projectName: string;
  projectStatus: ProjectStatus;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  deadline: Date;
  isOverdue: boolean;
}

export interface ProjectTaskOptionDTO {
  id: string;
  code: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: Date;
}

export async function getProjectMemberWorkloads(
  projectId: string
): Promise<Map<string, MemberWorkloadDTO>> {
  const rows = await prisma.taskAssignee.findMany({
    where: {
      removedAt: null,
      task: {
        projectId,
        status: { not: TaskStatus.DONE },
      },
    },
    select: {
      userId: true,
      task: {
        select: {
          estimateHours: true,
        },
      },
    },
  });

  const map = new Map<string, MemberWorkloadDTO>();
  for (const row of rows) {
    const current = map.get(row.userId) ?? { activeTaskCount: 0, activeEstimateHours: 0 };
    current.activeTaskCount += 1;
    current.activeEstimateHours += row.task.estimateHours ?? 0;
    map.set(row.userId, current);
  }
  return map;
}

export function mapReferenceLinks(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => sanitizeExternalHttpUrl(item))
    .filter((item): item is string => item !== null);
}

export function computeIsTaskOverdue(
  status: TaskStatus,
  deadline: Date,
  now: Date = new Date()
): boolean {
  return status !== TaskStatus.DONE && deadline.getTime() < now.getTime();
}

const taskAssigneeSelect = {
  id: true,
  taskId: true,
  userId: true,
  assignedById: true,
  assignedAt: true,
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      status: true,
    },
  },
  assignedBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
} satisfies Prisma.TaskAssigneeSelect;

const taskDependencySelect = {
  id: true,
  taskId: true,
  dependsOnTaskId: true,
  createdById: true,
  createdAt: true,
  dependsOnTask: {
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      deadline: true,
    },
  },
} satisfies Prisma.TaskDependencySelect;

export const taskSummarySelect = {
  id: true,
  projectId: true,
  sprintId: true,
  sprint: {
    select: {
      id: true,
      name: true,
      status: true,
    },
  },
  createdById: true,
  createdBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  title: true,
  description: true,
  priority: true,
  status: true,
  startDate: true,
  deadline: true,
  estimateHours: true,
  referenceLinks: true,
  progressNotes: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  assignees: {
    where: { removedAt: null },
    orderBy: [{ assignedAt: "asc" }, { id: "asc" }],
    select: taskAssigneeSelect,
  },
  dependencies: {
    select: {
      dependsOnTask: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
    },
  },
  _count: {
    select: {
      dependents: true,
    },
  },
} satisfies Prisma.TaskSelect;

const taskDetailSelect = {
  id: true,
  projectId: true,
  sprintId: true,
  sprint: {
    select: {
      id: true,
      name: true,
      status: true,
    },
  },
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
  title: true,
  description: true,
  priority: true,
  status: true,
  startDate: true,
  deadline: true,
  estimateHours: true,
  referenceLinks: true,
  progressNotes: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  assignees: {
    where: { removedAt: null },
    orderBy: [{ assignedAt: "asc" }, { id: "asc" }],
    select: taskAssigneeSelect,
  },
  dependencies: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: taskDependencySelect,
  },
  dependents: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      taskId: true,
      dependsOnTaskId: true,
      task: {
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          deadline: true,
        },
      },
    },
  },
  reviews: {
    orderBy: [{ reviewedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      taskId: true,
      submittedById: true,
      reviewerId: true,
      decision: true,
      reason: true,
      reviewedAt: true,
      submittedBy: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      reviewer: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  },
} satisfies Prisma.TaskSelect;

type RawTaskSummary = Prisma.TaskGetPayload<{ select: typeof taskSummarySelect }>;
type RawTaskDetail = Prisma.TaskGetPayload<{ select: typeof taskDetailSelect }>;

export function mapTaskSummary(row: RawTaskSummary, now: Date): TaskSummaryDTO {
  const dependencyCount = row.dependencies.length;
  const blockingDependencies = row.dependencies.filter(
    (dep) => dep.dependsOnTask.status !== TaskStatus.DONE
  );
  const blockedByCount = blockingDependencies.length;
  const blockedByTasks: TaskBlockerRefDTO[] = blockingDependencies.map((dep) => ({
    id: dep.dependsOnTask.id,
    code: formatTaskCode(dep.dependsOnTask.id),
    title: dep.dependsOnTask.title,
    status: dep.dependsOnTask.status,
  }));

  return {
    id: row.id,
    code: formatTaskCode(row.id),
    projectId: row.projectId,
    sprintId: row.sprintId,
    sprint: row.sprint,
    createdById: row.createdById,
    createdBy: row.createdBy,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    startDate: row.startDate,
    deadline: row.deadline,
    estimateHours: row.estimateHours,
    referenceLinks: mapReferenceLinks(row.referenceLinks),
    progressNotes: row.progressNotes,
    completedAt: row.completedAt,
    isOverdue: computeIsTaskOverdue(row.status, row.deadline, now),
    assignees: row.assignees,
    dependencyCount,
    blockedByCount,
    blockedByTasks,
    dependentCount: row._count.dependents,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapTaskDetail(row: RawTaskDetail, now: Date): TaskDetailDTO {
  const dependencies: TaskDependencyItemDTO[] = row.dependencies.map((dep) => ({
    id: dep.id,
    taskId: dep.taskId,
    dependsOnTaskId: dep.dependsOnTaskId,
    createdById: dep.createdById,
    createdAt: dep.createdAt,
    dependsOnTask: {
      ...dep.dependsOnTask,
      code: formatTaskCode(dep.dependsOnTask.id),
    },
  }));

  const dependents: TaskDependentItemDTO[] = row.dependents.map((dep) => ({
    id: dep.id,
    taskId: dep.taskId,
    dependsOnTaskId: dep.dependsOnTaskId,
    task: {
      ...dep.task,
      code: formatTaskCode(dep.task.id),
    },
  }));

  return {
    id: row.id,
    code: formatTaskCode(row.id),
    projectId: row.projectId,
    sprintId: row.sprintId,
    sprint: row.sprint,
    project: row.project,
    createdById: row.createdById,
    createdBy: row.createdBy,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    startDate: row.startDate,
    deadline: row.deadline,
    estimateHours: row.estimateHours,
    referenceLinks: mapReferenceLinks(row.referenceLinks),
    progressNotes: row.progressNotes,
    completedAt: row.completedAt,
    isOverdue: computeIsTaskOverdue(row.status, row.deadline, now),
    assignees: row.assignees,
    dependencyCount: dependencies.length,
    blockedByCount: dependencies.filter((dep) => dep.dependsOnTask.status !== TaskStatus.DONE)
      .length,
    blockedByTasks: dependencies
      .filter((dep) => dep.dependsOnTask.status !== TaskStatus.DONE)
      .map((dep) => ({
        id: dep.dependsOnTask.id,
        code: dep.dependsOnTask.code,
        title: dep.dependsOnTask.title,
        status: dep.dependsOnTask.status,
      })),
    dependentCount: dependents.length,
    dependencies,
    dependents,
    reviews: row.reviews,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export interface TaskFilterCriteria {
  search?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  unassignedOnly?: boolean;
  overdueOnly?: boolean;
  sprintId?: string;
  backlogOnly?: boolean;
  deadlineFrom?: Date;
  deadlineTo?: Date;
}

export function buildTaskProjectWhereInput(
  projectId: string,
  filter: TaskFilterCriteria,
  now: Date = new Date()
): Prisma.TaskWhereInput {
  const andConditions: Prisma.TaskWhereInput[] = [{ projectId }];

  if (filter.status) {
    andConditions.push({ status: filter.status });
  }
  if (filter.priority) {
    andConditions.push({ priority: filter.priority });
  }
  if (filter.backlogOnly === true) {
    andConditions.push({ sprintId: null });
  } else if (filter.sprintId) {
    andConditions.push({ sprintId: filter.sprintId });
  }
  if (filter.deadlineFrom || filter.deadlineTo) {
    andConditions.push({
      deadline: {
        ...(filter.deadlineFrom ? { gte: filter.deadlineFrom } : {}),
        ...(filter.deadlineTo ? { lte: filter.deadlineTo } : {}),
      },
    });
  }
  if (filter.unassignedOnly) {
    andConditions.push({
      assignees: {
        none: {
          removedAt: null,
        },
      },
    });
  } else if (filter.assigneeId) {
    andConditions.push({
      assignees: {
        some: {
          userId: filter.assigneeId,
          removedAt: null,
        },
      },
    });
  }
  if (filter.overdueOnly) {
    andConditions.push({
      status: { not: TaskStatus.DONE },
      deadline: { lt: now },
    });
  }

  const normalizedSearch = filter.search?.replace(/^#/, "").trim();
  if (normalizedSearch && normalizedSearch.length > 0) {
    andConditions.push({
      OR: [
        { title: { contains: normalizedSearch, mode: "insensitive" } },
        { description: { contains: normalizedSearch, mode: "insensitive" } },
      ],
    });
  }

  return andConditions.length === 1 ? andConditions[0] : { AND: andConditions };
}

export const taskRepository = {
  async findManyByProjectPaginated(
    projectId: string,
    query: ParsedTaskListQuery,
    tx: Prisma.TransactionClient = prisma
  ): Promise<{
    items: TaskSummaryDTO[];
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  }> {
    const now = new Date();
    const skip = (query.page - 1) * query.pageSize;
    const where = buildTaskProjectWhereInput(projectId, query, now);

    const orderBy: Prisma.TaskOrderByWithRelationInput[] = [
      { [query.sortBy]: query.sortOrder },
      { createdAt: "desc" },
    ];

    const [totalItems, rows] = await Promise.all([
      tx.task.count({ where }),
      tx.task.findMany({
        where,
        orderBy,
        skip,
        take: query.pageSize,
        select: taskSummarySelect,
      }),
    ]);

    return {
      items: rows.map((row) => mapTaskSummary(row, now)),
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / query.pageSize)),
    };
  },

  async findSummaryById(
    taskId: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<TaskSummaryDTO | null> {
    const row = await tx.task.findUnique({
      where: { id: taskId },
      select: taskSummarySelect,
    });
    if (!row) return null;
    return mapTaskSummary(row, new Date());
  },

  async findDetailById(
    taskId: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<TaskDetailDTO | null> {
    const row = await tx.task.findUnique({
      where: { id: taskId },
      select: taskDetailSelect,
    });
    if (!row) return null;
    return mapTaskDetail(row, new Date());
  },

  async findProjectTaskStats(
    projectId: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<ProjectTaskSummaryStatsDTO> {
    const now = new Date();
    const [grouped, overdueCount] = await Promise.all([
      tx.task.groupBy({
        by: ["status"],
        where: { projectId },
        _count: { _all: true },
      }),
      tx.task.count({
        where: {
          projectId,
          status: { not: TaskStatus.DONE },
          deadline: { lt: now },
        },
      }),
    ]);

    const counts: Record<TaskStatus, number> = {
      [TaskStatus.TODO]: 0,
      [TaskStatus.IN_PROGRESS]: 0,
      [TaskStatus.REVIEW]: 0,
      [TaskStatus.DONE]: 0,
    };

    for (const row of grouped) {
      counts[row.status] = row._count._all;
    }

    const totalTasks =
      counts[TaskStatus.TODO] +
      counts[TaskStatus.IN_PROGRESS] +
      counts[TaskStatus.REVIEW] +
      counts[TaskStatus.DONE];

    return {
      totalTasks,
      todoCount: counts[TaskStatus.TODO],
      inProgressCount: counts[TaskStatus.IN_PROGRESS],
      reviewCount: counts[TaskStatus.REVIEW],
      doneCount: counts[TaskStatus.DONE],
      overdueCount,
    };
  },

  async findMyAssignedTasks(
    userId: string,
    limit = 6,
    tx: Prisma.TransactionClient = prisma
  ): Promise<MyAssignedTaskDTO[]> {
    const now = new Date();
    const rows = await tx.task.findMany({
      where: {
        status: { not: TaskStatus.DONE },
        project: {
          status: { not: ProjectStatus.ARCHIVED },
          OR: [{ leaderId: userId }, { members: { some: { userId, leftAt: null } } }],
        },
        assignees: {
          some: {
            userId,
            removedAt: null,
          },
        },
      },
      orderBy: [{ deadline: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: {
        id: true,
        projectId: true,
        title: true,
        priority: true,
        status: true,
        deadline: true,
        project: {
          select: {
            name: true,
            status: true,
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      code: formatTaskCode(row.id),
      projectId: row.projectId,
      projectName: row.project.name,
      projectStatus: row.project.status,
      title: row.title,
      priority: row.priority,
      status: row.status,
      deadline: row.deadline,
      isOverdue: computeIsTaskOverdue(row.status, row.deadline, now),
    }));
  },

  async listTaskAssignees(
    taskId: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<TaskAssigneeDTO[]> {
    return tx.taskAssignee.findMany({
      where: {
        taskId,
        removedAt: null,
      },
      orderBy: [{ assignedAt: "asc" }, { id: "asc" }],
      select: taskAssigneeSelect,
    });
  },

  async listTaskDependencies(
    taskId: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<TaskDependencyItemDTO[]> {
    const rows = await tx.taskDependency.findMany({
      where: { taskId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: taskDependencySelect,
    });

    return rows.map((dep) => ({
      ...dep,
      dependsOnTask: {
        ...dep.dependsOnTask,
        code: formatTaskCode(dep.dependsOnTask.id),
      },
    }));
  },

  async getProjectDependencyEdges(
    projectId: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<{ taskId: string; dependsOnTaskId: string }[]> {
    return tx.taskDependency.findMany({
      where: {
        task: { projectId },
      },
      select: {
        taskId: true,
        dependsOnTaskId: true,
      },
    });
  },

  async listProjectTaskOptions(
    projectId: string,
    excludeTaskId?: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<ProjectTaskOptionDTO[]> {
    const rows = await tx.task.findMany({
      where: {
        projectId,
        ...(excludeTaskId ? { id: { not: excludeTaskId } } : {}),
      },
      orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        deadline: true,
      },
    });

    return rows.map((row) => ({
      ...row,
      code: formatTaskCode(row.id),
    }));
  },
};
