import "server-only";
import {
  ProjectMemberRole,
  ReviewDecision,
  TaskHistoryAction,
  TaskStatus,
  type Prisma,
  type ProjectStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface MemberContributionUserRef {
  id: string;
  fullName: string;
  email: string;
}

export interface MemberContributionSourceData {
  project: {
    id: string;
    name: string;
    status: ProjectStatus;
    startDate: Date | null;
    createdAt: Date;
    leaderId: string;
    instructorId: string | null;
    leader: MemberContributionUserRef;
    instructor: MemberContributionUserRef | null;
    members: Array<{
      id: string;
      userId: string;
      projectRole: ProjectMemberRole;
      joinedAt: Date;
      leftAt: Date | null;
      user: MemberContributionUserRef;
    }>;
  };
  earliestTaskCreatedAt: Date | null;
  tasks: Array<{
    id: string;
    status: TaskStatus;
    deadline: Date;
    estimateHours: number | null;
    createdAt: Date;
    completedAt: Date | null;
    assignees: Array<{
      id: string;
      userId: string;
      assignedAt: Date;
      removedAt: Date | null;
      user: MemberContributionUserRef;
    }>;
  }>;
  taskHistoryActionsInWindow: Array<{
    actorId: string | null;
    action: TaskHistoryAction;
    count: number;
  }>;
  taskReviewsInWindow: Array<{
    reviewerId: string;
    decision: ReviewDecision;
    count: number;
  }>;
  activityLogsInWindow: Array<{
    userId: string;
    count: number;
  }>;
}

export const memberContributionRepository = {
  async findProjectMetaForMembers(projectId: string, tx: Prisma.TransactionClient = prisma) {
    const [project, earliestTask] = await Promise.all([
      tx.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          name: true,
          status: true,
          startDate: true,
          createdAt: true,
          leaderId: true,
          instructorId: true,
          leader: { select: { id: true, fullName: true, email: true } },
          instructor: { select: { id: true, fullName: true, email: true } },
          members: {
            orderBy: [{ joinedAt: "asc" }],
            select: {
              id: true,
              userId: true,
              projectRole: true,
              joinedAt: true,
              leftAt: true,
              user: { select: { id: true, fullName: true, email: true } },
            },
          },
        },
      }),
      tx.task.findFirst({
        where: { projectId },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
    ]);

    if (!project) return null;
    return {
      project,
      earliestTaskCreatedAt: earliestTask?.createdAt ?? null,
    };
  },

  /**
   * Loads Project tasks, assignment episodes (active + historical), and database-aggregated
   * verifiable action counts within [fromUtc, toUtc] in 3 parallel queries (zero N+1 loops).
   */
  async loadMemberContributionSource(
    params: {
      project: MemberContributionSourceData["project"];
      earliestTaskCreatedAt: Date | null;
      fromUtc: Date;
      toUtc: Date;
    },
    tx: Prisma.TransactionClient = prisma
  ): Promise<MemberContributionSourceData> {
    const { project, earliestTaskCreatedAt, fromUtc, toUtc } = params;
    const projectId = project.id;

    const [tasks, taskHistoryActionsInWindow, taskReviewsInWindow, activityLogsInWindow] =
      await Promise.all([
        tx.task.findMany({
          where: { projectId },
          select: {
            id: true,
            status: true,
            deadline: true,
            estimateHours: true,
            createdAt: true,
            completedAt: true,
            assignees: {
              select: {
                id: true,
                userId: true,
                assignedAt: true,
                removedAt: true,
                user: { select: { id: true, fullName: true, email: true } },
              },
            },
          },
        }),
        tx.$queryRaw<
          Array<{
            actorId: string | null;
            action: TaskHistoryAction;
            count: number;
          }>
        >`
          SELECT
            th."actorId" AS "actorId",
            th."action" AS "action",
            COUNT(*)::int AS "count"
          FROM "TaskHistory" th
          INNER JOIN "Task" t ON t."id" = th."taskId"
          WHERE t."projectId" = ${projectId}::uuid
            AND th."createdAt" >= ${fromUtc}
            AND th."createdAt" <= ${toUtc}
          GROUP BY th."actorId", th."action"
        `,
        tx.$queryRaw<
          Array<{
            reviewerId: string;
            decision: ReviewDecision;
            count: number;
          }>
        >`
          SELECT
            tr."reviewerId" AS "reviewerId",
            tr."decision" AS "decision",
            COUNT(*)::int AS "count"
          FROM "TaskReview" tr
          INNER JOIN "Task" t ON t."id" = tr."taskId"
          WHERE t."projectId" = ${projectId}::uuid
            AND tr."reviewedAt" >= ${fromUtc}
            AND tr."reviewedAt" <= ${toUtc}
          GROUP BY tr."reviewerId", tr."decision"
        `,
        tx.$queryRaw<Array<{ userId: string; count: number }>>`
          SELECT
            al."userId" AS "userId",
            COUNT(*)::int AS "count"
          FROM "ActivityLog" al
          WHERE al."projectId" = ${projectId}::uuid
            AND al."createdAt" >= ${fromUtc}
            AND al."createdAt" <= ${toUtc}
          GROUP BY al."userId"
        `,
      ]);

    return {
      project,
      earliestTaskCreatedAt,
      tasks,
      taskHistoryActionsInWindow,
      taskReviewsInWindow,
      activityLogsInWindow,
    };
  },
};
