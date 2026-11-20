import "server-only";
import { SprintStatus, TaskStatus, type Prisma } from "@prisma/client";
import { notFoundError } from "@/lib/errors";
import { formatPgDateYmd } from "@/lib/timezone";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { assertPermission } from "@/modules/authorization/policy.service";
import { assertProjectReadAccess, parseProjectId } from "@/modules/projects/project.access";
import {
  groupAndSortEstimateEvents,
  normalizeEstimateHours,
  resolveTaskEstimateAt,
  type EstimateHistoryEventLike,
  type EstimateSnapshotMode,
} from "@/modules/sprints/estimate-reconstruction";
import {
  sprintReportRepository,
  type SprintReportSourceData,
} from "@/modules/reports/sprint-report.repository";
import type { AuthContext } from "@/types/auth";

export interface SprintMetricBucketDTO {
  taskCount: number;
  estimateHours: number;
}

export interface SprintScopeEventBucketDTO extends SprintMetricBucketDTO {
  eventCount: number;
}

export type ReconstructionConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface SprintReportItemDTO {
  sprintId: string;
  name: string;
  goal: string | null;
  status: SprintStatus | string;
  startDate: string;
  endDate: string;
  activatedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  isBaselineAvailable: boolean;
  plannedTaskCount: number;
  plannedEstimateHours: number;
  baselineCommitment: SprintMetricBucketDTO;
  scopeAdded: SprintScopeEventBucketDTO;
  scopeRemoved: SprintScopeEventBucketDTO;
  completedTasks: SprintMetricBucketDTO & {
    completionRatePercent: number;
  };
  rolledOverToBacklog: SprintMetricBucketDTO;
  rolledOverToSprint: SprintMetricBucketDTO;
  finalScopeTaskCount: number;
  finalScopeEstimateHours: number;
  estimateDeltaHours: number;
  estimateCoveragePercent: number;
  estimateSnapshotMode: EstimateSnapshotMode;
  reconstructionConfidence: ReconstructionConfidence;
  hasPostSprintEstimateEdits: boolean;
  limitations: string[];
}

export interface ProjectSprintReportDTO {
  projectId: string;
  projectName: string;
  projectStatus: string;
  isReadOnly: boolean;
  timezone: "Asia/Ho_Chi_Minh";
  totalSprints: number;
  completedSprints: number;
  averageCompletionRatePercent: number;
  totalRolledOverTasks: number;
  sprints: SprintReportItemDTO[];
  notes: string[];
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return Math.round((numerator / denominator) * 1000) / 10;
}

