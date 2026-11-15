import "server-only";
import {
  Prisma,
  ReviewDecision,
  SprintStatus,
  TaskPriority,
  TaskStatus,
  type ProjectStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AnalyticsGranularity } from "@/modules/reports/report.schema";

export interface ProjectAnalyticsHeaderRecord {
  id: string;
  name: string;
  status: ProjectStatus;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
}

export interface ProjectAnalyticsSourceData {
  project: ProjectAnalyticsHeaderRecord;
  earliestTaskCreatedAt: Date | null;
  statusCounts: Record<TaskStatus, number>;
  priorityMatrix: Array<{
    priority: TaskPriority;
    status: TaskStatus;
    count: number;
    estimateHours: number;
  }>;
  overdueActiveTasks: Array<{
    id: string;
    status: TaskStatus;
    deadline: Date;
  }>;
  createdBuckets: Array<{ bucketKey: string; count: number }>;
  completedBuckets: Array<{ bucketKey: string; count: number }>;
  completedBeforeWindowCount: number;
  reviewBuckets: Array<{ bucketKey: string; decision: ReviewDecision; count: number }>;
  totalProjectReviews: Array<{ decision: ReviewDecision; count: number }>;
  overdueSlipBuckets: Array<{
    bucketKey: string;
    overdueActiveCount: number;
    lateCompletedCount: number;
  }>;
  sprintWorkloadRows: Array<{
    sprintId: string | null;
    sprintName: string | null;
    sprintStatus: SprintStatus | null;
    status: TaskStatus;
    taskCount: number;
    estimatedTaskCount: number;
    estimateHours: number;
  }>;
  activeSprint: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    totalTasks: number;
    doneTasks: number;
  } | null;
  activeSprints?: Array<{
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    totalTasks: number;
    doneTasks: number;
  }>;
}

interface RawCountBucketRow {
  bucketKey: string;
  count: number;
}

interface RawReviewBucketRow {
  bucketKey: string;
  decision: ReviewDecision;
  count: number;
}

interface RawOverdueSlipBucketRow {
  bucketKey: string;
  overdueActiveCount: number;
  lateCompletedCount: number;
}

interface RawCountOnlyRow {
  count: number;
}

function buildPgBucketExpr(columnSql: string, granularity: AnalyticsGranularity): Prisma.Sql {
  const rawCol = Prisma.raw(columnSql);
  if (granularity === "week") {
    return Prisma.sql`to_char(date_trunc('week', (${rawCol} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'YYYY-MM-DD')`;
  }
  return Prisma.sql`to_char(((${rawCol} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYYY-MM-DD')`;
}

