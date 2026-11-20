import {
  ProjectMemberRole,
  ProjectStatus,
  ScheduleExceptionType,
  UserStatus,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import type { AuthContext } from "@/types/auth";

const { prismaMock, scheduleRepoMock, listMembersMock } = vi.hoisted(() => {
  const txMock = {
    project: {
      findUnique: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
  };

  return {
    prismaMock: {
      project: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock)),
      __tx: txMock,
    },
    scheduleRepoMock: {
      findWeekEntries: vi.fn(),
      findByIdInProject: vi.fn(),
      createEntry: vi.fn(),
      updateEntry: vi.fn(),
      deleteEntry: vi.fn(),
      upsertException: vi.fn(),
      deleteExceptionsFromDate: vi.fn(),
      deleteAllExceptionsForEntry: vi.fn(),
    },
    listMembersMock: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/modules/schedule/schedule.repository", () => ({
  scheduleRepository: scheduleRepoMock,
  toPgDateOnly: (ymd: string) => new Date(`${ymd}T00:00:00.000Z`),
}));

vi.mock("@/modules/project-members/member.service", () => ({
  listProjectMembersService: listMembersMock,
}));

import {
  createScheduleEntrySchema,
  deleteScheduleEntrySchema,
  updateScheduleEntrySchema,
} from "@/modules/schedule/schedule.schema";
import {
  createScheduleEntryService,
  deleteScheduleEntryService,
  expandScheduleEntriesForWeek,
  updateScheduleEntryService,
} from "@/modules/schedule/schedule.service";
import {
  buildWeekDayColumns,
  getIsoDayOfWeekFromYmd,
  hhmmToMinutes,
  minutesToHhmm,
} from "@/modules/schedule/schedule.types";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const ENTRY_ID = "22222222-2222-4222-8222-222222222222";
const LEADER_ID = "33333333-3333-4333-8333-333333333333";
const MEMBER_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_MEMBER_ID = "55555555-5555-4555-8555-555555555555";
const INSTRUCTOR_ID = "66666666-6666-4666-8666-666666666666";

const memberActor: AuthContext = {
  userId: MEMBER_ID,
  email: "member@akatsuki.local",
  fullName: "Member A",
  status: UserStatus.ACTIVE,
  roles: [ROLES.MEMBER],
  permissions: [PERMISSIONS.PROJECT_READ, PERMISSIONS.SCHEDULE_READ, PERMISSIONS.SCHEDULE_MANAGE],
};

const leaderActor: AuthContext = {
  userId: LEADER_ID,
  email: "leader@akatsuki.local",
  fullName: "Leader A",
  status: UserStatus.ACTIVE,
  roles: [ROLES.LEADER],
  permissions: [PERMISSIONS.PROJECT_READ, PERMISSIONS.SCHEDULE_READ, PERMISSIONS.SCHEDULE_MANAGE],
};

const instructorActor: AuthContext = {
  userId: INSTRUCTOR_ID,
  email: "instructor@akatsuki.local",
  fullName: "Instructor A",
  status: UserStatus.ACTIVE,
  roles: [ROLES.INSTRUCTOR],
  permissions: [PERMISSIONS.PROJECT_READ, PERMISSIONS.SCHEDULE_READ],
};

function makeProjectRecord(
  status: ProjectStatus = ProjectStatus.ACTIVE,
  role: ProjectMemberRole = ProjectMemberRole.MEMBER
) {
  return {
    id: PROJECT_ID,
    name: "Schedule Project",
    status,
    startDate: new Date("2026-11-01T00:00:00.000Z"),
    endDate: new Date("2026-12-31T00:00:00.000Z"),
    leaderId: LEADER_ID,
    instructorId: INSTRUCTOR_ID,
    members: [{ id: "pm-1", projectRole: role }],
  };
}