function readJsonRecord(
  value: Prisma.JsonValue | null | undefined
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readSprintIdFromValue(value: Prisma.JsonValue | null): string | null | undefined {
  const rec = readJsonRecord(value);
  if (!rec || !Object.prototype.hasOwnProperty.call(rec, "sprintId")) {
    return undefined;
  }
  const raw = rec.sprintId;
  if (raw === null) return null;
  return typeof raw === "string" ? raw : undefined;
}

function wasTaskInSprintAt(
  task: SprintReportSourceData["tasks"][number],
  eventsAsc: SprintReportSourceData["sprintHistoryEvents"],
  sprintId: string,
  atTime: Date
): boolean {
  if (task.createdAt.getTime() > atTime.getTime()) {
    return false;
  }

  const pastEvents = eventsAsc.filter((e) => e.createdAt.getTime() <= atTime.getTime());
  if (pastEvents.length > 0) {
    let inSprint = false;
    const firstOld = readSprintIdFromValue(pastEvents[0].oldValue);
    if (firstOld === sprintId) {
      inSprint = true;
    }
    for (const ev of pastEvents) {
      const oldSprint = readSprintIdFromValue(ev.oldValue);
      const newSprint = readSprintIdFromValue(ev.newValue);
      if (newSprint === sprintId) {
        inSprint = true;
      } else if (oldSprint === sprintId) {
        inSprint = false;
      }
    }
    return inSprint;
  }

  const firstFuture = eventsAsc[0];
  if (firstFuture) {
    return readSprintIdFromValue(firstFuture.oldValue) === sprintId;
  }

  return task.sprintId === sprintId;
}

function extractActivationSnapshot(
  logs: SprintReportSourceData["activationLogs"],
  sprintId: string
): {
  activatedAtFallback: Date | null;
  baselineTaskIds: Set<string> | null;
  baselineEstimateMap: Map<string, number | null>;
  hasExplicitBaseline: boolean;
} {
  const matching = logs.filter((log) => log.entityId === sprintId);
  const latest = matching[matching.length - 1];
  if (!latest) {
    return {
      activatedAtFallback: null,
      baselineTaskIds: null,
      baselineEstimateMap: new Map(),
      hasExplicitBaseline: false,
    };
  }

  const meta = readJsonRecord(latest.metadata);
  const baselineEstimateMap = new Map<string, number | null>();
  let baselineTaskIds: Set<string> | null = null;

  if (meta && Array.isArray(meta.baselineTasks)) {
    baselineTaskIds = new Set<string>();
    for (const item of meta.baselineTasks) {
      if (
        typeof item === "object" &&
        item !== null &&
        typeof (item as { taskId?: unknown }).taskId === "string"
      ) {
        const entry = item as { taskId: string; estimateHours?: unknown };
        baselineTaskIds.add(entry.taskId);
        baselineEstimateMap.set(entry.taskId, normalizeEstimateHours(entry.estimateHours));
      }
    }
  } else if (meta && Array.isArray(meta.baselineTaskIds)) {
    baselineTaskIds = new Set<string>();
    for (const id of meta.baselineTaskIds) {
      if (typeof id === "string") {
        baselineTaskIds.add(id);
      }
    }
  }

  return {
    activatedAtFallback: latest.createdAt,
    baselineTaskIds,
    baselineEstimateMap,
    hasExplicitBaseline: baselineTaskIds !== null,
  };
}

function isClosureDispositionEvent(
  event: SprintReportSourceData["sprintHistoryEvents"][number],
  closureAt: Date | null
): boolean {
  const meta = readJsonRecord(event.metadata);
  const source = meta?.source;
  if (source === "SPRINT_COMPLETION" || source === "SPRINT_CANCELLED") {
    return true;
  }
  if (
    source === undefined &&
    closureAt !== null &&
    Math.abs(event.createdAt.getTime() - closureAt.getTime()) <= 5000
  ) {
    return true;
  }
  return false;
}

/**
 * Pure computation reconstructing the 6 Sprint commitment/scope/rollover metrics
 * plus historical estimateHours resolution (`DEC-058`, `P0-01`) without any snapshot table.
 */
export function computeProjectSprintReport(
  source: SprintReportSourceData,
  referenceNow: Date = new Date()
): ProjectSprintReportDTO {
  const taskById = new Map(source.tasks.map((task) => [task.id, task]));
  const eventsByTask = new Map<string, SprintReportSourceData["sprintHistoryEvents"]>();
  for (const event of source.sprintHistoryEvents) {
    let list = eventsByTask.get(event.taskId);
    if (!list) {
      list = [];
      eventsByTask.set(event.taskId, list);
    }
    list.push(event);
  }

  const estimateEventsByTask: Map<string, EstimateHistoryEventLike[]> = groupAndSortEstimateEvents(
    source.estimateHistoryEvents
  );

  const items: SprintReportItemDTO[] = source.sprints.map((sprint) => {
    const activationInfo = extractActivationSnapshot(source.activationLogs, sprint.id);
    const effectiveActivatedAt = sprint.activatedAt ?? activationInfo.activatedAtFallback;
    const closureAt =
      sprint.status === SprintStatus.COMPLETED
        ? sprint.completedAt
        : sprint.status === SprintStatus.CANCELLED
          ? sprint.cancelledAt
          : null;
    const evaluationEnd = closureAt ?? referenceNow;

    const currentTasksInSprint = source.tasks.filter((task) => task.sprintId === sprint.id);

    // Unstarted PLANNED Sprint has no baseline commitment locked yet.
    if (sprint.status === SprintStatus.PLANNED && effectiveActivatedAt === null) {
      const plannedEstimateHours = roundHours(
        currentTasksInSprint.reduce((sum, task) => sum + (task.estimateHours ?? 0), 0)
      );
      const estimatedPlanned = currentTasksInSprint.filter(
        (task) => task.estimateHours !== null && task.estimateHours > 0
      ).length;

      return {
        sprintId: sprint.id,
        name: sprint.name,
        goal: sprint.goal,
        status: sprint.status,
        startDate: formatPgDateYmd(sprint.startDate),
        endDate: formatPgDateYmd(sprint.endDate),
        activatedAt: null,
        completedAt: null,
        cancelledAt: null,
        isBaselineAvailable: false,
        plannedTaskCount: currentTasksInSprint.length,
        plannedEstimateHours,
        baselineCommitment: { taskCount: 0, estimateHours: 0 },
        scopeAdded: { taskCount: 0, eventCount: 0, estimateHours: 0 },
        scopeRemoved: { taskCount: 0, eventCount: 0, estimateHours: 0 },
        completedTasks: { taskCount: 0, estimateHours: 0, completionRatePercent: 0 },
        rolledOverToBacklog: { taskCount: 0, estimateHours: 0 },
        rolledOverToSprint: { taskCount: 0, estimateHours: 0 },
        finalScopeTaskCount: currentTasksInSprint.length,
        finalScopeEstimateHours: plannedEstimateHours,
        estimateDeltaHours: 0,
        estimateCoveragePercent: roundPercent(estimatedPlanned, currentTasksInSprint.length),
        estimateSnapshotMode: "RECONSTRUCTED_FROM_HISTORY",
        reconstructionConfidence: "MEDIUM",
        hasPostSprintEstimateEdits: false,
        limitations: [
          "Sprint đang ở trạng thái PLANNED (chưa kích hoạt), chưa khóa Baseline Commitment.",
        ],
      };
    }

    // Determine Baseline Commitment tasks at `effectiveActivatedAt` (if ever activated).
    const baselineTaskSet = new Set<string>();
    if (effectiveActivatedAt !== null) {
      if (activationInfo.baselineTaskIds) {
        for (const tid of activationInfo.baselineTaskIds) {
          if (taskById.has(tid)) {
            baselineTaskSet.add(tid);
          }
        }
      } else {
        for (const task of source.tasks) {
          const evs = eventsByTask.get(task.id) ?? [];
          if (wasTaskInSprintAt(task, evs, sprint.id, effectiveActivatedAt)) {
            baselineTaskSet.add(task.id);
          }
        }
      }
    }

    let baselineHours = 0;
    let hasIncompleteHistory = false;
    let hasPostSprintEstimateEdits = false;
    let usedSnapshot = activationInfo.hasExplicitBaseline;
    const participatingTaskIds = new Set<string>(baselineTaskSet);

    if (effectiveActivatedAt !== null) {
      for (const taskId of baselineTaskSet) {
        const task = taskById.get(taskId);
        if (!task) continue;
        const explicitEst = activationInfo.baselineEstimateMap.has(taskId)
          ? activationInfo.baselineEstimateMap.get(taskId)
          : undefined;
        const resolved = resolveTaskEstimateAt(
          task,
          estimateEventsByTask.get(taskId) ?? [],
          effectiveActivatedAt,
          explicitEst,
          closureAt
        );
        if (!resolved.isExact) hasIncompleteHistory = true;
        if (resolved.hasPostFreezeEstimateEdit) hasPostSprintEstimateEdits = true;
        if (resolved.estimateHours !== null) {
          baselineHours += resolved.estimateHours;
        }
      }
    }

    // Track Scope Added / Scope Removed (mid-sprint) and Closure Rollovers.
    const addedTaskIds = new Set<string>();
    let addedEventCount = 0;
    let addedHours = 0;

    const removedTaskIds = new Set<string>();
    let removedEventCount = 0;
    let removedHours = 0;

    const rolloverBacklogTaskIds = new Set<string>();
    let rolloverBacklogHours = 0;

    const rolloverSprintTaskIds = new Set<string>();
    let rolloverSprintHours = 0;

    for (const event of source.sprintHistoryEvents) {
      const oldSprint = readSprintIdFromValue(event.oldValue);
      const newSprint = readSprintIdFromValue(event.newValue);
      if (oldSprint !== sprint.id && newSprint !== sprint.id) {
        continue;
      }

      const task = taskById.get(event.taskId);
      if (!task) continue;

      const meta = readJsonRecord(event.metadata);
      const metaEst =
        meta && Object.prototype.hasOwnProperty.call(meta, "estimateHoursSnapshot")
          ? normalizeEstimateHours(meta.estimateHoursSnapshot)
          : undefined;
      if (metaEst !== undefined) {
        usedSnapshot = true;
      }

      const evMs = event.createdAt.getTime();
      const afterActivation =
        effectiveActivatedAt === null ? true : evMs > effectiveActivatedAt.getTime();
      const beforeOrAtClosure = closureAt === null ? true : evMs <= closureAt.getTime() + 5000;

      const resolveEventHours = () => {
        const evalTime = closureAt && evMs > closureAt.getTime() ? closureAt : event.createdAt;
        const resolved = resolveTaskEstimateAt(
          task,
          estimateEventsByTask.get(task.id) ?? [],
          evalTime,
          metaEst,
          closureAt
        );
        if (!resolved.isExact) hasIncompleteHistory = true;
        if (resolved.hasPostFreezeEstimateEdit) hasPostSprintEstimateEdits = true;
        return resolved.estimateHours ?? 0;
      };

      // Check closure rollover out of this Sprint.
      if (
        oldSprint === sprint.id &&
        newSprint !== sprint.id &&
        isClosureDispositionEvent(event, closureAt)
      ) {
        participatingTaskIds.add(task.id);
        const hrs = resolveEventHours();
        if (newSprint === null) {
          if (!rolloverBacklogTaskIds.has(task.id)) {
            rolloverBacklogTaskIds.add(task.id);
            rolloverBacklogHours += hrs;
          }
        } else {
          if (!rolloverSprintTaskIds.has(task.id)) {
            rolloverSprintTaskIds.add(task.id);
            rolloverSprintHours += hrs;
          }
        }
        continue;
      }

      // Mid-sprint scope changes occur only after activation and before closure.
      if (effectiveActivatedAt !== null && afterActivation && beforeOrAtClosure) {
        if (newSprint === sprint.id && oldSprint !== sprint.id) {
          participatingTaskIds.add(task.id);
          addedTaskIds.add(task.id);
          addedEventCount += 1;
          addedHours += resolveEventHours();
        } else if (oldSprint === sprint.id && newSprint !== sprint.id) {
          participatingTaskIds.add(task.id);
          removedTaskIds.add(task.id);
          removedEventCount += 1;
          removedHours += resolveEventHours();
        }
      }
    }

    // Completed Tasks inside Sprint at closure / evaluationEnd.
    const completedTaskIds = new Set<string>();
    let completedHours = 0;

    // Final scope just prior to rollover (union of completed + active + rolled over tasks still remaining at evaluationEnd).
    const finalScopeTaskIds = new Set<string>();
    let finalScopeHours = 0;
    let estimatedFinalCount = 0;

    for (const task of source.tasks) {
      const inCurrentSprint = task.sprintId === sprint.id;
      const rolledOutAtClosure =
        rolloverBacklogTaskIds.has(task.id) || rolloverSprintTaskIds.has(task.id);
      const isFinalMember = inCurrentSprint || rolledOutAtClosure;
      if (!isFinalMember) {
        continue;
      }

      participatingTaskIds.add(task.id);
      finalScopeTaskIds.add(task.id);

      const resolved = resolveTaskEstimateAt(
        task,
        estimateEventsByTask.get(task.id) ?? [],
        evaluationEnd,
        undefined,
        closureAt
      );
      if (!resolved.isExact) hasIncompleteHistory = true;
      if (resolved.hasPostFreezeEstimateEdit) hasPostSprintEstimateEdits = true;

      if (resolved.estimateHours !== null && resolved.estimateHours > 0) {
        estimatedFinalCount += 1;
        finalScopeHours += resolved.estimateHours;
      }

      const wasDoneInSprint =
        inCurrentSprint &&
        task.status === TaskStatus.DONE &&
        (closureAt === null ||
          task.completedAt === null ||
          task.completedAt.getTime() <= closureAt.getTime());

      if (wasDoneInSprint) {
        completedTaskIds.add(task.id);
        if (resolved.estimateHours !== null && resolved.estimateHours > 0) {
          completedHours += resolved.estimateHours;
        }
      }
    }

    const totalScopeDenominator =
      finalScopeTaskIds.size > 0
        ? finalScopeTaskIds.size
        : baselineTaskSet.size + addedTaskIds.size;
    const completionRatePercent = roundPercent(completedTaskIds.size, totalScopeDenominator);
    const estimateCoveragePercent = roundPercent(estimatedFinalCount, finalScopeTaskIds.size);
    const estimateDeltaHours = roundHours(finalScopeHours - baselineHours);

    const estimateSnapshotMode: EstimateSnapshotMode = hasIncompleteHistory
      ? "INCOMPLETE_HISTORY"
      : usedSnapshot
        ? "SNAPSHOT_METADATA"
        : "RECONSTRUCTED_FROM_HISTORY";

    let reconstructionConfidence: ReconstructionConfidence = "HIGH";
    if (hasIncompleteHistory || effectiveActivatedAt === null) {
      reconstructionConfidence = "LOW";
    } else if (!activationInfo.hasExplicitBaseline) {
      reconstructionConfidence = "MEDIUM";
    }

    const limitations: string[] = [];
    if (!activationInfo.hasExplicitBaseline && effectiveActivatedAt !== null) {
      limitations.push(
        "Sprint kích hoạt trước khi có baseline snapshot metadata; Baseline được tái dựng từ TaskHistory."
      );
    }
    if (hasIncompleteHistory) {
      limitations.push(
        "Một số Task có chuỗi lịch sử chỉnh Estimate Hours chưa liên tục (INCOMPLETE_HISTORY)."
      );
    }
    if (hasPostSprintEstimateEdits) {
      limitations.push(
        "Có Task được chỉnh Estimate Hours sau khi Sprint đã đóng; báo cáo giữ nguyên giá trị đóng băng tại thời điểm đóng Sprint."
      );
    }

    return {
      sprintId: sprint.id,
      name: sprint.name,
      goal: sprint.goal,
      status: sprint.status,
      startDate: formatPgDateYmd(sprint.startDate),
      endDate: formatPgDateYmd(sprint.endDate),
      activatedAt: effectiveActivatedAt ? effectiveActivatedAt.toISOString() : null,
      completedAt: sprint.completedAt ? sprint.completedAt.toISOString() : null,
      cancelledAt: sprint.cancelledAt ? sprint.cancelledAt.toISOString() : null,
      isBaselineAvailable: effectiveActivatedAt !== null,
      plannedTaskCount: currentTasksInSprint.length,
      plannedEstimateHours: roundHours(
        currentTasksInSprint.reduce((sum, task) => sum + (task.estimateHours ?? 0), 0)
      ),
      baselineCommitment: {
        taskCount: baselineTaskSet.size,
        estimateHours: roundHours(baselineHours),
      },
      scopeAdded: {
        taskCount: addedTaskIds.size,
        eventCount: addedEventCount,
        estimateHours: roundHours(addedHours),
      },
      scopeRemoved: {
        taskCount: removedTaskIds.size,
        eventCount: removedEventCount,
        estimateHours: roundHours(removedHours),
      },
      completedTasks: {
        taskCount: completedTaskIds.size,
        estimateHours: roundHours(completedHours),
        completionRatePercent,
      },
      rolledOverToBacklog: {
        taskCount: rolloverBacklogTaskIds.size,
        estimateHours: roundHours(rolloverBacklogHours),
      },
      rolledOverToSprint: {
        taskCount: rolloverSprintTaskIds.size,
        estimateHours: roundHours(rolloverSprintHours),
      },
      finalScopeTaskCount: finalScopeTaskIds.size,
      finalScopeEstimateHours: roundHours(finalScopeHours),
      estimateDeltaHours,
      estimateCoveragePercent,
      estimateSnapshotMode,
      reconstructionConfidence,
      hasPostSprintEstimateEdits,
      limitations,
    };
  });

  const closedOrActiveWithBaseline = items.filter(
    (s) =>
      s.status === SprintStatus.COMPLETED || (s.isBaselineAvailable && s.finalScopeTaskCount > 0)
  );
  const completedOnly = items.filter((s) => s.status === SprintStatus.COMPLETED);
  const avgRateSource = completedOnly.length > 0 ? completedOnly : closedOrActiveWithBaseline;
  const averageCompletionRatePercent =
    avgRateSource.length === 0
      ? 0
      : roundHours(
          avgRateSource.reduce((sum, s) => sum + s.completedTasks.completionRatePercent, 0) /
            avgRateSource.length
        );

  const totalRolledOverTasks = items.reduce(
    (sum, s) => sum + s.rolledOverToBacklog.taskCount + s.rolledOverToSprint.taskCount,
    0
  );

  return {
    projectId: source.project.id,
    projectName: source.project.name,
    projectStatus: source.project.status,
    isReadOnly: source.project.status === "ARCHIVED",
    timezone: "Asia/Ho_Chi_Minh",
    totalSprints: items.length,
    completedSprints: completedOnly.length,
    averageCompletionRatePercent,
    totalRolledOverTasks,
    sprints: items,
    notes: [
      "Tỷ lệ hoàn thành Sprint luôn tính theo số Task DONE / Tổng số Task phạm vi cuối Sprint, tách biệt với Planned Estimate Hours.",
      "Dữ liệu Commitment và Rollover được tái dựng xác định từ TaskHistory và ActivityLog, không sử dụng bảng snapshot.",
      "Các chỉnh sửa Estimate Hours sau khi Sprint đã đóng không làm sai lệch số liệu lịch sử của Sprint đó.",
    ],
  };
}

/**
 * Loads and computes Project Sprint Analytics & 6-metric commitment/rollover report (`DEC-058`).
 */
export async function getProjectSprintReportService(
  actor: AuthContext,
  projectId: string
): Promise<ProjectSprintReportDTO> {
  assertPermission(actor, PERMISSIONS.REPORT_READ);
  const validProjectId = parseProjectId(projectId);
  await assertProjectReadAccess(actor, validProjectId);

  const source = await sprintReportRepository.findProjectSprintReportSource(validProjectId);
  if (!source) {
    throw notFoundError("Không tìm thấy Project yêu cầu.");
  }

  return computeProjectSprintReport(source, new Date());
}
