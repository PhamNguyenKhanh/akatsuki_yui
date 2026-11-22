import { ProjectMeetingStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { findCommonFreeSlots } from "@/modules/schedule/free-slot-finder";
import { buildWeekDayColumns } from "@/modules/schedule/schedule.types";

const BASE_DAYS = buildWeekDayColumns("2026-11-23"); // Mon 2026-11-23 .. Sun 2026-11-29

const MEMBERS = [
  { userId: "u1", fullName: "Nguyễn Văn An", email: "an@example.com", projectRole: "LEADER" },
  { userId: "u2", fullName: "Trần Thị Bình", email: "binh@example.com", projectRole: "MEMBER" },
  { userId: "u3", fullName: "Lê Hoàng Cường", email: "cuong@example.com", projectRole: "MEMBER" },
  {
    userId: "inst1",
    fullName: "Giảng Viên X",
    email: "gv@example.com",
    projectRole: "INSTRUCTOR",
  },
];

describe("findCommonFreeSlots", () => {
  it("excludes INSTRUCTOR, respects 07:00-23:00 window, and ranks 100% free slots first", () => {
    const nowMs = Date.parse("2026-11-23T06:00:00.000+07:00");

    // Make Mon 2026-11-23 busy for u1 from 07:00-19:00, leaving 19:00-23:00 free
    const occurrences = [
      {
        entryId: "e1",
        projectId: "p1",
        userId: "u1",
        userFullName: "Nguyễn Văn An",
        userEmail: "an@example.com",
        date: "2026-11-23",
        seriesStartDate: "2026-11-23",
        dayOfWeek: 1,
        startMinute: 7 * 60,
        endMinute: 19 * 60,
        startTime: "07:00",
        endTime: "19:00",
        note: null,
        isRecurring: false,
        repeatUntil: null,
        repeatWeeks: null,
        isOverridden: false,
        canEdit: true,
        canDelete: true,
      },
    ];

    const slots = findCommonFreeSlots({
      days: BASE_DAYS,
      members: MEMBERS,
      occurrences,
      meetings: [],
      durationMinutes: 120,
      nowMs,
      maxResults: 8,
    });

    expect(slots.length).toBeGreaterThan(0);
    // All top results should be 3/3 free (excluding INSTRUCTOR)
    expect(slots[0]!.totalMembers).toBe(3);
    expect(slots[0]!.freeCount).toBe(3);
    expect(slots[0]!.isAllFree).toBe(true);
    // Monday 19:00-21:00 is the earliest 100% free slot on Monday
    expect(slots[0]!.date).toBe("2026-11-23");
    expect(slots[0]!.startTime).toBe("19:00");
    expect(slots[0]!.endTime).toBe("21:00");
  });

  it("subtracts SCHEDULED meetings but ignores CANCELLED meetings", () => {
    const nowMs = Date.parse("2026-11-23T06:00:00.000+07:00");

    const slots = findCommonFreeSlots({
      days: [BASE_DAYS[0]!], // Monday only
      members: MEMBERS,
      occurrences: [],
      meetings: [
        {
          id: "m1",
          date: "2026-11-23",
          startMinute: 7 * 60,
          endMinute: 9 * 60,
          status: ProjectMeetingStatus.SCHEDULED,
          participants: [{ userId: "u2" }],
        },
        {
          id: "m2",
          date: "2026-11-23",
          startMinute: 9 * 60,
          endMinute: 11 * 60,
          status: ProjectMeetingStatus.CANCELLED,
          participants: [{ userId: "u2" }, { userId: "u3" }],
        },
      ],
      durationMinutes: 120,
      nowMs,
      maxResults: 20,
    });

    const slot07 = slots.find((s) => s.startTime === "07:00" && s.endTime === "09:00");
    const slot09 = slots.find((s) => s.startTime === "09:00" && s.endTime === "11:00");

    expect(slot07).toBeDefined();
    expect(slot07!.freeCount).toBe(2);
    expect(slot07!.isAllFree).toBe(false);
    expect(slot07!.busyMembers).toEqual([
      { userId: "u2", fullName: "Thị Bình", reason: "MEETING" },
    ]);

    expect(slot09).toBeDefined();
    expect(slot09!.freeCount).toBe(3);
    expect(slot09!.isAllFree).toBe(true);
  });

  it("filters out past slots and supports 90-minute duration", () => {
    // 20:30 on Sunday 2026-11-29 -> only slots ending after 20:30 remain (20:00-21:30, 21:00-22:30)
    const nowMs = Date.parse("2026-11-29T20:30:00.000+07:00");

    const slots = findCommonFreeSlots({
      days: BASE_DAYS,
      members: MEMBERS,
      occurrences: [],
      meetings: [],
      durationMinutes: 90,
      nowMs,
      maxResults: 10,
    });

    expect(slots.map((s) => `${s.startTime}-${s.endTime}`)).toEqual([
      "20:00-21:30",
      "21:00-22:30",
    ]);
  });
});
