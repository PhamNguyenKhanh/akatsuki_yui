import "server-only";
import { ReviewDecision, SprintStatus, TaskPriority, TaskStatus } from "@prisma/client";
import { badRequestError, notFoundError } from "@/lib/errors";
import { formatPgDateYmd } from "@/lib/timezone";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { assertPermission } from "@/modules/authorization/policy.service";
import { assertProjectReadAccess, parseProjectId } from "@/modules/projects/project.access";
import {
  computeProjectTimelineProgress,
  type ProjectTimelineProgressDTO,
} from "@/modules/projects/project-progress";
import {
  projectAnalyticsRepository,
  type ProjectAnalyticsSourceData,
} from "@/modules/reports/project-analytics.repository";
import {
  analyticsQuerySchema,
  resolveAnalyticsDateWindow,
  type AnalyticsGranularity,
  type ResolvedAnalyticsDateWindow,
} from "@/modules/reports/report.schema";
import type { AuthContext } from "@/types/auth";

const DAY_MS = 86_400_000;

export interface CompletionTrendPointDTO {
  bucketKey: string;
  label: string;
  createdCount: number;
  completedCount: number;
  cumulativeCompletedCount: number;
}

export interface StatusDistributionItemDTO {
  status: TaskStatus;
  count: number;
  percent: number;
  plannedEstimateHours: number;
}

export interface PriorityDistributionItemDTO {
  priority: TaskPriority;
  totalCount: number;
  doneCount: number;
  openCount: number;
  plannedEstimateHours: number;
}

export interface ReviewTrendPointDTO {
  bucketKey: string;
  label: string;
  approvedCount: number;
  rejectedCount: number;
  totalCount: number;
}

export interface OverdueAgingBucketDTO {
  key: "1_3_DAYS" | "4_7_DAYS" | "8_14_DAYS" | "OVER_14_DAYS";
  label: string;
  count: number;
}

export interface OverdueSlipTrendPointDTO {
  bucketKey: string;
  label: string;
  overdueActiveCount: number;
  lateCompletedCount: number;
}

export interface SprintWorkloadBucketDTO {
  sprintId: string | null;
  sprintName: string;
  sprintStatus: SprintStatus | "BACKLOG";
  totalTasks: number;
  estimatedTaskCount: number;
  unestimatedTaskCount: number;
  plannedEstimateHours: number;
  completedEstimateHours: number;
}

export interface ProjectActiveSprintSummaryDTO {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  totalTasks: number;
  doneTasks: number;
  progressPercent: number;
}

export interface ProjectAnalyticsDTO {
  projectId: string;
  projectName: string;
  projectStatus: string;
  isReadOnly: boolean;
  privacyScope: "PROJECT_AGGREGATE_ONLY";
  window: {
    preset: string;
    fromYmd: string;
    toYmd: string;
    spanDays: number;
    granularity: AnalyticsGranularity;
    wasClampedTo365Days: boolean;
    timezone: "Asia/Ho_Chi_Minh";
  };
  summary: {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    reviewTasks: number;
    todoTasks: number;
    overdueTasks: number;
    taskWorkProgressPercent: number;
    projectTimelineProgress: ProjectTimelineProgressDTO;
    activeSprint: ProjectActiveSprintSummaryDTO | null;
    activeSprints: ProjectActiveSprintSummaryDTO[];
    overallReviewApprovalRatePercent: number;
    overallTotalReviews: number;
  };
  completionTrend: CompletionTrendPointDTO[];
  statusDistribution: StatusDistributionItemDTO[];
  priorityDistribution: PriorityDistributionItemDTO[];
  reviewAnalytics: {
    summary: {
      totalInWindow: number;
      approvedInWindow: number;
      rejectedInWindow: number;
      approvalRateInWindowPercent: number;
      reworkRateInWindowPercent: number;
      overallTotal: number;
      overallApproved: number;
      overallRejected: number;
    };
    trend: ReviewTrendPointDTO[];
  };
  overdueAnalytics: {
    totalOverdueNow: number;
    overdueByStatus: {
      TODO: number;
      IN_PROGRESS: number;
      REVIEW: number;
    };
    agingBuckets: OverdueAgingBucketDTO[];
    slipTrend: OverdueSlipTrendPointDTO[];
  };
  workloadSummary: {
    totalPlannedEstimateHours: number;
    donePlannedEstimateHours: number;
    remainingPlannedEstimateHours: number;
    estimatedTaskCount: number;
    unestimatedTaskCount: number;
    totalTasks: number;
    estimateCoveragePercent: number;
    bySprint: SprintWorkloadBucketDTO[];
    limitations: string[];
  };
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return roundOneDecimal((numerator / denominator) * 100);
}

