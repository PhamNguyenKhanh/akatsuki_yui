import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ProjectMemberRole,
  ProjectStatus,
  ReviewDecision,
  TaskHistoryAction,
  TaskStatus,
  UserStatus,
} from "@prisma/client";
import { PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import { resolveAnalyticsDateWindow } from "@/modules/reports/report.schema";
import type { AuthContext } from "@/types/auth";

vi.mock("server-only", () => ({}));

const { prismaMock, projectAccessMock, memberContribRepoMock } = vi.hoisted(() => ({
  prismaMock: {},
  projectAccessMock: {
    parseProjectId: vi.fn((id: string) => id),
    assertProjectReadAccess: vi.fn(),
    isWorkspaceAdmin: vi.fn((actor: AuthContext) => actor.roles.includes(ROLES.ADMIN)),
  },
  memberContribRepoMock: {
    findProjectMetaForMembers: vi.fn(),
    loadMemberContributionSource: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/modules/projects/project.access", () => projectAccessMock);

vi.mock("@/modules/reports/member-contribution.repository", () => ({
  memberContributionRepository: memberContribRepoMock,
}));

import {
  computeMemberContributionReport,
  getMemberContributionReportService,
} from "@/modules/reports/member-contribution.service";
import type { MemberContributionSourceData } from "@/modules/reports/member-contribution.repository";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const LEADER_ID = "22222222-2222-4222-8222-222222222201";
const MEMBER_1_ID = "22222222-2222-4222-8222-222222222202";
const MEMBER_2_ID = "22222222-2222-4222-8222-222222222203";
const DEPARTED_ID = "22222222-2222-4222-8222-222222222204";

const leaderActor: AuthContext = {
  userId: LEADER_ID,
  email: "leader@akatsuki.local",
  fullName: "Leader User",
  status: UserStatus.ACTIVE,
  roles: [ROLES.LEADER],
  permissions: [PERMISSIONS.PROJECT_READ, PERMISSIONS.REPORT_READ],
};

const member1Actor: AuthContext = {
  userId: MEMBER_1_ID,
  email: "m1@akatsuki.local",
  fullName: "Member One",
  status: UserStatus.ACTIVE,
  roles: [ROLES.MEMBER],
  permissions: [PERMISSIONS.PROJECT_READ, PERMISSIONS.REPORT_READ],
};

function makeFixtureSource(): MemberContributionSourceData {
  return {
    project: {
      id: PROJECT_ID,
      name: "Non-Additive Test Project",
      status: ProjectStatus.ACTIVE,
      startDate: new Date("2026-11-01T00:00:00.000Z"),
      createdAt: new Date("2026-11-01T00:00:00.000Z"),
      leaderId: LEADER_ID,
      instructorId: null,
      leader: { id: LEADER_ID, fullName: "Leader User", email: "leader@akatsuki.local" },
      instructor: null,
      members: [
        {
          id: "pm-1",
          userId: LEADER_ID,
          projectRole: ProjectMemberRole.LEADER,
          joinedAt: new Date("2026-11-01T00:00:00.000Z"),
          leftAt: null,
          user: { id: LEADER_ID, fullName: "Leader User", email: "leader@akatsuki.local" },
        },
        {
          id: "pm-2",
          userId: MEMBER_1_ID,
          projectRole: ProjectMemberRole.MEMBER,
          joinedAt: new Date("2026-11-01T00:00:00.000Z"),
          leftAt: null,
          user: { id: MEMBER_1_ID, fullName: "Member One", email: "m1@akatsuki.local" },
        },
        {
          id: "pm-3",
          userId: MEMBER_2_ID,
          projectRole: ProjectMemberRole.MEMBER,
          joinedAt: new Date("2026-11-01T00:00:00.000Z"),
          leftAt: null,
          user: { id: MEMBER_2_ID, fullName: "Member Two", email: "m2@akatsuki.local" },
        },
        {
          id: "pm-4",
          userId: DEPARTED_ID,
          projectRole: ProjectMemberRole.MEMBER,
          joinedAt: new Date("2026-11-01T00:00:00.000Z"),
          leftAt: new Date("2026-11-10T10:00:00+07:00"),
          user: { id: DEPARTED_ID, fullName: "Departed Member", email: "departed@akatsuki.local" },
        },
      ],
    },
    earliestTaskCreatedAt: new Date("2026-11-01T08:00:00+07:00"),
    tasks: [
      // Task 1: DONE, Sole assigned to Member 1 (8h), plus Member 1 also had a removed episode earlier on this task!
      {
        id: "t1",
        status: TaskStatus.DONE,
        deadline: new Date("2026-11-20T00:00:00+07:00"),
        estimateHours: 8,
        createdAt: new Date("2026-11-02T00:00:00+07:00"),
        completedAt: new Date("2026-11-12T10:00:00+07:00"),
        assignees: [
          {
            id: "a1-old",
            userId: MEMBER_1_ID,
            assignedAt: new Date("2026-11-02T08:00:00+07:00"),
            removedAt: new Date("2026-11-03T08:00:00+07:00"),
            user: { id: MEMBER_1_ID, fullName: "Member One", email: "m1@akatsuki.local" },
          },
          {
            id: "a1-cur",
            userId: MEMBER_1_ID,
            assignedAt: new Date("2026-11-04T08:00:00+07:00"),
            removedAt: null,
            user: { id: MEMBER_1_ID, fullName: "Member One", email: "m1@akatsuki.local" },
          },
        ],
      },
      // Task 2: DONE, Co-assigned to Member 1 + Member 2 (10h)
      {
        id: "t2",
        status: TaskStatus.DONE,
        deadline: new Date("2026-11-20T00:00:00+07:00"),
        estimateHours: 10,
        createdAt: new Date("2026-11-03T00:00:00+07:00"),
        completedAt: new Date("2026-11-13T10:00:00+07:00"),
        assignees: [
          {
            id: "a2-m1",
            userId: MEMBER_1_ID,
            assignedAt: new Date("2026-11-03T08:00:00+07:00"),
            removedAt: null,
            user: { id: MEMBER_1_ID, fullName: "Member One", email: "m1@akatsuki.local" },
          },
          {
            id: "a2-m2",
            userId: MEMBER_2_ID,
            assignedAt: new Date("2026-11-03T08:00:00+07:00"),
            removedAt: null,
            user: { id: MEMBER_2_ID, fullName: "Member Two", email: "m2@akatsuki.local" },
          },
        ],
      },
      // Task 3: DONE, Departed Member STILL has removedAt === null (P1-03 test!)
      // PLUS Member 2 was assigned -> removed twice on Task 3 (P0-02 distinct vs episode test!)
      {
        id: "t3",
        status: TaskStatus.DONE,
        deadline: new Date("2026-11-20T00:00:00+07:00"),
        estimateHours: 5,
        createdAt: new Date("2026-11-04T00:00:00+07:00"),
        completedAt: new Date("2026-11-09T10:00:00+07:00"),
        assignees: [
          {
            id: "a3-dep",
            userId: DEPARTED_ID,
            assignedAt: new Date("2026-11-04T08:00:00+07:00"),
            removedAt: null,
            user: {
              id: DEPARTED_ID,
              fullName: "Departed Member",
              email: "departed@akatsuki.local",
            },
          },
          {
            id: "a3-m2-ep1",
            userId: MEMBER_2_ID,
            assignedAt: new Date("2026-11-04T09:00:00+07:00"),
            removedAt: new Date("2026-11-05T09:00:00+07:00"),
            user: { id: MEMBER_2_ID, fullName: "Member Two", email: "m2@akatsuki.local" },
          },
          {
            id: "a3-m2-ep2",
            userId: MEMBER_2_ID,
            assignedAt: new Date("2026-11-06T09:00:00+07:00"),
            removedAt: new Date("2026-11-07T09:00:00+07:00"),
            user: { id: MEMBER_2_ID, fullName: "Member Two", email: "m2@akatsuki.local" },
          },
        ],
      },
      // Task 4: Overdue IN_PROGRESS assigned to Member 1 (no estimateHours)
      {
        id: "t4",
        status: TaskStatus.IN_PROGRESS,
        deadline: new Date("2026-11-12T00:00:00+07:00"),
        estimateHours: null,
        createdAt: new Date("2026-11-05T00:00:00+07:00"),
        completedAt: null,
        assignees: [
          {
            id: "a4-m1",
            userId: MEMBER_1_ID,
            assignedAt: new Date("2026-11-05T08:00:00+07:00"),
            removedAt: null,
            user: { id: MEMBER_1_ID, fullName: "Member One", email: "m1@akatsuki.local" },
          },
        ],
      },
    ],
    taskHistoryActionsInWindow: [
      { actorId: MEMBER_1_ID, action: TaskHistoryAction.STATUS_CHANGED, count: 4 },
      { actorId: MEMBER_1_ID, action: TaskHistoryAction.PROGRESS_UPDATED, count: 2 },
      { actorId: LEADER_ID, action: TaskHistoryAction.REVIEW_APPROVED, count: 3 },
    ],
    taskReviewsInWindow: [{ reviewerId: LEADER_ID, decision: ReviewDecision.APPROVED, count: 3 }],
    activityLogsInWindow: [{ userId: LEADER_ID, count: 2 }],
  };
}

describe("Sprint 6 Package 5 — Objective Non-Additive Member Contribution Report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("separates Sole vs Co-Assigned non-additively, counts DISTINCT historical taskIds separately from episode counts (P0-02), and moves departed DONE tasks out of currentAssigned (P1-03)", () => {
    const refNow = new Date("2026-11-15T10:00:00+07:00");
    const window = resolveAnalyticsDateWindow({ preset: "30d" }, {}, refNow);
    const report = computeMemberContributionReport(makeFixtureSource(), window, {
      viewScope: "ALL_MEMBERS",
      viewerUserId: LEADER_ID,
      includeRemoved: true,
      referenceNow: refNow,
    });

    expect(report.hasDepartedMembers).toBe(true);
    expect(report.projectTotals).toMatchObject({
      totalTasks: 4,
      doneTasks: 3,
      overdueTasks: 1,
      soleAssignedTasks: 2, // t1 (m1), t4 (m1)
      coAssignedTasks: 1, // t2 (m1 + m2)
      unassignedTasks: 1, // t3 (departed only!)
      totalPlannedEstimateHours: 23,
      unestimatedTaskCount: 1,
    });

    const m1 = report.members.find((m) => m.userId === MEMBER_1_ID)!;
    expect(m1.membershipStatus).toBe("ACTIVE");
    expect(m1.currentAssigned).toMatchObject({
      total: 3, // t1, t2, t4
      soleAssignedCount: 2,
      coAssignedCount: 1,
      completedCount: 2, // t1, t2
      completedSoleCount: 1,
      completedCoAssignedCount: 1,
      inProgressCount: 1,
      overdueCount: 1,
    });
    expect(m1.currentAssigned.plannedEstimateHours).toMatchObject({
      total: 18,
      sole: 8,
      coAssigned: 10,
      estimatedTaskCount: 2,
      unestimatedTaskCount: 1,
    });
    // T1 was also previously unassigned then reassigned: totalAssignmentEpisodes = 4 (a1-old, a1-cur, a2, a4), unique = 3
    expect(m1.historicalAssignments.uniqueTasksEverAssigned).toBe(3);
    expect(m1.historicalAssignments.removedOrDepartedEpisodeCount).toBe(1);
    expect(m1.historicalAssignments.totalAssignmentEpisodes).toBe(4);
    expect(m1.verifiableActivity).toMatchObject({
      taskHistoryActionsTotal: 6,
      statusTransitionsCount: 4,
      progressUpdatesCount: 2,
    });

    // P0-02 check on Member 2: removed twice from t3 => formerTasksDistinctCount = 1, removedOrDepartedEpisodeCount = 2!
    const m2 = report.members.find((m) => m.userId === MEMBER_2_ID)!;
    expect(m2.currentAssigned.total).toBe(1); // t2 only (co-assigned)
    expect(m2.currentAssigned.coAssignedCount).toBe(1);
    expect(m2.historicalAssignments).toMatchObject({
      formerTasksDistinctCount: 1, // DISTINCT task t3!
      historicalDoneDistinctCount: 1,
      uniqueTasksEverAssigned: 2, // t2 + t3
      removedOrDepartedEpisodeCount: 2, // 2 removed episodes on t3
      totalAssignmentEpisodes: 3, // 1 active + 2 removed
    });

    // P1-03 check on Departed Member: t3 has removedAt === null in DB, yet departed user -> 0 currentAssigned, moved to historical!
    const dep = report.members.find((m) => m.userId === DEPARTED_ID)!;
    expect(dep.membershipStatus).toBe("LEFT_PROJECT");
    expect(dep.membershipBadge).toBe("Đã rời Project");
    expect(dep.currentAssigned.total).toBe(0);
    expect(dep.historicalAssignments.formerTasksDistinctCount).toBe(1);
    expect(dep.historicalAssignments.historicalDoneDistinctCount).toBe(1);
    expect(dep.historicalAssignments.removedOrDepartedEpisodeCount).toBe(1);
  });

  it("hides departed members when includeRemoved is false, and enforces strict SELF_ONLY isolation for MEMBER (DEC-052)", async () => {
    const source = makeFixtureSource();

    projectAccessMock.assertProjectReadAccess.mockResolvedValue({
      id: PROJECT_ID,
      status: ProjectStatus.ACTIVE,
      leaderId: LEADER_ID,
      instructorId: null,
      members: [{ id: "pm-1", projectRole: ProjectMemberRole.LEADER }],
    });
    memberContribRepoMock.findProjectMetaForMembers.mockResolvedValue({
      project: source.project,
      earliestTaskCreatedAt: source.earliestTaskCreatedAt,
    });
    memberContribRepoMock.loadMemberContributionSource.mockResolvedValue(source);

    const leaderFiltered = await getMemberContributionReportService(leaderActor, PROJECT_ID, {
      includeRemoved: "false",
    });
    expect(leaderFiltered.viewScope).toBe("ALL_MEMBERS");
    expect(leaderFiltered.members.map((m) => m.userId)).not.toContain(DEPARTED_ID);

    projectAccessMock.assertProjectReadAccess.mockResolvedValue({
      id: PROJECT_ID,
      status: ProjectStatus.ACTIVE,
      leaderId: LEADER_ID,
      instructorId: null,
      members: [{ id: "pm-2", projectRole: ProjectMemberRole.MEMBER }],
    });

    const memberSelf = await getMemberContributionReportService(member1Actor, PROJECT_ID, {
      preset: "30d",
    });
    expect(memberSelf.viewScope).toBe("SELF_ONLY");
    expect(memberSelf.members).toHaveLength(1);
    expect(memberSelf.members[0].userId).toBe(MEMBER_1_ID);
    // Co-assigned awareness still works on Member 1's own row without exposing peer rows
    expect(memberSelf.members[0].currentAssigned.coAssignedCount).toBe(1);
    expect(JSON.stringify(memberSelf.members)).not.toContain(MEMBER_2_ID);
  });
});
