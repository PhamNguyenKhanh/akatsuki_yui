import "server-only";
import { TaskHistoryAction, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface SprintReportSourceData {
  project: {
    id: string;
    name: string;
    status: string;
  };
  sprints: Array<{
    id: string;
    projectId: string;
    name: string;
    goal: string | null;
    status: string;
    startDate: Date;
    endDate: Date;
    activatedAt: Date | null;
    completedAt: Date | null;
    cancelledAt: Date | null;
    createdAt: Date;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    sprintId: string | null;
    estimateHours: number | null;
    completedAt: Date | null;
    createdAt: Date;
  }>;
  sprintHistoryEvents: Array<{
    id: string;
    taskId: string;
    action: TaskHistoryAction;
    oldValue: Prisma.JsonValue | null;
    newValue: Prisma.JsonValue | null;
    metadata?: Prisma.JsonValue | null;
    createdAt: Date;
  }>;
  estimateHistoryEvents: Array<{
    id: string;
    taskId: string;
    action: TaskHistoryAction;
    oldValue: Prisma.JsonValue | null;
    newValue: Prisma.JsonValue | null;
    metadata?: Prisma.JsonValue | null;
    createdAt: Date;
  }>;
  activationLogs: Array<{
    id: string;
    entityId: string | null;
    createdAt: Date;
    metadata: Prisma.JsonValue | null;
  }>;
}

export const sprintReportRepository = {
  /**
   * Loads all sprint lifecycle, task, TaskHistory, and activation snapshot records
   * for a project in 5 indexed queries (zero N+1 loops).
   */
  async findProjectSprintReportSource(
    projectId: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<SprintReportSourceData | null> {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, status: true },
    });
    if (!project) {
      return null;
    }

    const sprints = await tx.sprint.findMany({
      where: { projectId },
      orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        projectId: true,
        name: true,
        goal: true,
        status: true,
        startDate: true,
        endDate: true,
        activatedAt: true,
        completedAt: true,
        cancelledAt: true,
        createdAt: true,
      },
    });

    if (sprints.length === 0) {
      return {
        project,
        sprints: [],
        tasks: [],
        sprintHistoryEvents: [],
        estimateHistoryEvents: [],
        activationLogs: [],
      };
    }

    const [tasks, sprintHistoryEvents, estimateHistoryEvents, activationLogs] = await Promise.all([
      tx.task.findMany({
        where: { projectId },
        select: {
          id: true,
          title: true,
          status: true,
          sprintId: true,
          estimateHours: true,
          completedAt: true,
          createdAt: true,
        },
      }),
      tx.taskHistory.findMany({
        where: {
          task: { projectId },
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
      }),
      tx.taskHistory.findMany({
        where: {
          task: { projectId },
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
      }),
      tx.activityLog.findMany({
        where: {
          projectId,
          entityType: "Sprint",
          action: "SPRINT_ACTIVATED",
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          entityId: true,
          createdAt: true,
          metadata: true,
        },
      }),
    ]);

    return {
      project,
      sprints,
      tasks,
      sprintHistoryEvents,
      estimateHistoryEvents,
      activationLogs,
    };
  },
};
