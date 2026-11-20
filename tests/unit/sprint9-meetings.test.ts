import {
  ProjectMeetingStatus,
  ProjectMemberRole,
  ProjectStatus,
  ScheduleExceptionType,
  UserStatus,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateGoogleMeetUrl } from "@/lib/safe-url";
import { PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import type { AuthContext } from "@/types/auth";

const { prismaMock, meetingRepoMock, listMembersMock } = vi.hoisted(() => {
  const txMock = {
    $executeRaw: vi.fn(),
    project: {
      findUnique: vi.fn(),
    },
    projectMember: {
      findMany: vi.fn(),
    },
    projectScheduleEntry: {
      findMany: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
  };

  return {
    prismaMock: {
      $transaction: vi.fn(async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock)),
      __tx: txMock,
    },
    meetingRepoMock: {
      listMeetLinks: vi.fn(),
      findMeetLinkById: vi.fn(),
      clearDefaultMeetLinks: vi.fn(),
      createMeetLink: vi.fn(),
      updateMeetLink: vi.fn(),
      deleteMeetLink: vi.fn(),
      listMeetings: vi.fn(),
      findMeetingById: vi.fn(),
      findOverlappingScheduledMeeting: vi.fn(),
      createMeeting: vi.fn(),
      updateMeeting: vi.fn(),
      cancelMeeting: vi.fn(),
      deleteMeeting: vi.fn(),
    },
    listMembersMock: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/modules/meetings/meeting.repository", async () => {
  const actual = await vi.importActual<typeof import("@/modules/meetings/meeting.repository")>(
    "@/modules/meetings/meeting.repository"
  );
  return {
    ...actual,
    meetingRepository: meetingRepoMock,
  };
});

vi.mock("@/modules/project-members/member.service", () => ({
  listProjectMembersService: listMembersMock,
}));

import {
  createMeetLinkService,
  createProjectMeetingService,
  deleteMeetLinkService,
  updateMeetLinkService,
} from "@/modules/meetings/meeting.service";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const LINK_ID = "22222222-2222-4222-8222-222222222222";
const MEETING_ID = "33333333-3333-4333-8333-333333333333";
const LEADER_ID = "44444444-4444-4444-8444-444444444444";
const MEMBER_ID = "55555555-5555-4555-8555-555555555555";

const leaderActor: AuthContext = {
  userId: LEADER_ID,
  email: "leader@akatsuki.local",
  fullName: "Leader A",
  status: UserStatus.ACTIVE,
  roles: [ROLES.LEADER],
  permissions: [PERMISSIONS.PROJECT_READ, PERMISSIONS.MEETING_READ, PERMISSIONS.MEETING_MANAGE],
};

const memberActor: AuthContext = {
  userId: MEMBER_ID,
  email: "member@akatsuki.local",
  fullName: "Member A",
  status: UserStatus.ACTIVE,
  roles: [ROLES.MEMBER],
  permissions: [PERMISSIONS.PROJECT_READ, PERMISSIONS.MEETING_READ],
};

function makeProject(status: ProjectStatus = ProjectStatus.ACTIVE) {
  return {
    id: PROJECT_ID,
    name: "Meet Project",
    status,
    leaderId: LEADER_ID,
    instructorId: null,
    members: [{ id: "pm-1", projectRole: ProjectMemberRole.LEADER }],
  };
}

describe("Google Meet & Project Meetings Module", () => {
  const referenceNow = new Date("2026-11-21T08:00:00.000+07:00");

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.__tx.project.findUnique.mockResolvedValue(makeProject(ProjectStatus.ACTIVE));
    prismaMock.__tx.projectMember.findMany.mockResolvedValue([
      { userId: LEADER_ID },
      { userId: MEMBER_ID },
    ]);
    prismaMock.__tx.projectScheduleEntry.findMany.mockResolvedValue([]);
    meetingRepoMock.findOverlappingScheduledMeeting.mockResolvedValue(null);
  });

  it("validates official https://meet.google.com/<code> URLs and blocks unsafe/non-Meet URLs", () => {
    expect(validateGoogleMeetUrl("https://meet.google.com/abc-defg-hij").valid).toBe(true);
    expect(validateGoogleMeetUrl("http://meet.google.com/abc-defg-hij").valid).toBe(false);
    expect(validateGoogleMeetUrl("https://meet.google.com/").valid).toBe(false);
    expect(validateGoogleMeetUrl("https://zoom.us/j/12345").valid).toBe(false);
    expect(validateGoogleMeetUrl("javascript:alert(1)").valid).toBe(false);
  });

  it("rejects creating a meeting whose start time is in the past", async () => {
    await expect(
      createProjectMeetingService(
        leaderActor,
        PROJECT_ID,
        {
          title: "Past Meeting",
          date: "2026-11-21",
          startTime: "07:30",
          endTime: "08:30",
          meetUrl: "https://meet.google.com/abc-defg-hij",
          participantUserIds: [LEADER_ID, MEMBER_ID],
        },
        referenceNow
      )
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });

    expect(meetingRepoMock.createMeeting).not.toHaveBeenCalled();
  });

  it("blocks creating a meeting when a participant has a busy Schedule entry (recurring or one-off)", async () => {
    // 2026-11-23 is Monday (dayOfWeek = 1)
    prismaMock.__tx.projectScheduleEntry.findMany.mockResolvedValue([
      {
        id: "sched-1",
        projectId: PROJECT_ID,
        userId: MEMBER_ID,
        date: new Date("2026-11-02T00:00:00.000Z"),
        dayOfWeek: 1,
        isRecurring: true,
        repeatUntil: null,
        startMinute: 840, // 14:00
        endMinute: 960, // 16:00
        note: "Học trên trường",
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: MEMBER_ID, fullName: "Member A", email: "member@akatsuki.local" },
        exceptions: [],
      },
    ]);

    await expect(
      createProjectMeetingService(
        leaderActor,
        PROJECT_ID,
        {
          title: "Sprint Review",
          date: "2026-11-23",
          startTime: "15:00",
          endTime: "16:30",
          meetUrl: "https://meet.google.com/abc-defg-hij",
          participantUserIds: [LEADER_ID, MEMBER_ID],
        },
        referenceNow
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "SCHEDULE_CONFLICT",
    });
  });

  it("allows creating a meeting when the participant's recurring Schedule slot was CANCELLED for that date", async () => {
    prismaMock.__tx.projectScheduleEntry.findMany.mockResolvedValue([
      {
        id: "sched-1",
        projectId: PROJECT_ID,
        userId: MEMBER_ID,
        date: new Date("2026-11-02T00:00:00.000Z"),
        dayOfWeek: 1,
        isRecurring: true,
        repeatUntil: null,
        startMinute: 840,
        endMinute: 960,
        note: "Nghỉ học tuần này",
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
    ]);

    meetingRepoMock.createMeeting.mockResolvedValue({
      id: MEETING_ID,
      projectId: PROJECT_ID,
      meetLinkId: null,
      title: "Sprint Review",
      description: null,
      meetUrl: "https://meet.google.com/abc-defg-hij",
      date: new Date("2026-11-23T00:00:00.000Z"),
      startMinute: 900,
      endMinute: 960,
      startAt: new Date("2026-11-23T15:00:00.000+07:00"),
      endAt: new Date("2026-11-23T16:00:00.000+07:00"),
      status: ProjectMeetingStatus.SCHEDULED,
      createdBy: { id: LEADER_ID, fullName: "Leader A" },
      participants: [
        { user: { id: MEMBER_ID, fullName: "Member A", email: "member@akatsuki.local" } },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const created = await createProjectMeetingService(
      leaderActor,
      PROJECT_ID,
      {
        title: "Sprint Review",
        date: "2026-11-23",
        startTime: "15:00",
        endTime: "16:00",
        meetUrl: "https://meet.google.com/abc-defg-hij",
        participantUserIds: [LEADER_ID, MEMBER_ID],
      },
      referenceNow
    );

    expect(created.id).toBe(MEETING_ID);
    expect(meetingRepoMock.createMeeting).toHaveBeenCalledTimes(1);
  });

  it("blocks creating a meeting that overlaps with another SCHEDULED meeting", async () => {
    meetingRepoMock.findOverlappingScheduledMeeting.mockResolvedValue({
      id: "other-meeting",
      title: "Daily Sync",
      startMinute: 540,
      endMinute: 600,
    });

    await expect(
      createProjectMeetingService(
        leaderActor,
        PROJECT_ID,
        {
          title: "Design Review",
          date: "2026-11-23",
          startTime: "09:30",
          endTime: "10:30",
          meetUrl: "https://meet.google.com/abc-defg-hij",
          participantUserIds: [LEADER_ID],
        },
        referenceNow
      )
    ).rejects.toMatchObject({ statusCode: 409, code: "MEETING_TIME_CONFLICT" });
  });

  it("enforces MEETING_MANAGE for saved Meet links and supports create/update/delete", async () => {
    await expect(
      createMeetLinkService(memberActor, PROJECT_ID, {
        label: "Member Link",
        url: "https://meet.google.com/abc-defg-hij",
        isDefault: false,
      })
    ).rejects.toMatchObject({ statusCode: 403 });

    meetingRepoMock.createMeetLink.mockResolvedValue({
      id: LINK_ID,
      projectId: PROJECT_ID,
      label: "Daily Room",
      url: "https://meet.google.com/abc-defg-hij",
      description: null,
      isDefault: true,
      createdBy: { id: LEADER_ID, fullName: "Leader A" },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const created = await createMeetLinkService(leaderActor, PROJECT_ID, {
      label: "Daily Room",
      url: "https://meet.google.com/abc-defg-hij",
      isDefault: true,
    });
    expect(created.isDefault).toBe(true);
    expect(meetingRepoMock.clearDefaultMeetLinks).toHaveBeenCalledWith(
      PROJECT_ID,
      undefined,
      prismaMock.__tx
    );

    meetingRepoMock.findMeetLinkById.mockResolvedValue({ id: LINK_ID, label: "Daily Room" });
    meetingRepoMock.updateMeetLink.mockResolvedValue({
      id: LINK_ID,
      projectId: PROJECT_ID,
      label: "Updated Room",
      url: "https://meet.google.com/xyz-uvwx-yz",
      description: null,
      isDefault: false,
      createdBy: { id: LEADER_ID, fullName: "Leader A" },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const updated = await updateMeetLinkService(leaderActor, PROJECT_ID, LINK_ID, {
      label: "Updated Room",
      url: "https://meet.google.com/xyz-uvwx-yz",
    });
    expect(updated.label).toBe("Updated Room");

    const deleted = await deleteMeetLinkService(leaderActor, PROJECT_ID, LINK_ID);
    expect(deleted).toEqual({ id: LINK_ID, projectId: PROJECT_ID });
  });
});
