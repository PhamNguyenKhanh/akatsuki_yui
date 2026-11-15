import { describe, expect, it } from "vitest";
import {
  BUSINESS_TIMEZONE,
  addDaysToYmd,
  diffYmdDays,
  enumerateHcmDays,
  enumerateHcmIsoWeeks,
  formatDateKeyInHoChiMinh,
  formatHcmDateTimeVi,
  formatHcmDateVi,
  formatHcmYmd,
  formatPgDateYmd,
  getHcmIsoWeekStartYmd,
  hcmEndOfDay,
  hcmStartOfDay,
  isValidYmd,
  parseHcmDateBounds,
  toProjectCalendarYmd,
} from "@/lib/timezone";

describe("Sprint 6 Package 1 — Shared Asia/Ho_Chi_Minh Timezone Helpers", () => {
  it("normalizes UTC timestamps around Vietnam midnight (16:59:59.999Z vs 17:00:00.000Z)", () => {
    expect(BUSINESS_TIMEZONE).toBe("Asia/Ho_Chi_Minh");

    const sunBeforeMidnightHcm = new Date("2026-11-15T16:59:59.999Z"); // Sun 2026-11-15 23:59:59.999+07:00
    const monAtMidnightHcm = new Date("2026-11-15T17:00:00.000Z"); // Mon 2026-11-16 00:00:00.000+07:00

    expect(formatHcmYmd(sunBeforeMidnightHcm)).toBe("2026-11-15");
    expect(formatDateKeyInHoChiMinh(sunBeforeMidnightHcm)).toBe("2026-11-15");
    expect(formatHcmYmd(monAtMidnightHcm)).toBe("2026-11-16");
    expect(formatDateKeyInHoChiMinh(monAtMidnightHcm)).toBe("2026-11-16");
  });

  it("aligns ISO Monday week starts consistently with PostgreSQL date_trunc('week', ...) across Sunday/Monday boundary", () => {
    const sunBeforeMidnightHcm = new Date("2026-11-15T16:59:59.999Z");
    const monAtMidnightHcm = new Date("2026-11-15T17:00:00.000Z");

    // 2026-11-15 is Sunday -> ISO week started Monday 2026-11-09
    expect(getHcmIsoWeekStartYmd(sunBeforeMidnightHcm)).toBe("2026-11-09");
    // 2026-11-16 is Monday -> ISO week starts Monday 2026-11-16
    expect(getHcmIsoWeekStartYmd(monAtMidnightHcm)).toBe("2026-11-16");

    expect(enumerateHcmIsoWeeks("2026-11-10", "2026-11-24")).toEqual([
      "2026-11-09",
      "2026-11-16",
      "2026-11-23",
    ]);
  });

  it("keeps PostgreSQL DATE columns unshifted and handles Project UTC-midnight calendar inputs safely", () => {
    const pgSprintStartDate = new Date("2026-11-15T00:00:00.000Z");
    expect(formatPgDateYmd(pgSprintStartDate)).toBe("2026-11-15");
    expect(toProjectCalendarYmd(pgSprintStartDate)).toBe("2026-11-15");

    // If stored as explicit +07:00 instant (2026-11-15T00:00:00.000+07:00 == 2026-11-14T17:00:00.000Z)
    const explicitHcmMidnight = new Date("2026-11-14T17:00:00.000Z");
    expect(toProjectCalendarYmd(explicitHcmMidnight)).toBe("2026-11-15");
  });

  it("validates Gregorian calendar dates and builds exact UTC range bounds", () => {
    expect(isValidYmd("2026-11-15")).toBe(true);
    expect(isValidYmd("2026-02-29")).toBe(false); // 2026 is not leap year
    expect(isValidYmd("2024-02-29")).toBe(true);
    expect(isValidYmd("2026-13-01")).toBe(false);
    expect(() => hcmStartOfDay("2026-02-30")).toThrow();
    expect(() => hcmEndOfDay("invalid")).toThrow();

    const bounds = parseHcmDateBounds("2026-11-01", "2026-11-03");
    expect(bounds.fromUtc.toISOString()).toBe("2026-10-31T17:00:00.000Z");
    expect(bounds.toUtc.toISOString()).toBe("2026-11-03T16:59:59.999Z");
    expect(bounds.inclusiveDays).toBe(3);

    expect(addDaysToYmd("2026-11-15", -6)).toBe("2026-11-09");
    expect(diffYmdDays("2026-11-01", "2026-11-15")).toBe(14);
    expect(enumerateHcmDays("2026-11-01", "2026-11-03")).toEqual([
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
    ]);
    expect(formatHcmDateVi("2026-11-15")).toBe("15/11/2026");
    expect(formatHcmDateTimeVi(new Date("2026-11-15T17:05:00.000Z"))).toContain("16/11/2026");
  });
});