export const projectAnalyticsRepository = {
  async findProjectOriginMeta(
    projectId: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<{
    project: ProjectAnalyticsHeaderRecord;
    earliestTaskCreatedAt: Date | null;
  } | null> {
    const [project, earliestTask] = await Promise.all([
      tx.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          name: true,
          status: true,
          startDate: true,
          endDate: true,
          createdAt: true,
        },
      }),
      tx.task.findFirst({
        where: { projectId },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
    ]);

    if (!project) {
      return null;
    }

    return {
      project,
      earliestTaskCreatedAt: earliestTask?.createdAt ?? null,
    };
  },

  /**
   * Executes PostgreSQL-level GROUP BY analytics queries in parallel with Asia/Ho_Chi_Minh
   * calendar alignment (`AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh'`) and zero N+1 loops.
   */
  async loadProjectAnalyticsSource(
    params: {
      project: ProjectAnalyticsHeaderRecord;
      earliestTaskCreatedAt: Date | null;
      fromUtc: Date;
      toUtc: Date;
      granularity: AnalyticsGranularity;
      referenceNow: Date;
    },
    tx: Prisma.TransactionClient = prisma
  ): Promise<ProjectAnalyticsSourceData> {
    const { project, earliestTaskCreatedAt, fromUtc, toUtc, granularity, referenceNow } = params;
    const projectId = project.id;

    const createdBucketExpr = buildPgBucketExpr('"createdAt"', granularity);
    const completedBucketExpr = buildPgBucketExpr('"completedAt"', granularity);
    const reviewedBucketExpr = buildPgBucketExpr('tr."reviewedAt"', granularity);
    const deadlineBucketExpr = buildPgBucketExpr('"deadline"', granularity);

    const [
      statusGroupRows,
      priorityMatrixRows,
      overdueActiveTasks,
      createdBuckets,
      completedBuckets,
      completedBeforeRows,
      reviewBuckets,
      totalProjectReviewsRaw,
      overdueSlipBuckets,
      sprintWorkloadRows,
      activeSprintRaw,
    ] = await Promise.all([
      tx.task.groupBy({
        by: ["status"],
        where: { projectId },
        _count: { _all: true },
      }),
      tx.task.groupBy({
        by: ["priority", "status"],
        where: { projectId },
        _count: { _all: true },
        _sum: { estimateHours: true },
      }),
      tx.task.findMany({
        where: {
          projectId,
          status: { not: TaskStatus.DONE },
          deadline: { lt: referenceNow },
        },
        select: {
          id: true,
          status: true,
          deadline: true,
        },
      }),
      tx.$queryRaw<RawCountBucketRow[]>`
        SELECT
          ${createdBucketExpr} AS "bucketKey",
          COUNT(*)::int AS "count"
        FROM "Task"
        WHERE "projectId" = ${projectId}::uuid
          AND "createdAt" >= ${fromUtc}
          AND "createdAt" <= ${toUtc}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      tx.$queryRaw<RawCountBucketRow[]>`
        SELECT
          ${completedBucketExpr} AS "bucketKey",
          COUNT(*)::int AS "count"
        FROM "Task"
        WHERE "projectId" = ${projectId}::uuid
          AND "status" = 'DONE'::"TaskStatus"
          AND "completedAt" IS NOT NULL
          AND "completedAt" >= ${fromUtc}
          AND "completedAt" <= ${toUtc}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      tx.$queryRaw<RawCountOnlyRow[]>`
        SELECT COUNT(*)::int AS "count"
        FROM "Task"
        WHERE "projectId" = ${projectId}::uuid
          AND "status" = 'DONE'::"TaskStatus"
          AND "completedAt" IS NOT NULL
          AND "completedAt" < ${fromUtc}
      `,
      tx.$queryRaw<RawReviewBucketRow[]>`
        SELECT
          ${reviewedBucketExpr} AS "bucketKey",
          tr."decision" AS "decision",
          COUNT(*)::int AS "count"
        FROM "TaskReview" tr
        INNER JOIN "Task" t ON t."id" = tr."taskId"
        WHERE t."projectId" = ${projectId}::uuid
          AND tr."reviewedAt" >= ${fromUtc}
          AND tr."reviewedAt" <= ${toUtc}
        GROUP BY 1, tr."decision"
        ORDER BY 1 ASC
      `,
      tx.$queryRaw<Array<{ decision: ReviewDecision; count: number }>>`
        SELECT
          tr."decision" AS "decision",
          COUNT(*)::int AS "count"
        FROM "TaskReview" tr
        INNER JOIN "Task" t ON t."id" = tr."taskId"
        WHERE t."projectId" = ${projectId}::uuid
        GROUP BY tr."decision"
      `,
      tx.$queryRaw<RawOverdueSlipBucketRow[]>`
        SELECT
          ${deadlineBucketExpr} AS "bucketKey",
          COUNT(*) FILTER (
            WHERE "status" <> 'DONE'::"TaskStatus"
              AND "deadline" < ${referenceNow}
          )::int AS "overdueActiveCount",
          COUNT(*) FILTER (
            WHERE "status" = 'DONE'::"TaskStatus"
              AND "completedAt" IS NOT NULL
              AND "completedAt" > "deadline"
          )::int AS "lateCompletedCount"
        FROM "Task"
        WHERE "projectId" = ${projectId}::uuid
          AND "deadline" >= ${fromUtc}
          AND "deadline" <= ${toUtc}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      tx.$queryRaw<
        Array<{
          sprintId: string | null;
          sprintName: string | null;
          sprintStatus: SprintStatus | null;
          status: TaskStatus;
          taskCount: number;
          estimatedTaskCount: number;
          estimateHours: number;
        }>
      >`
        SELECT
          t."sprintId" AS "sprintId",
          s."name" AS "sprintName",
          s."status" AS "sprintStatus",
          t."status" AS "status",
          COUNT(*)::int AS "taskCount",
          COUNT(*) FILTER (WHERE t."estimateHours" IS NOT NULL AND t."estimateHours" > 0)::int AS "estimatedTaskCount",
          COALESCE(SUM(CASE WHEN t."estimateHours" IS NOT NULL AND t."estimateHours" > 0 THEN t."estimateHours" ELSE 0 END), 0)::float8 AS "estimateHours"
        FROM "Task" t
        LEFT JOIN "Sprint" s ON s."id" = t."sprintId"
        WHERE t."projectId" = ${projectId}::uuid
        GROUP BY t."sprintId", s."name", s."status", t."status"
      `,
      tx.sprint.findMany({
        where: { projectId, status: SprintStatus.ACTIVE },
        orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          tasks: {
            select: { status: true },
          },
        },
      }),
    ]);

    const statusCounts: Record<TaskStatus, number> = {
      [TaskStatus.TODO]: 0,
      [TaskStatus.IN_PROGRESS]: 0,
      [TaskStatus.REVIEW]: 0,
      [TaskStatus.DONE]: 0,
    };
    for (const row of statusGroupRows) {
      statusCounts[row.status] = row._count._all;
    }

    const priorityMatrix = priorityMatrixRows.map((row) => ({
      priority: row.priority,
      status: row.status,
      count: row._count._all,
      estimateHours: row._sum.estimateHours ?? 0,
    }));

    const activeSprints = activeSprintRaw.map((sp) => ({
      id: sp.id,
      name: sp.name,
      startDate: sp.startDate,
      endDate: sp.endDate,
      totalTasks: sp.tasks.length,
      doneTasks: sp.tasks.filter((t) => t.status === TaskStatus.DONE).length,
    }));
    const activeSprint = activeSprints[0] ?? null;

    return {
      project,
      earliestTaskCreatedAt,
      statusCounts,
      priorityMatrix,
      overdueActiveTasks,
      createdBuckets,
      completedBuckets,
      completedBeforeWindowCount: completedBeforeRows[0]?.count ?? 0,
      reviewBuckets,
      totalProjectReviews: totalProjectReviewsRaw,
      overdueSlipBuckets,
      sprintWorkloadRows,
      activeSprint,
      activeSprints,
    };
  },
};
