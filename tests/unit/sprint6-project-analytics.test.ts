import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ProjectMemberRole,
  ProjectStatus,
  ReviewDecision,
  SprintStatus,
  TaskPriority,
  TaskStatus,
  UserStatus,
} from "@prisma/client";
import { PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import {
  analyticsQuerySchema,
  memberContributionQuerySchema,
  resolveAnalyticsDateWindow,
} from "@/modules/reports/report.schema";
import { computeProjectTimelineProgress } from "@/modules/projects/project-progress";
import type { AuthContext } from "@/types/auth";

vi.mock("server-only", () => ({}));

const { prismaMock, projectAccessMock, projectAnalyticsRepoMock } = vi.hoisted(() => ({
  prismaMock: {},
  projectAccessMock: {
    parseProjectId: vi.fn((id: string) => id),
    assertProjectReadAccess: vi.fn(),
  },
  projectAnalyticsRepoMock: {
    findProjectOriginMeta: vi.fn(),
    loadProjectAnalyticsSource: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/modules/projects/project.access", () => projectAccessMock);

vi.mock("@/modules/reports/project-analytics.repository", () => ({
  projectAnalyticsRepository: projectAnalyticsRepoMock,
}));

import {
  computeProjectAnalytics,
  getProjectAnalyticsService,
} from "@/modules/reports/project-analytics.service";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

const memberActor: AuthContext = {
  userId: "22222222-2222-4222-8222-222222222201",
  email: "member@akatsuki.local",
  fullName: "Member User",
  status: UserStatus.ACTIVE,
  roles: [ROLES.MEMBER],
  permissions: [PERMISSIONS.PROJECT_READ, PERMISSIONS.REPORT_READ],
};

const unauthorizedActor: AuthContext = {
  userId: "22222222-2222-4222-8222-222222222202",
  email: "limited@akatsuki.local",
  fullName: "Limited User",
  status: UserStatus.ACTIVE,
  roles: [ROLES.MEMBER],
  permissions: [PERMISSIONS.PROJECT_READ],
};

describe("Sprint 6 Package 4 — Project Aggregate Analytics & Date Windows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Date Window Validation & Weekly Switching (DEC-057)", () => {
    it("enforces 365-day custom max, valid ranges, and includeRemoved default", () => {
      expect(
        analyticsQuerySchema.safeParse({
          preset: "custom",
          from: "2025-01-01",
          to: "2026-01-05",
        }).success
      ).toBe(false);

      expect(
        analyticsQuerySchema.safeParse({
          preset: "custom",
          from: "2026-11-10",
          to: "2026-11-01",
        }).success
      ).toBe(false);

      expect(
        analyticsQuerySchema.safeParse({
          preset: "custom",
          from: "2026-02-30",
          to: "2026-03-05",
        }).success
      ).toBe(false);

      const memberParsed = memberContributionQuerySchema.safeParse({ includeRemoved: "false" });
      expect(memberParsed.success).toBe(true);
      if (memberParsed.success) {
        expect(memberParsed.data.includeRemoved).toBe(false);
      }
      const memberDefault = memberContributionQuerySchema.safeParse({});
      expect(memberDefault.success && memberDefault.data.includeRemoved).toBe(true);
    });

    it("switches automatically from daily (<= 90d) to ISO Monday weekly (> 90d) and clamps 'all' at 365 days", () => {
      const refNow = new Date("2026-11-15T10:00:00+07:00");

      const w90 = resolveAnalyticsDateWindow({ preset: "90d" }, {}, refNow);
      expect(w90.spanDays).toBe(90);
      expect(w90.granularity).toBe("day");
      expect(w90.bucketKeys).toHaveLength(90);

      const w91 = resolveAnalyticsDateWindow(
        { preset: "custom", from: "2026-08-17", to: "2026-11-15" },
        {},
        refNow
      );
      expect(w91.spanDays).toBe(91);
      expect(w91.granularity).toBe("week");
      expect(w91.bucketKeys[0]).toBe("2026-08-17");

      const wAllClamped = resolveAnalyticsDateWindow(
        { preset: "all" },
        {
          startDate: new Date("2025-01-01T00:00:00.000Z"),
          createdAt: new Date("2025-01-01T00:00:00.000Z"),
        },
        refNow
      );
      expect(wAllClamped.wasClampedTo365Days).toBe(true);
      expect(wAllClamped.spanDays).toBe(365);
      expect(wAllClamped.granularity).toBe("week");
    });
  });

  describe("2. Project Timeline Progress Edge Cases (DEC-051)", () => {
    it("handles missing dates, startDate == endDate, before-start, within-window, and past-end cleanly", () => {
      const now = new Date("2026-11-15T09:00:00+07:00");

      const missing = computeProjectTimelineProgress(null, new Date("2026-11-20T00:00:00Z"), now);
      expect(missing.hasTimelineDates).toBe(false);
      expect(missing.state).toBe("NO_DATES");
      expect(missing.progressPercent).toBeNull();

      const sameDay = computeProjectTimelineProgress(
        new Date("2026-11-15T00:00:00Z"),
        new Date("2026-11-15T00:00:00Z"),
        now
      );
      expect(sameDay.totalDays).toBe(1);
      expect(sameDay.progressPercent).toBe(100);
      expect(sameDay.state).toBe("IN_WINDOW");

      const future = computeProjectTimelineProgress(
        new Date("2026-11-20T00:00:00Z"),
        new Date("2026-11-30T00:00:00Z"),
        now
      );
      expect(future.state).toBe("NOT_STARTED");
      expect(future.progressPercent).toBe(0);

      const past = computeProjectTimelineProgress(
        new Date("2026-11-01T00:00:00Z"),
        new Date("2026-11-10T00:00:00Z"),
        now
      );
      expect(past.state).toBe("PAST_END_DATE");
      expect(past.overdueDays).toBe(5);
      expect(past.progressPercent).toBe(100);
    });
  });

  describe("3. Aggregate Analytics Computation & DEC-052 Privacy Isolation", () => {
    it("builds all 6 aggregate analytics blocks including overdue aging buckets and unestimated counts without exposing individual breakdowns", () => {
      const refNow = new Date("2026-11-15T12:00:00+07:00");
      const window = resolveAnalyticsDateWindow(
        { preset: "custom", from: "2026-11-10", to: "2026-11-15" },
        {},
        refNow
      );

      const dto = computeProjectAnalytics(
        {
          project: {
            id: PROJECT_ID,
            name: "Analytics Alpha",
            status: ProjectStatus.ARCHIVED,
            startDate: new Date("2026-11-01T00:00:00.000Z"),
            endDate: new Date("2026-11-30T00:00:00.000Z"),
            createdAt: new Date("2026-10-25T00:00:00.000Z"),
          },
          earliestTaskCreatedAt: new Date("2026-11-01T08:00:00+07:00"),
          statusCounts: {
            [TaskStatus.TODO]: 2,
            [TaskStatus.IN_PROGRESS]: 3,
            [TaskStatus.REVIEW]: 1,
            [TaskStatus.DONE]: 4,
          },
          priorityMatrix: [
            {
              priority: TaskPriority.CRITICAL,
              status: TaskStatus.IN_PROGRESS,
              count: 2,
              estimateHours: 10,
            },
            { priority: TaskPriority.HIGH, status: TaskStatus.DONE, count: 4, estimateHours: 20 },
            { priority: TaskPriority.MEDIUM, status: TaskStatus.TODO, count: 2, estimateHours: 0 },
            {
              priority: TaskPriority.LOW,
              status: TaskStatus.IN_PROGRESS,
              count: 1,
              estimateHours: 4,
            },
            { priority: TaskPriority.LOW, status: TaskStatus.REVIEW, count: 1, estimateHours: 2 },
          ],
          overdueActiveTasks: [
            {
              id: "t1",
              status: TaskStatus.TODO,
              deadline: new Date("2026-11-14T12:00:00+07:00"), // 1 day -> 1-3d
            },
            {
              id: "t2",
              status: TaskStatus.IN_PROGRESS,
              deadline: new Date("2026-11-10T12:00:00+07:00"), // 5 days -> 4-7d
            },
            {
              id: "t3",
              status: TaskStatus.REVIEW,
              deadline: new Date("2026-11-05T12:00:00+07:00"), // 10 days -> 8-14d
            },
            {
              id: "t4",
              status: TaskStatus.IN_PROGRESS,
              deadline: new Date("2026-10-25T12:00:00+07:00"), // 21 days -> >14d
            },
          ],
          createdBuckets: [
            { bucketKey: "2026-11-11", count: 3 },
            { bucketKey: "2026-11-14", count: 2 },
          ],
          completedBuckets: [{ bucketKey: "2026-11-14", count: 2 }],
          completedBeforeWindowCount: 2,
          reviewBuckets: [
            { bucketKey: "2026-11-14", decision: ReviewDecision.APPROVED, count: 3 },
            { bucketKey: "2026-11-14", decision: ReviewDecision.REJECTED, count: 1 },
          ],
          totalProjectReviews: [
            { decision: ReviewDecision.APPROVED, count: 6 },
            { decision: ReviewDecision.REJECTED, count: 2 },
          ],
          overdueSlipBuckets: [
            { bucketKey: "2026-11-10", overdueActiveCount: 1, lateCompletedCount: 1 },
          ],
          sprintWorkloadRows: [
            {
              sprintId: "s1",
              sprintName: "Sprint 1",
              sprintStatus: SprintStatus.ACTIVE,
              status: TaskStatus.DONE,
              taskCount: 4,
              estimatedTaskCount: 4,
              estimateHours: 20,
            },
            {
              sprintId: null,
              sprintName: null,
              sprintStatus: null,
              status: TaskStatus.TODO,
              taskCount: 6,
              estimatedTaskCount: 4,
              estimateHours: 16,
            },
          ],
          activeSprint: {
            id: "s1",
            name: "Sprint 1",
            startDate: new Date("2026-11-10T00:00:00Z"),
            endDate: new Date("2026-11-20T00:00:00Z"),
            totalTasks: 4,
            doneTasks: 4,
          },
        },
        window,
        refNow
      );

      expect(dto.isReadOnly).toBe(true);
      expect(dto.privacyScope).toBe("PROJECT_AGGREGATE_ONLY");
      expect(dto.summary.totalTasks).toBe(10);
      expect(dto.summary.taskWorkProgressPercent).toBe(40);
      expect(dto.summary.projectTimelineProgress.progressPercent).toBe(50);
      expect(dto.summary.overdueTasks).toBe(4);
      expect(dto.summary.overallReviewApprovalRatePercent).toBe(75);

      expect(dto.completionTrend).toHaveLength(6);
      expect(dto.completionTrend[0].cumulativeCompletedCount).toBe(2);
      expect(dto.completionTrend[4]).toMatchObject({
        bucketKey: "2026-11-14",
        createdCount: 2,
        completedCount: 2,
        cumulativeCompletedCount: 4,
      });

      expect(dto.reviewAnalytics.summary.approvalRateInWindowPercent).toBe(75);
      expect(dto.reviewAnalytics.summary.reworkRateInWindowPercent).toBe(25);

      expect(dto.overdueAnalytics.agingBuckets.map((b) => b.count)).toEqual([1, 1, 1, 1]);
      expect(dto.workloadSummary.totalPlannedEstimateHours).toBe(36);
      expect(dto.workloadSummary.unestimatedTaskCount).toBe(2);
      expect(dto.workloadSummary.estimateCoveragePercent).toBe(80);
      expect(dto.workloadSummary.bySprint[1].sprintStatus).toBe("BACKLOG");

      // Strict DEC-052 check: serialized payload must not contain member arrays
      const serialized = JSON.stringify(dto);
      expect(serialized).not.toContain("assignee");
    });

    it("authorizes MEMBER for project-level aggregate analytics while blocking missing REPORT_READ", async () => {
      await expect(
        getProjectAnalyticsService(unauthorizedActor, PROJECT_ID, {})
      ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });

      projectAccessMock.assertProjectReadAccess.mockResolvedValue({
        project: { id: PROJECT_ID, status: ProjectStatus.ACTIVE },
        memberRole: ProjectMemberRole.MEMBER,
        isWorkspaceAdmin: false,
      });
      projectAnalyticsRepoMock.findProjectOriginMeta.mockResolvedValue({
        project: {
          id: PROJECT_ID,
          name: "Member Visible Proj",
          status: ProjectStatus.ACTIVE,
          startDate: null,
          endDate: null,
          createdAt: new Date("2026-11-01T00:00:00Z"),
        },
        earliestTaskCreatedAt: null,
      });
      projectAnalyticsRepoMock.loadProjectAnalyticsSource.mockResolvedValue({
        project: {
          id: PROJECT_ID,
          name: "Member Visible Proj",
          status: ProjectStatus.ACTIVE,
          startDate: null,
          endDate: null,
          createdAt: new Date("2026-11-01T00:00:00Z"),
        },
        earliestTaskCreatedAt: null,
        statusCounts: {
          [TaskStatus.TODO]: 0,
          [TaskStatus.IN_PROGRESS]: 0,
          [TaskStatus.REVIEW]: 0,
          [TaskStatus.DONE]: 0,
        },
        priorityMatrix: [],
        overdueActiveTasks: [],
        createdBuckets: [],
        completedBuckets: [],
        completedBeforeWindowCount: 0,
        reviewBuckets: [],
        totalProjectReviews: [],
        overdueSlipBuckets: [],
        sprintWorkloadRows: [],
        activeSprint: null,
        activeSprints: [],
      });

      const res = await getProjectAnalyticsService(memberActor, PROJECT_ID, { preset: "7d" });
      expect(res.projectId).toBe(PROJECT_ID);
      expect(res.privacyScope).toBe("PROJECT_AGGREGATE_ONLY");
    });

    it("preserves multiple concurrent ACTIVE sprints in summary.activeSprints (DEC-006)", () => {
      const refNow = new Date("2026-11-15T12:00:00+07:00");
      const window = resolveAnalyticsDateWindow(
        { preset: "7d" },
        {
          startDate: new Date("2026-11-01T00:00:00Z"),
          createdAt: new Date("2026-10-25T00:00:00Z"),
          earliestTaskCreatedAt: new Date("2026-11-01T08:00:00+07:00"),
        },
        refNow
      );

      const multiSprintDto = computeProjectAnalytics(
        {
          project: {
            id: PROJECT_ID,
            name: "Multi Sprint Project",
            status: ProjectStatus.ACTIVE,
            startDate: new Date("2026-11-01T00:00:00Z"),
            endDate: new Date("2026-11-30T00:00:00Z"),
            createdAt: new Date("2026-10-25T00:00:00Z"),
          },
          earliestTaskCreatedAt: new Date("2026-11-01T08:00:00+07:00"),
          statusCounts: {
            [TaskStatus.TODO]: 2,
            [TaskStatus.IN_PROGRESS]: 1,
            [TaskStatus.REVIEW]: 0,
            [TaskStatus.DONE]: 3,
          },
          priorityMatrix: [],
          overdueActiveTasks: [],
          createdBuckets: [],
          completedBuckets: [],
          completedBeforeWindowCount: 0,
          reviewBuckets: [],
          totalProjectReviews: [],
          overdueSlipBuckets: [],
          sprintWorkloadRows: [],
          activeSprint: {
            id: "s1",
            name: "Sprint 1 - API",
            startDate: new Date("2026-11-01T00:00:00Z"),
            endDate: new Date("2026-11-18T00:00:00Z"),
            totalTasks: 4,
            doneTasks: 2,
          },
          activeSprints: [
            {
              id: "s1",
              name: "Sprint 1 - API",
              startDate: new Date("2026-11-01T00:00:00Z"),
              endDate: new Date("2026-11-18T00:00:00Z"),
              totalTasks: 4,
              doneTasks: 2,
            },
            {
              id: "s2",
              name: "Sprint 2 - UI",
              startDate: new Date("2026-11-05T00:00:00Z"),
              endDate: new Date("2026-11-22T00:00:00Z"),
              totalTasks: 2,
              doneTasks: 1,
            },
          ],
        },
        window,
        refNow
      );

      expect(multiSprintDto.summary.activeSprint?.id).toBe("s1");
      expect(multiSprintDto.summary.activeSprints).toHaveLength(2);
      expect(multiSprintDto.summary.activeSprints.map((s) => s.name)).toEqual([
        "Sprint 1 - API",
        "Sprint 2 - UI",
      ]);
      expect(multiSprintDto.summary.activeSprints[0].progressPercent).toBe(50);
    });
  });
});
