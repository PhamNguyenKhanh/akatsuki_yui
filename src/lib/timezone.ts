export const BUSINESS_TIMEZONE = "Asia/Ho_Chi_Minh" as const;
export const HCM_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Checks whether a string is a valid Gregorian calendar date in YYYY-MM-DD format.
 */
export function isValidYmd(ymd: string): boolean {
  if (!YMD_PATTERN.test(ymd)) {
    return false;
  }
  const timestamp = Date.parse(`${ymd}T00:00:00.000Z`);
  if (Number.isNaN(timestamp)) {
    return false;
  }
  return new Date(timestamp).toISOString().slice(0, 10) === ymd;
}

/**
 * Formats a UTC instant (PostgreSQL TIMESTAMP(3)) into a YYYY-MM-DD calendar date in Asia/Ho_Chi_Minh (+07:00).
 */
export function formatHcmYmd(date: Date = new Date()): string {
  return new Date(date.getTime() + HCM_UTC_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Alias preserved for Sprint 5 notification deadline service compatibility.
 */
export function formatDateKeyInHoChiMinh(date: Date = new Date()): string {
  return formatHcmYmd(date);
}

/**
 * Formats a PostgreSQL DATE column (Sprint.startDate / Sprint.endDate) as YYYY-MM-DD without timezone shifting.
 */
export function formatPgDateYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Extracts the YYYY-MM-DD business date for Project.startDate / Project.endDate.
 * Exact UTC midnight values emitted by `<input type="date">` / `z.coerce.date()` stay as their UTC date;
 * other instants convert to Asia/Ho_Chi_Minh.
 */
export function toProjectCalendarYmd(date: Date): string {
  const iso = date.toISOString();
  if (iso.endsWith("T00:00:00.000Z")) {
    return iso.slice(0, 10);
  }
  return formatHcmYmd(date);
}

/**
 * Formats an instant in DD/MM/YYYY HH:mm (Asia/Ho_Chi_Minh) for UI and notifications.
 */
export function formatHcmDateTimeVi(dateOrIso: Date | string): string {
  const date = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso;
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: BUSINESS_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Formats a YYYY-MM-DD date string or Date instant in DD/MM/YYYY (Asia/Ho_Chi_Minh).
 */
export function formatHcmDateVi(ymdOrDate: string | Date): string {
  const ymd = typeof ymdOrDate === "string" ? ymdOrDate : formatHcmYmd(ymdOrDate);
  if (!YMD_PATTERN.test(ymd)) {
    return ymd;
  }
  const [year, month, day] = ymd.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * Converts a YYYY-MM-DD calendar date into the UTC instant representing 00:00:00.000+07:00.
 */
export function hcmStartOfDay(ymd: string): Date {
  if (!isValidYmd(ymd)) {
    throw new Error(`Invalid YYYY-MM-DD calendar date: ${ymd}`);
  }
  return new Date(`${ymd}T00:00:00.000+07:00`);
}

/**
 * Converts a YYYY-MM-DD calendar date into the UTC instant representing 23:59:59.999+07:00.
 */
export function hcmEndOfDay(ymd: string): Date {
  if (!isValidYmd(ymd)) {
    throw new Error(`Invalid YYYY-MM-DD calendar date: ${ymd}`);
  }
  return new Date(`${ymd}T23:59:59.999+07:00`);
}

/**
 * Adds a signed integer number of calendar days to a YYYY-MM-DD date.
 */
export function addDaysToYmd(ymd: string, deltaDays: number): string {
  if (!isValidYmd(ymd)) {
    throw new Error(`Invalid YYYY-MM-DD calendar date: ${ymd}`);
  }
  const baseMs = Date.parse(`${ymd}T00:00:00.000Z`);
  return new Date(baseMs + deltaDays * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Computes signed whole-day delta (`toYmd - fromYmd`) between two YYYY-MM-DD calendar dates.
 */
export function diffYmdDays(fromYmd: string, toYmd: string): number {
  if (!isValidYmd(fromYmd) || !isValidYmd(toYmd)) {
    throw new Error(`Invalid YYYY-MM-DD range: ${fromYmd}..${toYmd}`);
  }
  const fromMs = Date.parse(`${fromYmd}T00:00:00.000Z`);
  const toMs = Date.parse(`${toYmd}T00:00:00.000Z`);
  return Math.round((toMs - fromMs) / DAY_MS);
}

/**
 * Parses inclusive Asia/Ho_Chi_Minh YYYY-MM-DD range bounds into UTC Date objects safe for indexed TIMESTAMP(3) queries.
 */
export function parseHcmDateBounds(
  fromYmd: string,
  toYmd: string
): { fromUtc: Date; toUtc: Date; inclusiveDays: number } {
  const delta = diffYmdDays(fromYmd, toYmd);
  if (delta < 0) {
    throw new Error(`Invalid date bounds: toYmd (${toYmd}) is earlier than fromYmd (${fromYmd}).`);
  }
  return {
    fromUtc: hcmStartOfDay(fromYmd),
    toUtc: hcmEndOfDay(toYmd),
    inclusiveDays: delta + 1,
  };
}

/**
 * Computes the ISO Monday YYYY-MM-DD week start in Asia/Ho_Chi_Minh, matching PostgreSQL
 * `date_trunc('week', (("col" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh'))::date`.
 */
export function getHcmIsoWeekStartYmd(ymdOrDate: string | Date): string {
  const ymd = typeof ymdOrDate === "string" ? ymdOrDate : formatHcmYmd(ymdOrDate);
  if (!isValidYmd(ymd)) {
    throw new Error(`Invalid YYYY-MM-DD calendar date: ${ymd}`);
  }
  const utcDay = new Date(`${ymd}T00:00:00.000Z`).getUTCDay();
  const daysSinceMonday = (utcDay + 6) % 7;
  return addDaysToYmd(ymd, -daysSinceMonday);
}

/**
 * Enumerates YYYY-MM-DD calendar dates inclusively between startYmd and endYmd.
 */
export function enumerateHcmDays(startYmd: string, endYmd: string, maxDays = 366): string[] {
  if (!isValidYmd(startYmd) || !isValidYmd(endYmd)) {
    return [];
  }
  const startMs = Date.parse(`${startYmd}T00:00:00.000Z`);
  const endMs = Date.parse(`${endYmd}T00:00:00.000Z`);
  if (endMs < startMs) {
    return [startYmd];
  }

  const days: string[] = [];
  for (let ms = startMs; ms <= endMs && days.length < maxDays; ms += DAY_MS) {
    days.push(new Date(ms).toISOString().slice(0, 10));
  }
  return days;
}

/**
 * Enumerates ISO Monday YYYY-MM-DD week start keys covering `[fromYmd, toYmd]`.
 */
export function enumerateHcmIsoWeeks(fromYmd: string, toYmd: string, maxWeeks = 60): string[] {
  if (!isValidYmd(fromYmd) || !isValidYmd(toYmd) || diffYmdDays(fromYmd, toYmd) < 0) {
    return [];
  }
  const firstWeek = getHcmIsoWeekStartYmd(fromYmd);
  const lastWeek = getHcmIsoWeekStartYmd(toYmd);

  const weeks: string[] = [];
  let cursor = firstWeek;
  while (cursor <= lastWeek && weeks.length < maxWeeks) {
    weeks.push(cursor);
    cursor = addDaysToYmd(cursor, 7);
  }
  return weeks;
}
