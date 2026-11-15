import "server-only";
import { SprintStatus, TaskHistoryAction, TaskStatus, type Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import {
  BUSINESS_TIMEZONE as BURNDOWN_TIMEZONE,
  enumerateHcmDays,
  formatHcmYmd as toHcmYmd,
  hcmEndOfDay,
} from "@/lib/timezone";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { assertPermission } from "@/modules/authorization/policy.service";
import { assertSprintReadAccess, parseSprintId } from "@/modules/sprints/sprint.access";
import {
  computeSprintTaskStats,
  sprintRepository,
  type SprintTaskStatsDTO,
} from "@/modules/sprints/sprint.repository";
import {
  groupAndSortEstimateEvents,
  normalizeEstimateHours,
  resolveTaskEstimateAt,
  type EstimateHistoryEventLike,
  type EstimateSnapshotMode,
} from "@/modules/sprints/estimate-reconstruction";
import { formatSprintDateYmd } from "@/modules/sprints/sprint.schema";
import type { AuthContext } from "@/types/auth";

export { BURNDOWN_TIMEZONE, hcmEndOfDay, toHcmYmd };
const MAX_BURNDOWN_DAYS = 180;

export interface BurndownPointDTO {
  date: string; // YYYY-MM-DD in Asia/Ho_Chi_Minh
  dayIndex: number;
  idealRemainingHours: number;
  actualRemainingHours: number | null;
  scopeHours: number;
}

export interface SprintBurndownDTO {
  hasEstimateData: boolean;
  timezone: typeof BURNDOWN_TIMEZONE;
  insufficientDataMessage: string | null;
  limitations: string[];
  baselineHours: number;
  currentScopeHours: number;
  completedEstimateHours: number;
  remainingEstimateHours: number;
  closureScopeHours?: number;
  estimateCoveragePercent?: number;
  estimateSnapshotMode?: EstimateSnapshotMode;
  hasPostSprintEstimateEdits?: boolean;
  points: BurndownPointDTO[];
}

export interface SprintAnalyticsDTO {
  sprintId: string;
  sprintName: string;
  sprintStatus: SprintStatus;
  startDate: string;
  endDate: string;
  progress: SprintTaskStatsDTO;
  burndown: SprintBurndownDTO;
}

export interface BurndownSourceTask {
  id: string;
  title: string;
  status: TaskStatus;
  sprintId: string | null;
  deadline: Date;
  estimateHours: number | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface BurndownSourceEvent {
  id: string;
  taskId: string;
  action: TaskHistoryAction;
  oldValue: Prisma.JsonValue | null;
  newValue: Prisma.JsonValue | null;
  metadata?: Prisma.JsonValue | null;
  createdAt: Date;
}

export interface BurndownSourceData {
  sprint: {
    id: string;
    projectId: string;
    name: string;
    startDate: Date;
    endDate: Date;
    status: SprintStatus;
    activatedAt: Date | null;
    completedAt: Date | null;
    cancelledAt: Date | null;
    createdAt: Date;
  };
  tasks: BurndownSourceTask[];
  historyEvents: BurndownSourceEvent[];
  estimateHistoryEvents?: EstimateHistoryEventLike[];
  activationBaselineTasks?: Array<{ taskId: string; estimateHours: number | null }>;
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

function enumerateYmdRange(startYmd: string, endYmd: string): string[] {
  return enumerateHcmDays(startYmd, endYmd, MAX_BURNDOWN_DAYS);
}

function readJsonSprintId(value: Prisma.JsonValue | null): string | null | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = (value as Record<string, unknown>).sprintId;
  if (raw === null) return null;
  if (typeof raw === "string") return raw;
  return undefined;
}

function isClosureDispositionForSprint(event: BurndownSourceEvent, sprintId: string): boolean {
  if (readJsonSprintId(event.oldValue) !== sprintId) {
    return false;
  }
  if (!event.metadata || typeof event.metadata !== "object" || Array.isArray(event.metadata)) {
    return false;
  }
  const source = (event.metadata as Record<string, unknown>).source;
  return source === "SPRINT_COMPLETION" || source === "SPRINT_CANCELLED";
}

function isTaskInSprintAt(
  task: BurndownSourceTask,
  events: ReadonlyArray<BurndownSourceEvent>,
  sprintId: string,
  atTime: Date,
  ignoreClosureDispositions: boolean = false
): boolean {
  if (task.createdAt.getTime() > atTime.getTime()) {
    return false;
  }

  const effectiveEvents = ignoreClosureDispositions
    ? events.filter((e) => !isClosureDispositionForSprint(e, sprintId))
    : events;

  const pastEvents = effectiveEvents.filter((e) => e.createdAt.getTime() <= atTime.getTime());
  if (pastEvents.length > 0) {
    let inSprint = false;
    const firstPastOldSprint = readJsonSprintId(pastEvents[0].oldValue);
    if (firstPastOldSprint === sprintId) {
      inSprint = true;
    }
    for (const event of pastEvents) {
      const oldSprintId = readJsonSprintId(event.oldValue);
      const newSprintId = readJsonSprintId(event.newValue);
      if (newSprintId === sprintId) {
        inSprint = true;
      } else if (oldSprintId === sprintId) {
        inSprint = false;
      }
    }
    return inSprint;
  }

  const firstFutureOrClosureEvent = effectiveEvents[0] ?? events[0];
  if (firstFutureOrClosureEvent) {
    return readJsonSprintId(firstFutureOrClosureEvent.oldValue) === sprintId;
  }

  return task.sprintId === sprintId;
}

const BURNDOWN_LIMITATIONS = [
  "Tái dựng phạm vi Sprint theo ngày từ TaskHistory (SPRINT_ASSIGNED / SPRINT_REMOVED / SPRINT_MOVED) và loại bỏ tác động rollover cuối kỳ ngay tại ngày đóng Sprint.",
  "Estimate Hours tại từng mốc thời gian được tái dựng lùi từ TaskHistory (INFO_UPDATED) và snapshot khi kích hoạt/lập kế hoạch Sprint; chỉnh estimate sau khi Sprint đóng không làm sai lệch số liệu lịch sử.",
  "Mọi ranh giới ngày tính theo múi giờ Asia/Ho_Chi_Minh (+07:00).",
];

export function computeSprintBurndownAnalytics(
  source: BurndownSourceData,
  referenceNow: Date = new Date()
): SprintAnalyticsDTO {
  const { sprint, tasks, historyEvents } = source;
  const currentSprintTasks = tasks.filter((task) => task.sprintId === sprint.id);
  const progress = computeSprintTaskStats(currentSprintTasks, referenceNow);

  const startYmd = formatSprintDateYmd(sprint.startDate);
  const endYmd = formatSprintDateYmd(sprint.endDate);

  const eventsByTask = new Map<string, BurndownSourceEvent[]>();
  for (const event of historyEvents) {
    const list = eventsByTask.get(event.taskId) ?? [];
    list.push(event);
    eventsByTask.set(event.taskId, list);
  }

  const estimateEventsByTask = groupAndSortEstimateEvents(source.estimateHistoryEvents ?? []);
  const activationSnapshotByTask = new Map<string, number | null>();
  for (const item of source.activationBaselineTasks ?? []) {
    activationSnapshotByTask.set(item.taskId, normalizeEstimateHours(item.estimateHours));
  }

  const days = enumerateYmdRange(startYmd, endYmd);
  const totalDaySteps = Math.max(days.length - 1, 0);
  const todayHcmYmd = toHcmYmd(referenceNow);

  const closureAt =
    sprint.status === SprintStatus.COMPLETED
      ? sprint.completedAt
      : sprint.status === SprintStatus.CANCELLED
        ? sprint.cancelledAt
        : null;
  const closureYmd = closureAt ? toHcmYmd(closureAt) : null;
  const activatedYmd = sprint.activatedAt ? toHcmYmd(sprint.activatedAt) : null;

  let effectiveActualCutoffYmd = todayHcmYmd;
  if (closureYmd && closureYmd < effectiveActualCutoffYmd) {
    effectiveActualCutoffYmd = closureYmd;
  }

  let hasPostSprintEstimateEdits = false;
  let hasIncompleteHistory = false;
  let usedActivationSnapshot = false;

  const scopePerDay = days.map((ymd, dayIndex) => {
    const endOfDay = hcmEndOfDay(ymd);
    const estimateEvalTime =
      closureAt && endOfDay.getTime() > closureAt.getTime() ? closureAt : endOfDay;
    const ignoreClosureDispositions = closureYmd !== null && ymd <= closureYmd;

    let scope = 0;
    let remaining = 0;
    let memberTaskCount = 0;
    let estimatedMemberCount = 0;

    for (const task of tasks) {
      const taskEvents = eventsByTask.get(task.id) ?? [];
      if (!isTaskInSprintAt(task, taskEvents, sprint.id, endOfDay, ignoreClosureDispositions)) {
        continue;
      }

      memberTaskCount += 1;
      const taskEstEvents = estimateEventsByTask.get(task.id) ?? [];
      const canUseActivationFallback =
        dayIndex === 0 &&
        activatedYmd !== null &&
        ymd === activatedYmd &&
        activationSnapshotByTask.has(task.id);

      let resolved = resolveTaskEstimateAt(
        task,
        taskEstEvents,
        estimateEvalTime,
        undefined,
        closureAt
      );

      // Use activation snapshot only if diff history had a gap or activation occurred on Day 0 with no diff overwrite.
      if (!resolved.isExact && canUseActivationFallback) {
        resolved = resolveTaskEstimateAt(
          task,
          taskEstEvents,
          estimateEvalTime,
          activationSnapshotByTask.get(task.id),
          closureAt
        );
        usedActivationSnapshot = true;
      }

      if (!resolved.isExact) {
        hasIncompleteHistory = true;
      }
      if (resolved.hasPostFreezeEstimateEdit) {
        hasPostSprintEstimateEdits = true;
      }

      const hours = resolved.estimateHours;
      if (hours === null || !Number.isFinite(hours) || hours <= 0) {
        continue;
      }

      estimatedMemberCount += 1;
      scope += hours;

      const completionCutoff =
        closureAt && endOfDay.getTime() > closureAt.getTime() ? closureAt : endOfDay;
      const wasCompletedByEndOfDay =
        task.status === TaskStatus.DONE &&
        task.completedAt !== null &&
        task.completedAt.getTime() <= completionCutoff.getTime();

      if (!wasCompletedByEndOfDay) {
        remaining += hours;
      }
    }

    return {
      ymd,
      scopeHours: roundHours(scope),
      remainingHours: roundHours(remaining),
      memberTaskCount,
      estimatedMemberCount,
    };
  });

  const anyDayHasPositiveEstimate = scopePerDay.some((d) => d.scopeHours > 0);
  const hasEstimateData = progress.totalEstimateHours > 0 || anyDayHasPositiveEstimate;

  const estimateSnapshotMode: EstimateSnapshotMode = hasIncompleteHistory
    ? "INCOMPLETE_HISTORY"
    : usedActivationSnapshot
      ? "SNAPSHOT_METADATA"
      : "RECONSTRUCTED_FROM_HISTORY";

  const latestMeasuredDay =
    [...scopePerDay].reverse().find((d) => d.ymd <= effectiveActualCutoffYmd) ??
    scopePerDay[scopePerDay.length - 1];
  const estimateCoveragePercent =
    latestMeasuredDay && latestMeasuredDay.memberTaskCount > 0
      ? Math.round(
          (latestMeasuredDay.estimatedMemberCount / latestMeasuredDay.memberTaskCount) * 1000
        ) / 10
      : 0;

  if (!hasEstimateData) {
    return {
      sprintId: sprint.id,
      sprintName: sprint.name,
      sprintStatus: sprint.status,
      startDate: startYmd,
      endDate: endYmd,
      progress,
      burndown: {
        hasEstimateData: false,
        timezone: BURNDOWN_TIMEZONE,
        insufficientDataMessage:
          "Sprint chưa có Task nào khai báo Estimate Hours nên chưa đủ dữ liệu vẽ biểu đồ Burndown.",
        limitations: BURNDOWN_LIMITATIONS,
        baselineHours: 0,
        currentScopeHours: 0,
        completedEstimateHours: 0,
        remainingEstimateHours: 0,
        closureScopeHours: 0,
        estimateCoveragePercent,
        estimateSnapshotMode,
        hasPostSprintEstimateEdits,
        points: [],
      },
    };
  }

  const dayZeroScope = scopePerDay[0]?.scopeHours ?? 0;
  const peakScope = Math.max(
    dayZeroScope,
    progress.totalEstimateHours,
    ...scopePerDay.map((d) => d.scopeHours)
  );
  const baselineHours = roundHours(dayZeroScope > 0 ? dayZeroScope : peakScope);

  const closureScopeHours =
    closureAt && latestMeasuredDay ? latestMeasuredDay.scopeHours : progress.totalEstimateHours;
  const completedEstimateHours =
    closureAt && latestMeasuredDay
      ? roundHours(Math.max(0, latestMeasuredDay.scopeHours - latestMeasuredDay.remainingHours))
      : progress.completedEstimateHours;
  const remainingEstimateHours =
    closureAt && latestMeasuredDay
      ? latestMeasuredDay.remainingHours
      : progress.remainingEstimateHours;

  const points: BurndownPointDTO[] = scopePerDay.map((entry, dayIndex) => {
    const idealRemainingHours =
      totalDaySteps === 0
        ? 0
        : roundHours(Math.max(0, baselineHours * (1 - dayIndex / totalDaySteps)));

    const actualRemainingHours =
      sprint.status !== SprintStatus.PLANNED && entry.ymd <= effectiveActualCutoffYmd
        ? entry.remainingHours
        : null;

    return {
      date: entry.ymd,
      dayIndex,
      idealRemainingHours,
      actualRemainingHours,
      scopeHours: entry.scopeHours,
    };
  });

  return {
    sprintId: sprint.id,
    sprintName: sprint.name,
    sprintStatus: sprint.status,
    startDate: startYmd,
    endDate: endYmd,
    progress,
    burndown: {
      hasEstimateData: true,
      timezone: BURNDOWN_TIMEZONE,
      insufficientDataMessage: null,
      limitations: BURNDOWN_LIMITATIONS,
      baselineHours,
      currentScopeHours: progress.totalEstimateHours,
      completedEstimateHours,
      remainingEstimateHours,
      closureScopeHours,
      estimateCoveragePercent,
      estimateSnapshotMode,
      hasPostSprintEstimateEdits,
      points,
    },
  };
}

export async function getSprintProgressAndBurndownService(
  actor: AuthContext,
  sprintId: string
): Promise<SprintAnalyticsDTO> {
  assertPermission(actor, PERMISSIONS.SPRINT_READ);
  const validSprintId = parseSprintId(sprintId);

  await assertSprintReadAccess(actor, validSprintId);
  const source = await sprintRepository.findBurndownSourceData(validSprintId);
  if (!source) {
    throw new AppError({
      statusCode: 404,
      code: "SPRINT_NOT_FOUND",
      message: "Không tìm thấy Sprint yêu cầu.",
    });
  }

  return computeSprintBurndownAnalytics(source, new Date());
}