function formatBucketLabel(bucketKey: string, granularity: AnalyticsGranularity): string {
  const parts = bucketKey.split("-");
  if (parts.length !== 3) {
    return bucketKey;
  }
  const ddMm = `${parts[2]}/${parts[1]}`;
  return granularity === "week" ? `Tuần ${ddMm}` : ddMm;
}

/**
 * Computes Project-aggregate analytics strictly compliant with DEC-048, DEC-051,
 * DEC-052 (aggregate only, zero per-user arrays), DEC-053, and DEC-057.
 */
export function computeProjectAnalytics(
  source: ProjectAnalyticsSourceData,
  window: ResolvedAnalyticsDateWindow,
  referenceNow: Date = new Date()
): ProjectAnalyticsDTO {
  const { statusCounts, priorityMatrix, overdueActiveTasks } = source;
  const totalTasks =
    statusCounts.TODO + statusCounts.IN_PROGRESS + statusCounts.REVIEW + statusCounts.DONE;

  // Status Distribution + Estimate Hours per status
  const hoursByStatus: Record<TaskStatus, number> = {
    [TaskStatus.TODO]: 0,
    [TaskStatus.IN_PROGRESS]: 0,
    [TaskStatus.REVIEW]: 0,
    [TaskStatus.DONE]: 0,
  };
  for (const row of priorityMatrix) {
    hoursByStatus[row.status] += row.estimateHours;
  }

  const orderedStatuses: TaskStatus[] = [
    TaskStatus.TODO,
    TaskStatus.IN_PROGRESS,
    TaskStatus.REVIEW,
    TaskStatus.DONE,
  ];
  const statusDistribution: StatusDistributionItemDTO[] = orderedStatuses.map((status) => ({
    status,
    count: statusCounts[status],
    percent: formatPercent(statusCounts[status], totalTasks),
    plannedEstimateHours: roundTwoDecimals(hoursByStatus[status]),
  }));

  // Priority Distribution
  const priorityStatsMap = new Map<
    TaskPriority,
    { totalCount: number; doneCount: number; plannedEstimateHours: number }
  >();
  const orderedPriorities: TaskPriority[] = [
    TaskPriority.CRITICAL,
    TaskPriority.HIGH,
    TaskPriority.MEDIUM,
    TaskPriority.LOW,
  ];
  for (const p of orderedPriorities) {
    priorityStatsMap.set(p, { totalCount: 0, doneCount: 0, plannedEstimateHours: 0 });
  }
  for (const row of priorityMatrix) {
    const entry = priorityStatsMap.get(row.priority)!;
    entry.totalCount += row.count;
    if (row.status === TaskStatus.DONE) {
      entry.doneCount += row.count;
    }
    entry.plannedEstimateHours += row.estimateHours;
  }
  const priorityDistribution: PriorityDistributionItemDTO[] = orderedPriorities.map((priority) => {
    const entry = priorityStatsMap.get(priority)!;
    return {
      priority,
      totalCount: entry.totalCount,
      doneCount: entry.doneCount,
      openCount: Math.max(0, entry.totalCount - entry.doneCount),
      plannedEstimateHours: roundTwoDecimals(entry.plannedEstimateHours),
    };
  });

  // Chart 1: Completion & Creation Trend
  const createdByBucket = new Map<string, number>();
  for (const row of source.createdBuckets) {
    createdByBucket.set(row.bucketKey, (createdByBucket.get(row.bucketKey) ?? 0) + row.count);
  }
  const completedByBucket = new Map<string, number>();
  for (const row of source.completedBuckets) {
    completedByBucket.set(row.bucketKey, (completedByBucket.get(row.bucketKey) ?? 0) + row.count);
  }

  let cumulativeCompleted = source.completedBeforeWindowCount;
  const completionTrend: CompletionTrendPointDTO[] = window.bucketKeys.map((bucketKey) => {
    const createdCount = createdByBucket.get(bucketKey) ?? 0;
    const completedCount = completedByBucket.get(bucketKey) ?? 0;
    cumulativeCompleted += completedCount;
    return {
      bucketKey,
      label: formatBucketLabel(bucketKey, window.granularity),
      createdCount,
      completedCount,
      cumulativeCompletedCount: cumulativeCompleted,
    };
  });

  // Chart 4: Review Trend & Health
  const reviewMap = new Map<string, { approved: number; rejected: number }>();
  let approvedInWindow = 0;
  let rejectedInWindow = 0;
  for (const row of source.reviewBuckets) {
    let bucket = reviewMap.get(row.bucketKey);
    if (!bucket) {
      bucket = { approved: 0, rejected: 0 };
      reviewMap.set(row.bucketKey, bucket);
    }
    if (row.decision === ReviewDecision.APPROVED) {
      bucket.approved += row.count;
      approvedInWindow += row.count;
    } else {
      bucket.rejected += row.count;
      rejectedInWindow += row.count;
    }
  }
  const totalInWindow = approvedInWindow + rejectedInWindow;

  let overallApproved = 0;
  let overallRejected = 0;
  for (const row of source.totalProjectReviews) {
    if (row.decision === ReviewDecision.APPROVED) {
      overallApproved += row.count;
    } else {
      overallRejected += row.count;
    }
  }
  const overallTotal = overallApproved + overallRejected;

  const reviewTrend: ReviewTrendPointDTO[] = window.bucketKeys.map((bucketKey) => {
    const stats = reviewMap.get(bucketKey) ?? { approved: 0, rejected: 0 };
    return {
      bucketKey,
      label: formatBucketLabel(bucketKey, window.granularity),
      approvedCount: stats.approved,
      rejectedCount: stats.rejected,
      totalCount: stats.approved + stats.rejected,
    };
  });

  // Chart 5: Overdue Aging + Overdue Slip Trend
  const overdueByStatus = {
    TODO: 0,
    IN_PROGRESS: 0,
    REVIEW: 0,
  };
  let bucket1to3 = 0;
  let bucket4to7 = 0;
  let bucket8to14 = 0;
  let bucketOver14 = 0;

  for (const item of overdueActiveTasks) {
    if (item.status === TaskStatus.TODO) overdueByStatus.TODO += 1;
    else if (item.status === TaskStatus.IN_PROGRESS) overdueByStatus.IN_PROGRESS += 1;
    else if (item.status === TaskStatus.REVIEW) overdueByStatus.REVIEW += 1;

    const overdueDays = Math.max(0, (referenceNow.getTime() - item.deadline.getTime()) / DAY_MS);
    if (overdueDays <= 3) {
      bucket1to3 += 1;
    } else if (overdueDays <= 7) {
      bucket4to7 += 1;
    } else if (overdueDays <= 14) {
      bucket8to14 += 1;
    } else {
      bucketOver14 += 1;
    }
  }

  const agingBuckets: OverdueAgingBucketDTO[] = [
    { key: "1_3_DAYS", label: "1-3 ngày", count: bucket1to3 },
    { key: "4_7_DAYS", label: "4-7 ngày", count: bucket4to7 },
    { key: "8_14_DAYS", label: "8-14 ngày", count: bucket8to14 },
    { key: "OVER_14_DAYS", label: "> 14 ngày", count: bucketOver14 },
  ];

  const slipMap = new Map<string, { overdueActiveCount: number; lateCompletedCount: number }>();
  for (const row of source.overdueSlipBuckets) {
    const prev = slipMap.get(row.bucketKey) ?? {
      overdueActiveCount: 0,
      lateCompletedCount: 0,
    };
    prev.overdueActiveCount += row.overdueActiveCount;
    prev.lateCompletedCount += row.lateCompletedCount;
    slipMap.set(row.bucketKey, prev);
  }
  const slipTrend: OverdueSlipTrendPointDTO[] = window.bucketKeys.map((bucketKey) => {
    const entry = slipMap.get(bucketKey) ?? {
      overdueActiveCount: 0,
      lateCompletedCount: 0,
    };
    return {
      bucketKey,
      label: formatBucketLabel(bucketKey, window.granularity),
      overdueActiveCount: entry.overdueActiveCount,
      lateCompletedCount: entry.lateCompletedCount,
    };
  });

  // Chart 6: Project-Aggregate Planned Effort Distribution (DEC-048, DEC-052)
  const sprintBucketMap = new Map<string, SprintWorkloadBucketDTO>();
  let totalPlannedEstimateHours = 0;
  let donePlannedEstimateHours = 0;
  let estimatedTaskCount = 0;

  for (const row of source.sprintWorkloadRows) {
    const key = row.sprintId ?? "__BACKLOG__";
    let bucket = sprintBucketMap.get(key);
    if (!bucket) {
      bucket = {
        sprintId: row.sprintId,
        sprintName: row.sprintName ?? "Product Backlog",
        sprintStatus: row.sprintId ? (row.sprintStatus ?? SprintStatus.PLANNED) : "BACKLOG",
        totalTasks: 0,
        estimatedTaskCount: 0,
        unestimatedTaskCount: 0,
        plannedEstimateHours: 0,
        completedEstimateHours: 0,
      };
      sprintBucketMap.set(key, bucket);
    }

    bucket.totalTasks += row.taskCount;
    bucket.estimatedTaskCount += row.estimatedTaskCount;
    bucket.unestimatedTaskCount += Math.max(0, row.taskCount - row.estimatedTaskCount);
    bucket.plannedEstimateHours += row.estimateHours;
    if (row.status === TaskStatus.DONE) {
      bucket.completedEstimateHours += row.estimateHours;
      donePlannedEstimateHours += row.estimateHours;
    }

    estimatedTaskCount += row.estimatedTaskCount;
    totalPlannedEstimateHours += row.estimateHours;
  }

  const bySprint = Array.from(sprintBucketMap.values())
    .map((bucket) => ({
      ...bucket,
      plannedEstimateHours: roundTwoDecimals(bucket.plannedEstimateHours),
      completedEstimateHours: roundTwoDecimals(bucket.completedEstimateHours),
    }))
    .sort((a, b) => {
      if (a.sprintId === null && b.sprintId !== null) return 1;
      if (a.sprintId !== null && b.sprintId === null) return -1;
      return a.sprintName.localeCompare(b.sprintName, "vi");
    });

  const unestimatedTaskCount = Math.max(0, totalTasks - estimatedTaskCount);
  const projectTimelineProgress = computeProjectTimelineProgress(
    source.project.startDate,
    source.project.endDate,
    referenceNow
  );

  const activeSprintsRaw =
    source.activeSprints ?? (source.activeSprint ? [source.activeSprint] : []);
  const activeSprints: ProjectActiveSprintSummaryDTO[] = activeSprintsRaw.map((sp) => ({
    id: sp.id,
    name: sp.name,
    startDate: formatPgDateYmd(sp.startDate),
    endDate: formatPgDateYmd(sp.endDate),
    totalTasks: sp.totalTasks,
    doneTasks: sp.doneTasks,
    progressPercent: formatPercent(sp.doneTasks, sp.totalTasks),
  }));

  return {
    projectId: source.project.id,
    projectName: source.project.name,
    projectStatus: source.project.status,
    isReadOnly: source.project.status === "ARCHIVED",
    privacyScope: "PROJECT_AGGREGATE_ONLY",
    window: {
      preset: window.preset,
      fromYmd: window.fromYmd,
      toYmd: window.toYmd,
      spanDays: window.spanDays,
      granularity: window.granularity,
      wasClampedTo365Days: window.wasClampedTo365Days,
      timezone: window.timezone,
    },
    summary: {
      totalTasks,
      completedTasks: statusCounts.DONE,
      inProgressTasks: statusCounts.IN_PROGRESS,
      reviewTasks: statusCounts.REVIEW,
      todoTasks: statusCounts.TODO,
      overdueTasks: overdueActiveTasks.length,
      taskWorkProgressPercent: formatPercent(statusCounts.DONE, totalTasks),
      projectTimelineProgress,
      activeSprint: activeSprints[0] ?? null,
      activeSprints,
      overallReviewApprovalRatePercent: formatPercent(overallApproved, overallTotal),
      overallTotalReviews: overallTotal,
    },
    completionTrend,
    statusDistribution,
    priorityDistribution,
    reviewAnalytics: {
      summary: {
        totalInWindow,
        approvedInWindow,
        rejectedInWindow,
        approvalRateInWindowPercent: formatPercent(approvedInWindow, totalInWindow),
        reworkRateInWindowPercent: formatPercent(rejectedInWindow, totalInWindow),
        overallTotal,
        overallApproved,
        overallRejected,
      },
      trend: reviewTrend,
    },
    overdueAnalytics: {
      totalOverdueNow: overdueActiveTasks.length,
      overdueByStatus,
      agingBuckets,
      slipTrend,
    },
    workloadSummary: {
      totalPlannedEstimateHours: roundTwoDecimals(totalPlannedEstimateHours),
      donePlannedEstimateHours: roundTwoDecimals(donePlannedEstimateHours),
      remainingPlannedEstimateHours: roundTwoDecimals(
        Math.max(0, totalPlannedEstimateHours - donePlannedEstimateHours)
      ),
      estimatedTaskCount,
      unestimatedTaskCount,
      totalTasks,
      estimateCoveragePercent: formatPercent(estimatedTaskCount, totalTasks),
      bySprint,
      limitations: [
        "Estimate Hours là khối lượng kế hoạch dự kiến, không phải thời gian thực tế đã ghi nhận.",
        "Hệ thống không xếp hạng hay chia khối lượng công việc theo từng cá nhân trong báo cáo tổng hợp này.",
      ],
    },
  };
}

