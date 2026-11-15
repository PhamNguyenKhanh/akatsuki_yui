import { toProjectCalendarYmd, formatHcmYmd, diffYmdDays } from "@/lib/timezone";

export type ProjectTimelineState = "NO_DATES" | "NOT_STARTED" | "IN_WINDOW" | "PAST_END_DATE";

export interface ProjectTimelineProgressDTO {
  hasTimelineDates: boolean;
  startDate: string | null;
  endDate: string | null;
  state: ProjectTimelineState;
  totalDays: number | null;
  elapsedDays: number | null;
  remainingDays: number | null;
  overdueDays: number;
  progressPercent: number | null;
}

/**
 * Computes Project calendar timeline progress independently from Task completion progress (DEC-051).
 * Handles missing dates, startDate == endDate, before-start, within-window, and past-end-date states
 * cleanly in Asia/Ho_Chi_Minh without NaN or division by zero.
 */
export function computeProjectTimelineProgress(
  startDate: Date | null | undefined,
  endDate: Date | null | undefined,
  referenceNow: Date = new Date()
): ProjectTimelineProgressDTO {
  const startYmd = startDate ? toProjectCalendarYmd(startDate) : null;
  const endYmd = endDate ? toProjectCalendarYmd(endDate) : null;

  if (!startYmd || !endYmd) {
    return {
      hasTimelineDates: false,
      startDate: startYmd,
      endDate: endYmd,
      state: "NO_DATES",
      totalDays: null,
      elapsedDays: null,
      remainingDays: null,
      overdueDays: 0,
      progressPercent: null,
    };
  }

  const spanDelta = diffYmdDays(startYmd, endYmd);
  if (spanDelta < 0) {
    return {
      hasTimelineDates: false,
      startDate: startYmd,
      endDate: endYmd,
      state: "NO_DATES",
      totalDays: null,
      elapsedDays: null,
      remainingDays: null,
      overdueDays: 0,
      progressPercent: null,
    };
  }

  const totalDays = spanDelta + 1;
  const todayYmd = formatHcmYmd(referenceNow);

  if (todayYmd < startYmd) {
    return {
      hasTimelineDates: true,
      startDate: startYmd,
      endDate: endYmd,
      state: "NOT_STARTED",
      totalDays,
      elapsedDays: 0,
      remainingDays: totalDays,
      overdueDays: 0,
      progressPercent: 0,
    };
  }

  if (todayYmd > endYmd) {
    return {
      hasTimelineDates: true,
      startDate: startYmd,
      endDate: endYmd,
      state: "PAST_END_DATE",
      totalDays,
      elapsedDays: totalDays,
      remainingDays: 0,
      overdueDays: diffYmdDays(endYmd, todayYmd),
      progressPercent: 100,
    };
  }

  const elapsedDays = diffYmdDays(startYmd, todayYmd) + 1;
  const remainingDays = Math.max(0, totalDays - elapsedDays);
  const progressPercent = Math.round((elapsedDays / totalDays) * 1000) / 10;

  return {
    hasTimelineDates: true,
    startDate: startYmd,
    endDate: endYmd,
    state: "IN_WINDOW",
    totalDays,
    elapsedDays,
    remainingDays,
    overdueDays: 0,
    progressPercent,
  };
}
