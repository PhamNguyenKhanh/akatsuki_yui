import { addDaysToYmd, diffYmdDays, getHcmIsoWeekStartYmd, isValidYmd } from "@/lib/timezone";

export const SCHEDULE_RECURRENCE_SCOPES = ["THIS_WEEK", "THIS_AND_FUTURE", "ALL_SERIES"] as const;

export type ScheduleRecurrenceScope = (typeof SCHEDULE_RECURRENCE_SCOPES)[number];

export interface ScheduleTimeBlock {
  startMinute: number;
  endMinute: number;
  label: string;
  isNight: boolean;
}

/**
 * 12 two-hour blocks across the full 24h day (00:00-06:00 night + 06:00-24:00 default).
 */
export const SCHEDULE_TIME_BLOCKS: readonly ScheduleTimeBlock[] = Array.from(
  { length: 12 },
  (_, index) => {
    const startHour = index * 2;
    const endHour = startHour + 2;
    const pad = (h: number) => String(h).padStart(2, "0");
    return {
      startMinute: startHour * 60,
      endMinute: endHour * 60,
      label: `${pad(startHour)}:00 – ${pad(endHour)}:00`,
      isNight: startHour < 6,
    };
  }
);

export const WEEKDAY_LABELS_VI: Record<number, { short: string; full: string }> = {
  1: { short: "T2", full: "Thứ 2" },
  2: { short: "T3", full: "Thứ 3" },
  3: { short: "T4", full: "Thứ 4" },
  4: { short: "T5", full: "Thứ 5" },
  5: { short: "T6", full: "Thứ 6" },
  6: { short: "T7", full: "Thứ 7" },
  7: { short: "CN", full: "Chủ Nhật" },
};

export const START_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
export const END_TIME_PATTERN = /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/;

export function hhmmToMinutes(value: string): number {
  const [hourStr, minuteStr] = value.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  return hour * 60 + minute;
}

export function minutesToHhmm(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(1440, Math.trunc(totalMinutes)));
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Returns ISO weekday 1 (Monday) .. 7 (Sunday) for a YYYY-MM-DD calendar date.
 */
export function getIsoDayOfWeekFromYmd(ymd: string): number {
  if (!isValidYmd(ymd)) {
    throw new Error(`Invalid YYYY-MM-DD date: ${ymd}`);
  }
  const utcDay = new Date(`${ymd}T00:00:00.000Z`).getUTCDay();
  return utcDay === 0 ? 7 : utcDay;
}

export interface WeekDayColumn {
  date: string;
  dayOfWeek: number;
  shortLabel: string;
  fullLabel: string;
}

export function buildWeekDayColumns(weekStartYmd: string): WeekDayColumn[] {
  const normalizedMonday = getHcmIsoWeekStartYmd(weekStartYmd);
  return Array.from({ length: 7 }, (_, idx) => {
    const date = addDaysToYmd(normalizedMonday, idx);
    const dayOfWeek = idx + 1;
    const labels = WEEKDAY_LABELS_VI[dayOfWeek]!;
    return {
      date,
      dayOfWeek,
      shortLabel: labels.short,
      fullLabel: labels.full,
    };
  });
}

export function computeRepeatUntilFromWeeks(startDateYmd: string, repeatWeeks: number): string {
  const safeWeeks = Math.max(1, Math.trunc(repeatWeeks));
  return addDaysToYmd(startDateYmd, (safeWeeks - 1) * 7);
}

export function computeRepeatWeeksFromRange(startDateYmd: string, repeatUntilYmd: string): number {
  const deltaDays = diffYmdDays(startDateYmd, repeatUntilYmd);
  if (deltaDays < 0) return 1;
  return Math.floor(deltaDays / 7) + 1;
}

export interface ScheduleMemberOptionDTO {
  userId: string;
  fullName: string;
  email: string;
  projectRole: string;
}

export interface ScheduleOccurrenceDTO {
  entryId: string;
  projectId: string;
  userId: string;
  userFullName: string;
  userEmail: string;
  date: string;
  seriesStartDate: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  startTime: string;
  endTime: string;
  note: string | null;
  isRecurring: boolean;
  repeatUntil: string | null;
  repeatWeeks: number | null;
  isOverridden: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface ProjectWeeklyScheduleDTO {
  projectId: string;
  projectStartDate: string;
  projectEndDate: string;
  weekStart: string;
  weekEnd: string;
  todayYmd: string;
  nowIso: string;
  days: WeekDayColumn[];
  members: ScheduleMemberOptionDTO[];
  occurrences: ScheduleOccurrenceDTO[];
  capabilities: {
    canCreateOwn: boolean;
    canDeleteAny: boolean;
  };
}