/**
 * Retrieves validated timeframe-filtered Project Aggregate Analytics (`DEC-052`, `DEC-053`, `DEC-057`).
 */
export async function getProjectAnalyticsService(
  actor: AuthContext,
  projectId: string,
  rawQuery: Record<string, unknown> = {},
  referenceNow: Date = new Date()
): Promise<ProjectAnalyticsDTO> {
  assertPermission(actor, PERMISSIONS.REPORT_READ);
  const validProjectId = parseProjectId(projectId);

  const parsedQuery = analyticsQuerySchema.safeParse(rawQuery);
  if (!parsedQuery.success) {
    throw badRequestError(
      "Tham số khoảng thời gian phân tích không hợp lệ.",
      parsedQuery.error.issues.map((issue) => ({
        field: issue.path.join(".") || "query",
        message: issue.message,
      }))
    );
  }

  await assertProjectReadAccess(actor, validProjectId);
  const originMeta = await projectAnalyticsRepository.findProjectOriginMeta(validProjectId);
  if (!originMeta) {
    throw notFoundError("Không tìm thấy Project yêu cầu.");
  }

  const window = resolveAnalyticsDateWindow(
    parsedQuery.data,
    {
      startDate: originMeta.project.startDate,
      createdAt: originMeta.project.createdAt,
      earliestTaskCreatedAt: originMeta.earliestTaskCreatedAt,
    },
    referenceNow
  );

  const source = await projectAnalyticsRepository.loadProjectAnalyticsSource({
    project: originMeta.project,
    earliestTaskCreatedAt: originMeta.earliestTaskCreatedAt,
    fromUtc: window.fromUtc,
    toUtc: window.toUtc,
    granularity: window.granularity,
    referenceNow,
  });

  return computeProjectAnalytics(source, window, referenceNow);
}