describe("Project Weekly Schedule Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("converts HH:mm <-> minutes accurately and builds 7-day Monday..Sunday columns", () => {
    expect(hhmmToMinutes("00:00")).toBe(0);
    expect(hhmmToMinutes("14:30")).toBe(870);
    expect(hhmmToMinutes("24:00")).toBe(1440);
    expect(minutesToHhmm(870)).toBe("14:30");
    expect(minutesToHhmm(1440)).toBe("24:00");

    // 2026-11-23 is Monday, 2026-11-29 is Sunday
    expect(getIsoDayOfWeekFromYmd("2026-11-23")).toBe(1);
    expect(getIsoDayOfWeekFromYmd("2026-11-29")).toBe(7);

    const cols = buildWeekDayColumns("2026-11-25"); // Wednesday -> normalizes to Monday 2026-11-23
    expect(cols).toHaveLength(7);
    expect(cols[0]?.date).toBe("2026-11-23");
    expect(cols[0]?.shortLabel).toBe("T2");
    expect(cols[6]?.date).toBe("2026-11-29");
    expect(cols[6]?.shortLabel).toBe("CN");
  });

  it("validates create/update/delete schemas including 24:00 end time and rejects invalid ranges", () => {
    const valid = createScheduleEntrySchema.parse({
      date: "2026-11-23",
      startTime: "22:00",
      endTime: "24:00",
      isRecurring: true,
      note: "  ",
    });
    expect(valid.note).toBeNull();
    expect(valid.endTime).toBe("24:00");

    expect(
      createScheduleEntrySchema.safeParse({
        date: "2026-11-23",
        startTime: "16:00",
        endTime: "14:00",
        isRecurring: false,
      }).success
    ).toBe(false);

    expect(
      updateScheduleEntrySchema.safeParse({
        scope: "THIS_WEEK",
        occurrenceDate: "2026-11-23",
        startTime: "10:00",
        endTime: "12:00",
        isRecurring: true,
      }).success
    ).toBe(true);

    expect(
      deleteScheduleEntrySchema.safeParse({
        scope: "THIS_AND_FUTURE",
        occurrenceDate: "2026-11-30",
      }).success
    ).toBe(true);
  });

  it("expands recurring & one-off entries for a week while applying CANCELLED and OVERRIDDEN exceptions", () => {
    const entries = [
      {
        id: "e-oneoff",
        projectId: PROJECT_ID,
        userId: MEMBER_ID,
        date: new Date("2026-11-24T00:00:00.000Z"),
        dayOfWeek: 2,
        isRecurring: false,
        repeatUntil: null,
        startMinute: 540,
        endMinute: 660,
        note: "Khám răng",
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: MEMBER_ID, fullName: "Member A", email: "member@akatsuki.local" },
        exceptions: [],
      },
      {
        id: "e-cancelled",
        projectId: PROJECT_ID,
        userId: MEMBER_ID,
        date: new Date("2026-11-02T00:00:00.000Z"),
        dayOfWeek: 1,
        isRecurring: true,
        repeatUntil: null,
        startMinute: 480,
        endMinute: 600,
        note: "Học sáng T2",
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: MEMBER_ID, fullName: "Member A", email: "member@akatsuki.local" },
        exceptions: [
          {
            id: "ex-1",
            exceptionDate: new Date("2026-11-23T00:00:00.000Z"),
            type: ScheduleExceptionType.CANCELLED,
            overrideStartMinute: null,
            overrideEndMinute: null,
            overrideNote: null,
          },
        ],
      },
      {
        id: "e-overridden",
        projectId: PROJECT_ID,
        userId: LEADER_ID,
        date: new Date("2026-11-04T00:00:00.000Z"),
        dayOfWeek: 3,
        isRecurring: true,
        repeatUntil: null,
        startMinute: 840,
        endMinute: 960,
        note: "Lịch cố định T4",
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: LEADER_ID, fullName: "Leader A", email: "leader@akatsuki.local" },
        exceptions: [
          {
            id: "ex-2",
            exceptionDate: new Date("2026-11-25T00:00:00.000Z"),
            type: ScheduleExceptionType.OVERRIDDEN,
            overrideStartMinute: 900,
            overrideEndMinute: 1050,
            overrideNote: "Đổi giờ tuần này",
          },
        ],
      },
    ];

    const occurrences = expandScheduleEntriesForWeek(entries, "2026-11-23", {
      actorUserId: MEMBER_ID,
      canManageOwn: true,
      canDeleteAny: false,
    });

    expect(occurrences).toHaveLength(2);
    expect(occurrences[0]).toMatchObject({
      entryId: "e-oneoff",
      date: "2026-11-24",
      startTime: "09:00",
      endTime: "11:00",
      canEdit: true,
      canDelete: true,
    });
    expect(occurrences[1]).toMatchObject({
      entryId: "e-overridden",
      date: "2026-11-25",
      startTime: "15:00",
      endTime: "17:30",
      note: "Đổi giờ tuần này",
      isOverridden: true,
      canEdit: false,
      canDelete: false,
    });
  });

  const referenceNow = new Date("2026-11-21T08:00:00.000+07:00");

  it("blocks INSTRUCTOR from creating schedule entries and blocks mutations on ARCHIVED projects", async () => {
    prismaMock.__tx.project.findUnique.mockResolvedValueOnce(
      makeProjectRecord(ProjectStatus.ACTIVE)
    );
    await expect(
      createScheduleEntryService(
        instructorActor,
        PROJECT_ID,
        {
          date: "2026-11-23",
          startTime: "14:00",
          endTime: "16:00",
          isRecurring: false,
        },
        referenceNow
      )
    ).rejects.toMatchObject({ statusCode: 403 });

    prismaMock.__tx.project.findUnique.mockResolvedValueOnce(
      makeProjectRecord(ProjectStatus.ARCHIVED)
    );
    await expect(
      createScheduleEntryService(
        memberActor,
        PROJECT_ID,
        {
          date: "2026-11-23",
          startTime: "14:00",
          endTime: "16:00",
          isRecurring: false,
        },
        referenceNow
      )
    ).rejects.toMatchObject({ statusCode: 409, code: "PROJECT_ARCHIVED" });
  });

  it("rejects creating schedule before current time or past project end date, and applies repeatWeeks accurately", async () => {
    await expect(
      createScheduleEntryService(
        memberActor,
        PROJECT_ID,
        {
          date: "2026-11-21",
          startTime: "07:30",
          endTime: "09:00",
          isRecurring: false,
        },
        referenceNow
      )
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });

    prismaMock.__tx.project.findUnique.mockResolvedValue(makeProjectRecord(ProjectStatus.ACTIVE));

    await expect(
      createScheduleEntryService(
        memberActor,
        PROJECT_ID,
        {
          date: "2027-01-05",
          startTime: "09:00",
          endTime: "11:00",
          isRecurring: false,
        },
        referenceNow
      )
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });

    // 2026-11-23 + 9 weeks -> 2027-01-18 > 2026-12-31
    await expect(
      createScheduleEntryService(
        memberActor,
        PROJECT_ID,
        {
          date: "2026-11-23",
          startTime: "09:00",
          endTime: "11:00",
          isRecurring: true,
          repeatWeeks: 9,
        },
        referenceNow
      )
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });

    scheduleRepoMock.createEntry.mockResolvedValueOnce({
      id: ENTRY_ID,
      projectId: PROJECT_ID,
      date: new Date("2026-11-23T00:00:00.000Z"),
      isRecurring: true,
    });

    await createScheduleEntryService(
      memberActor,
      PROJECT_ID,
      {
        date: "2026-11-23",
        startTime: "09:00",
        endTime: "11:00",
        isRecurring: true,
        repeatWeeks: 3,
        note: "Học 3 tuần",
      },
      referenceNow
    );

    expect(scheduleRepoMock.createEntry).toHaveBeenLastCalledWith(
      expect.objectContaining({
        dateYmd: "2026-11-23",
        isRecurring: true,
        repeatUntilYmd: "2026-12-07",
      }),
      prismaMock.__tx
    );

    scheduleRepoMock.createEntry.mockResolvedValueOnce({
      id: ENTRY_ID,
      projectId: PROJECT_ID,
      date: new Date("2026-11-23T00:00:00.000Z"),
      isRecurring: true,
    });

    await createScheduleEntryService(
      memberActor,
      PROJECT_ID,
      {
        date: "2026-11-23",
        startTime: "09:00",
        endTime: "11:00",
        isRecurring: true,
        repeatWeeks: null,
      },
      referenceNow
    );

    expect(scheduleRepoMock.createEntry).toHaveBeenLastCalledWith(
      expect.objectContaining({
        dateYmd: "2026-11-23",
        isRecurring: true,
        repeatUntilYmd: "2026-12-31",
      }),
      prismaMock.__tx
    );
  });

  it("enforces owner-only updates and allows Leader to delete another member's entry", async () => {
    prismaMock.__tx.project.findUnique.mockResolvedValue(
      makeProjectRecord(ProjectStatus.ACTIVE, ProjectMemberRole.LEADER)
    );
    scheduleRepoMock.findByIdInProject.mockResolvedValue({
      id: ENTRY_ID,
      projectId: PROJECT_ID,
      userId: OTHER_MEMBER_ID,
      date: new Date("2026-11-23T00:00:00.000Z"),
      dayOfWeek: 1,
      isRecurring: true,
      repeatUntil: null,
      startMinute: 840,
      endMinute: 960,
      note: "Lịch cũ",
      user: { id: OTHER_MEMBER_ID, fullName: "Other Member", email: "other@akatsuki.local" },
      exceptions: [],
    });

    await expect(
      updateScheduleEntryService(leaderActor, PROJECT_ID, ENTRY_ID, {
        scope: "ALL_SERIES",
        occurrenceDate: "2026-11-23",
        startTime: "14:00",
        endTime: "16:00",
        isRecurring: true,
      })
    ).rejects.toMatchObject({ statusCode: 403 });

    await expect(
      deleteScheduleEntryService(leaderActor, PROJECT_ID, ENTRY_ID, {
        scope: "ALL_SERIES",
        occurrenceDate: "2026-11-23",
      })
    ).resolves.toEqual({ id: ENTRY_ID, projectId: PROJECT_ID });

    expect(scheduleRepoMock.deleteEntry).toHaveBeenCalledWith(ENTRY_ID, prismaMock.__tx);
  });

  it("splits recurring series on THIS_AND_FUTURE update after start date", async () => {
    prismaMock.__tx.project.findUnique.mockResolvedValue(
      makeProjectRecord(ProjectStatus.ACTIVE, ProjectMemberRole.MEMBER)
    );
    scheduleRepoMock.findByIdInProject.mockResolvedValue({
      id: ENTRY_ID,
      projectId: PROJECT_ID,
      userId: MEMBER_ID,
      date: new Date("2026-11-02T00:00:00.000Z"),
      dayOfWeek: 1,
      isRecurring: true,
      repeatUntil: null,
      startMinute: 840,
      endMinute: 960,
      note: "Cũ",
      user: { id: MEMBER_ID, fullName: "Member A", email: "member@akatsuki.local" },
      exceptions: [],
    });
    scheduleRepoMock.createEntry.mockResolvedValue({
      id: "new-entry-id",
      projectId: PROJECT_ID,
    });

    const updated = await updateScheduleEntryService(memberActor, PROJECT_ID, ENTRY_ID, {
      scope: "THIS_AND_FUTURE",
      occurrenceDate: "2026-11-23",
      date: "2026-11-23",
      startTime: "15:00",
      endTime: "17:00",
      isRecurring: true,
      note: "Mới",
    });

    expect(updated).toEqual({ id: "new-entry-id", projectId: PROJECT_ID });
    expect(scheduleRepoMock.updateEntry).toHaveBeenCalledWith(
      ENTRY_ID,
      { repeatUntilYmd: "2026-11-22" },
      prismaMock.__tx
    );
    expect(scheduleRepoMock.deleteExceptionsFromDate).toHaveBeenCalledWith(
      ENTRY_ID,
      "2026-11-23",
      prismaMock.__tx
    );
    expect(scheduleRepoMock.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        dateYmd: "2026-11-23",
        dayOfWeek: 1,
        startMinute: 900,
        endMinute: 1020,
        note: "Mới",
        isRecurring: true,
      }),
      prismaMock.__tx
    );
  });
});
