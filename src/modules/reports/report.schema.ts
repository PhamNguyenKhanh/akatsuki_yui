import { z } from "zod";
import {
  addDaysToYmd,
  diffYmdDays,
  enumerateHcmDays,
  enumerateHcmIsoWeeks,
  formatHcmYmd,
  isValidYmd,
  parseHcmDateBounds,
  toProjectCalendarYmd,
} from "@/lib/timezone";

export const ANALYTICS_MAX_WINDOW_DAYS = 365;
export const ANALYTICS_WEEKLY_THRESHOLD_DAYS = 90;

export const analyticsPresetSchema = z.enum(["7d", "30d", "90d", "all", "custom"]);
export type AnalyticsPreset = z.infer<typeof analyticsPresetSchema>;

const ymdField = z
  .string()
  .trim()
  .refine((val) => isValidYmd(val), {
    message: "Ngày phải đúng định dạng YYYY-MM-DD hợp lệ.",
  });

function validateAnalyticsDateWindow(
  data: { preset?: AnalyticsPreset; from?: string; to?: string },
  ctx: z.RefinementCtx
) {
  const hasFrom = typeof data.from === "string" && data.from.length > 0;
  const hasTo = typeof data.to === "string" && data.to.length > 0;

  if (data.preset === "custom" || hasFrom || hasTo) {
    if (!hasFrom || !hasTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [hasFrom ? "to" : "from"],
        message: "Khoảng thời gian tùy chọn yêu cầu đầy đủ cả từ ngày (from) và đến ngày (to).",
      });
      return;
    }

    if (!isValidYmd(data.from!) || !isValidYmd(data.to!)) {
      return;
    }

    const delta = diffYmdDays(data.from!, data.to!);
    if (delta < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.",
      });
      return;
    }

    if (delta + 1 > ANALYTICS_MAX_WINDOW_DAYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: `Khoảng thời gian phân tích tối đa là ${ANALYTICS_MAX_WINDOW_DAYS} ngày.`,
      });
    }
  }
}

export const analyticsQuerySchema = z
  .object({
    preset: analyticsPresetSchema.default("30d"),
    from: ymdField.optional(),
    to: ymdField.optional(),
  })
  .superRefine(validateAnalyticsDateWindow);

export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>;

function parseBooleanParam(value: unknown): unknown {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return value;
}

export const memberContributionQuerySchema = z
  .object({
    preset: analyticsPresetSchema.default("30d"),
    from: ymdField.optional(),
    to: ymdField.optional(),
    includeRemoved: z.preprocess(parseBooleanParam, z.boolean()).default(true),
  })
  .superRefine(validateAnalyticsDateWindow);

export type MemberContributionQueryInput = z.infer<typeof memberContributionQuerySchema>;

export type AnalyticsGranularity = "day" | "week";

export interface ResolvedAnalyticsDateWindow {
  preset: AnalyticsPreset;
  fromYmd: string;
  toYmd: string;
  fromUtc: Date;
  toUtc: Date;
  spanDays: number;
  granularity: AnalyticsGranularity;
  bucketKeys: string[];
  wasClampedTo365Days: boolean;
  timezone: "Asia/Ho_Chi_Minh";
}

/**
 * Resolves `7d | 30d | 90d | all | custom` date filters into Asia/Ho_Chi_Minh calendar bounds,
 * enforcing the 365-day cap and switching automatically to ISO Monday weeks above 90 days (DEC-057).
 */
export function resolveAnalyticsDateWindow(
  query: AnalyticsQueryInput,
  projectOrigin?: {
    startDate?: Date | null;
    createdAt?: Date | null;
    earliestTaskCreatedAt?: Date | null;
  },
  referenceNow: Date = new Date()
): ResolvedAnalyticsDateWindow {
  const todayYmd = formatHcmYmd(referenceNow);
  let effectivePreset: AnalyticsPreset = query.preset;
  if (query.from && query.to && query.preset === "30d") {
    effectivePreset = "custom";
  }

  let fromYmd: string;
  let toYmd: string = todayYmd;
  let wasClampedTo365Days = false;

  if (effectivePreset === "custom" && query.from && query.to) {
    fromYmd = query.from;
    toYmd = query.to;
  } else if (effectivePreset === "7d") {
    fromYmd = addDaysToYmd(todayYmd, -6);
  } else if (effectivePreset === "90d") {
    fromYmd = addDaysToYmd(todayYmd, -89);
  } else if (effectivePreset === "all") {
    const candidates: string[] = [];
    if (projectOrigin?.startDate) {
      candidates.push(toProjectCalendarYmd(projectOrigin.startDate));
    }
    if (projectOrigin?.createdAt) {
      candidates.push(formatHcmYmd(projectOrigin.createdAt));
    }
    if (projectOrigin?.earliestTaskCreatedAt) {
      candidates.push(formatHcmYmd(projectOrigin.earliestTaskCreatedAt));
    }
    candidates.sort();
    fromYmd =
      candidates[0] && candidates[0] <= todayYmd ? candidates[0] : addDaysToYmd(todayYmd, -29);
    const span = diffYmdDays(fromYmd, toYmd) + 1;
    if (span > ANALYTICS_MAX_WINDOW_DAYS) {
      fromYmd = addDaysToYmd(toYmd, -(ANALYTICS_MAX_WINDOW_DAYS - 1));
      wasClampedTo365Days = true;
    }
  } else {
    fromYmd = addDaysToYmd(todayYmd, -29);
  }

  const bounds = parseHcmDateBounds(fromYmd, toYmd);
  const spanDays = bounds.inclusiveDays;
  const granularity: AnalyticsGranularity =
    spanDays > ANALYTICS_WEEKLY_THRESHOLD_DAYS ? "week" : "day";
  const bucketKeys =
    granularity === "week"
      ? enumerateHcmIsoWeeks(fromYmd, toYmd)
      : enumerateHcmDays(fromYmd, toYmd);

  return {
    preset: effectivePreset,
    fromYmd,
    toYmd,
    fromUtc: bounds.fromUtc,
    toUtc: bounds.toUtc,
    spanDays,
    granularity,
    bucketKeys,
    wasClampedTo365Days,
    timezone: "Asia/Ho_Chi_Minh",
  };
}
