import "server-only";
import { SprintStatus, TaskHistoryAction, TaskStatus, type Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { assertPermission } from "@/modules/authorization/policy.service";
import { assertSprintReadAccess, parseSprintId } from "@/modules/sprints/sprint.access";
import {
  computeSprintTaskStats,
  sprintRepository,
  type SprintTaskStatsDTO,
} from "@/modules/sprints/sprint.repository";
import { formatSprintDateYmd } from "@/modules/sprints/sprint.schema";
import type { AuthContext } from "@/types/auth";

export const BURNDOWN_TIMEZONE = "Asia/Ho_Chi_Minh";
const HCM_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
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
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

export function toHcmYmd(date: Date): string {
  return new Date(date.getTime() + HCM_OFFSET_MS).toISOString().slice(0, 10);
}

export function hcmEndOfDay(ymd: string): Date {
  return new Date(`${ymd}T23:59:59.999+07:00`);
}

function enumerateYmdRange(startYmd: string, endYmd: string): string[] {
  const startMs = Date.parse(`${startYmd}T00:00:00.000Z`);
  const endMs = Date.parse(`${endYmd}T00:00:00.000Z`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
    return [startYmd];
  }

  const days: string[] = [];
  for (let ms = startMs; ms <= endMs && days.length < MAX_BURNDOWN_DAYS; ms += DAY_MS) {
    days.push(new Date(ms).toISOString().slice(0, 10));
  }
  return days;
}

function readJsonSprintId(value: Prisma.JsonValue | null): string | null | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = (value as Record<string, unknown>).sprintId;
  if (raw === null) return null;
  if (typeof raw === "string") return raw;
  return undefined;
}

function isTaskInSprintAt(
  task: BurndownSourceTask,
  events: ReadonlyArray<BurndownSourceEvent>,
  sprintId: string,
  atTime: Date
): boolean {
  if (task.createdAt.getTime() > atTime.getTime()) {
    return false;
  }

  const pastEvents = events.filter((e) => e.createdAt.getTime() <= atTime.getTime());
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

  const firstFutureEvent = events[0];
  if (firstFutureEvent) {
    return readJsonSprintId(firstFutureEvent.oldValue) === sprintId;
  }

  return task.sprintId === sprintId;
}

const BURNDOWN_LIMITATIONS = [
  "Tái dựng từ estimateHours hiện tại của từng Task kết hợp TaskHistory (SPRINT_ASSIGNED / SPRINT_REMOVED / SPRINT_MOVED) và completedAt.",
  "Hệ thống MVP không lưu snapshot estimateHours theo từng ngày; khi chỉnh estimateHours giữa chừng, đường Burndown phản ánh estimate hiện tại.",
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

  const tasksWithEstimate = tasks.filter(
    (task) =>
      typeof task.estimateHours === "number" &&
      Number.isFinite(task.estimateHours) &&
      task.estimateHours > 0
  );
  const hasEstimateData = progress.totalEstimateHours > 0 || tasksWithEstimate.length > 0;

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
        points: [],
      },
    };
  }

  const eventsByTask = new Map<string, BurndownSourceEvent[]>();
  for (const event of historyEvents) {
    const list = eventsByTask.get(event.taskId) ?? [];
    list.push(event);
    eventsByTask.set(event.taskId, list);
  }

  const days = enumerateYmdRange(startYmd, endYmd);
  const totalDaySteps = Math.max(days.length - 1, 0);
  const todayHcmYmd = toHcmYmd(referenceNow);

  let effectiveActualCutoffYmd = todayHcmYmd;
  if (sprint.status === SprintStatus.COMPLETED && sprint.completedAt) {
    const completedYmd = toHcmYmd(sprint.completedAt);
    if (completedYmd < effectiveActualCutoffYmd) {
      effectiveActualCutoffYmd = completedYmd;
    }
  } else if (sprint.status === SprintStatus.CANCELLED && sprint.cancelledAt) {
    const cancelledYmd = toHcmYmd(sprint.cancelledAt);
    if (cancelledYmd < effectiveActualCutoffYmd) {
      effectiveActualCutoffYmd = cancelledYmd;
    }
  }

  const scopePerDay = days.map((ymd) => {
    const endOfDay = hcmEndOfDay(ymd);
    let scope = 0;
    let remaining = 0;

    for (const task of tasksWithEstimate) {
      const hours = task.estimateHours ?? 0;
      const taskEvents = eventsByTask.get(task.id) ?? [];
      if (!isTaskInSprintAt(task, taskEvents, sprint.id, endOfDay)) {
        continue;
      }

      scope += hours;

      const wasCompletedByEndOfDay =
        task.status === TaskStatus.DONE &&
        task.completedAt !== null &&
        task.completedAt.getTime() <= endOfDay.getTime();

      if (!wasCompletedByEndOfDay) {
        remaining += hours;
      }
    }

    return {
      ymd,
      scopeHours: roundHours(scope),
      remainingHours: roundHours(remaining),
    };
  });

  const dayZeroScope = scopePerDay[0]?.scopeHours ?? 0;
  const peakScope = Math.max(
    dayZeroScope,
    progress.totalEstimateHours,
    ...scopePerDay.map((d) => d.scopeHours)
  );
  const baselineHours = roundHours(dayZeroScope > 0 ? dayZeroScope : peakScope);

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
      completedEstimateHours: progress.completedEstimateHours,
      remainingEstimateHours: progress.remainingEstimateHours,
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
