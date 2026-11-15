import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ProjectMemberRole,
  SprintStatus,
  TaskHistoryAction,
  TaskStatus,
  UserStatus,
} from "@prisma/client";
import { PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import {
  groupAndSortEstimateEvents,
  resolveSprintTasksEstimatesAt,
  resolveTaskEstimateAt,
} from "@/modules/sprints/estimate-reconstruction";
import { computeSprintBurndownAnalytics } from "@/modules/sprints/sprint-analytics.service";
import type { AuthContext } from "@/types/auth";

vi.mock("server-only", () => ({}));

const { prismaMock, projectAccessMock, sprintReportRepoMock } = vi.hoisted(() => ({
  prismaMock: {},
  projectAccessMock: {
    parseProjectId: vi.fn((id: string) => id),
    assertProjectReadAccess: vi.fn(),
  },
  sprintReportRepoMock: {
    findProjectSprintReportSource: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/modules/projects/project.access", () => projectAccessMock);

vi.mock("@/modules/reports/sprint-report.repository", () => ({
  sprintReportRepository: sprintReportRepoMock,
}));

import {
  computeProjectSprintReport,
  getProjectSprintReportService,
} from "@/modules/reports/sprint-report.service";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const SPRINT_1_ID = "22222222-2222-4222-8222-222222222221";
const SPRINT_2_ID = "22222222-2222-4222-8222-222222222222";
const TASK_A = "33333333-3333-4333-8333-333333333301";
const TASK_B = "33333333-3333-4333-8333-333333333302";
const TASK_C = "33333333-3333-4333-8333-333333333303";
const TASK_D = "33333333-3333-4333-8333-333333333304";
const TASK_E = "33333333-3333-4333-8333-333333333305";

const memberActor: AuthContext = {
  userId: "44444444-4444-4444-8444-444444444401",
  email: "member@akatsuki.local",
  fullName: "Member User",
  status: UserStatus.ACTIVE,
  roles: [ROLES.MEMBER],
  permissions: [PERMISSIONS.PROJECT_READ, PERMISSIONS.REPORT_READ],
};

const unauthorizedActor: AuthContext = {
  userId: "44444444-4444-4444-8444-444444444402",
  email: "limited@akatsuki.local",
  fullName: "Limited User",
  status: UserStatus.ACTIVE,
  roles: [ROLES.MEMBER],
  permissions: [PERMISSIONS.PROJECT_READ],
};

describe("Sprint 6 Package 3 — Sprint Commitment, Estimate Reconstruction & Burndown Fix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. P0-01 Historical Estimate Reconstruction", () => {
    it("rolls back multi-step INFO_UPDATED diffs accurately across timestamps and freezes past completion edits", () => {
      // Timeline of TASK_A estimateHours:
      // Day 1 (Nov 1 08:00): 4h
      // Day 3 (Nov 3 10:00): 4h -> 6h
      // Day 6 (Nov 6 12:00, after sprint closed Nov 5): 6h -> 20h
      const events = [
        {
          id: "e2",
          taskId: TASK_A,
          action: TaskHistoryAction.INFO_UPDATED,
          oldValue: { estimateHours: 6 },
          newValue: { estimateHours: 20 },
          createdAt: new Date("2026-11-06T12:00:00+07:00"),
        },
        {
          id: "e1",
          taskId: TASK_A,
          action: TaskHistoryAction.INFO_UPDATED,
          oldValue: { estimateHours: 4 },
          newValue: { estimateHours: 6 },
          createdAt: new Date("2026-11-03T10:00:00+07:00"),
        },
        {
          id: "e0",
          taskId: TASK_A,
          action: TaskHistoryAction.INFO_UPDATED,
          oldValue: { title: "Old" },
          newValue: { title: "New" },
          createdAt: new Date("2026-11-04T09:00:00+07:00"),
        },
      ];

      const task = { id: TASK_A, estimateHours: 20 };
      const freezeAt = new Date("2026-11-05T17:00:00+07:00");

      const atDay1 = resolveTaskEstimateAt(
        task,
        events,
        new Date("2026-11-01T23:59:59+07:00"),
        undefined,
        freezeAt
      );
      expect(atDay1.estimateHours).toBe(4);
      expect(atDay1.source).toBe("RECONSTRUCTED_FROM_DIFFS");
      expect(atDay1.isExact).toBe(true);
      expect(atDay1.hasPostFreezeEstimateEdit).toBe(true);

      const atDay5Closure = resolveTaskEstimateAt(task, events, freezeAt, undefined, freezeAt);
      expect(atDay5Closure.estimateHours).toBe(6);
      expect(atDay5Closure.source).toBe("RECONSTRUCTED_FROM_DIFFS");
      expect(atDay5Closure.isExact).toBe(true);

      const atDay8 = resolveTaskEstimateAt(
        task,
        events,
        new Date("2026-11-08T23:59:59+07:00"),
        undefined,
        freezeAt
      );
      expect(atDay8.estimateHours).toBe(20);
      expect(atDay8.source).toBe("CURRENT_VALUE");
    });

    it("detects INCOMPLETE_HISTORY when current task value disagrees with latest diff chain", () => {
      const grouped = groupAndSortEstimateEvents([
        {
          id: "e-gap",
          taskId: TASK_B,
          action: TaskHistoryAction.INFO_UPDATED,
          oldValue: { estimateHours: 4 },
          newValue: { estimateHours: 8 },
          createdAt: new Date("2026-11-04T10:00:00+07:00"),
        },
      ]);

      const aggregated = resolveSprintTasksEstimatesAt(
        [
          { id: TASK_B, estimateHours: 99 },
          { id: TASK_C, estimateHours: null },
        ],
        grouped,
        new Date("2026-11-02T12:00:00+07:00")
      );

      const resolvedB = aggregated.byTaskId.get(TASK_B)!;
      expect(resolvedB.source).toBe("INCOMPLETE_HISTORY");
      expect(resolvedB.isExact).toBe(false);
      expect(resolvedB.estimateHours).toBe(4);
      expect(aggregated.snapshotMode).toBe("INCOMPLETE_HISTORY");
      expect(aggregated.incompleteTaskIds).toEqual([TASK_B]);
      expect(aggregated.estimateCoveragePercent).toBe(50);
    });
  });

  describe("2. Burndown Chart Closure Rollover & Post-Completion Freeze", () => {
    it("preserves unfinished work on closure day without rollover drop to zero and stays immune to post-sprint estimate edits", () => {
      const analytics = computeSprintBurndownAnalytics(
        {
          sprint: {
            id: SPRINT_1_ID,
            projectId: PROJECT_ID,
            name: "Sprint 1",
            startDate: new Date("2026-11-01T00:00:00.000Z"),
            endDate: new Date("2026-11-05T00:00:00.000Z"),
            status: SprintStatus.COMPLETED,
            activatedAt: new Date("2026-11-01T08:00:00+07:00"),
            completedAt: new Date("2026-11-05T16:00:00+07:00"),
            cancelledAt: null,
            createdAt: new Date("2026-10-30T00:00:00Z"),
          },
          tasks: [
            {
              id: TASK_A,
              title: "Completed Day 3",
              status: TaskStatus.DONE,
              sprintId: SPRINT_1_ID,
              deadline: new Date("2026-11-05T00:00:00.000Z"),
              estimateHours: 8,
              completedAt: new Date("2026-11-03T15:00:00+07:00"),
              createdAt: new Date("2026-10-31T00:00:00Z"),
            },
            {
              id: TASK_B,
              title: "Rolled Over + Edited Later",
              status: TaskStatus.IN_PROGRESS,
              sprintId: null, // Rolled over to Backlog on Nov 5 16:00
              deadline: new Date("2026-11-05T00:00:00.000Z"),
              estimateHours: 20, // Later changed from 6h -> 20h on Nov 8!
              completedAt: null,
              createdAt: new Date("2026-10-31T00:00:00Z"),
            },
          ],
          historyEvents: [
            {
              id: "h1",
              taskId: TASK_A,
              action: TaskHistoryAction.SPRINT_ASSIGNED,
              oldValue: { sprintId: null },
              newValue: { sprintId: SPRINT_1_ID },
              createdAt: new Date("2026-11-01T07:30:00+07:00"),
            },
            {
              id: "h2",
              taskId: TASK_B,
              action: TaskHistoryAction.SPRINT_ASSIGNED,
              oldValue: { sprintId: null },
              newValue: { sprintId: SPRINT_1_ID },
              createdAt: new Date("2026-11-01T07:35:00+07:00"),
            },
            {
              id: "h3",
              taskId: TASK_B,
              action: TaskHistoryAction.SPRINT_REMOVED,
              oldValue: { sprintId: SPRINT_1_ID },
              newValue: { sprintId: null },
              metadata: { source: "SPRINT_COMPLETION", completedSprintId: SPRINT_1_ID },
              createdAt: new Date("2026-11-05T16:00:00+07:00"),
            },
          ],
          estimateHistoryEvents: [
            {
              id: "eh-post",
              taskId: TASK_B,
              action: TaskHistoryAction.INFO_UPDATED,
              oldValue: { estimateHours: 6 },
              newValue: { estimateHours: 20 },
              createdAt: new Date("2026-11-08T10:00:00+07:00"),
            },
            {
              id: "eh-mid",
              taskId: TASK_B,
              action: TaskHistoryAction.INFO_UPDATED,
              oldValue: { estimateHours: 4 },
              newValue: { estimateHours: 6 },
              createdAt: new Date("2026-11-03T10:00:00+07:00"),
            },
          ],
        },
        new Date("2026-11-10T10:00:00+07:00")
      );

      expect(analytics.burndown.hasEstimateData).toBe(true);
      expect(analytics.burndown.baselineHours).toBe(12); // Day 1: 8h + 4h
      expect(analytics.burndown.hasPostSprintEstimateEdits).toBe(true);
      expect(analytics.burndown.closureScopeHours).toBe(14); // 8h + 6h (immune to Nov 8 -> 20h edit!)
      expect(analytics.burndown.completedEstimateHours).toBe(8);
      expect(analytics.burndown.remainingEstimateHours).toBe(6);

      const d1 = analytics.burndown.points.find((p) => p.date === "2026-11-01")!;
      const d3 = analytics.burndown.points.find((p) => p.date === "2026-11-03")!;
      const d5 = analytics.burndown.points.find((p) => p.date === "2026-11-05")!;

      expect(d1.scopeHours).toBe(12);
      expect(d1.actualRemainingHours).toBe(12);
      expect(d3.scopeHours).toBe(14);
      expect(d3.actualRemainingHours).toBe(6);
      // Closure day keeps 6h unfinished instead of artificially dropping to 0h
      expect(d5.scopeHours).toBe(14);
      expect(d5.actualRemainingHours).toBe(6);
    });
  });

  describe("3. Six-Metric Sprint Commitment & Rollover Report (DEC-058)", () => {
    it("reconstructs baseline, added, removed, completed, backlog rollover, sprint rollover, and planned sprint state", () => {
      const report = computeProjectSprintReport({
        project: { id: PROJECT_ID, name: "Sprint Report Project", status: "ARCHIVED" },
        sprints: [
          {
            id: SPRINT_1_ID,
            projectId: PROJECT_ID,
            name: "Sprint 1",
            goal: "Core Setup",
            status: SprintStatus.COMPLETED,
            startDate: new Date("2026-11-01T00:00:00.000Z"),
            endDate: new Date("2026-11-07T00:00:00.000Z"),
            activatedAt: new Date("2026-11-01T08:00:00+07:00"),
            completedAt: new Date("2026-11-07T18:00:00+07:00"),
            cancelledAt: null,
            createdAt: new Date("2026-10-28T00:00:00Z"),
          },
          {
            id: SPRINT_2_ID,
            projectId: PROJECT_ID,
            name: "Sprint 2",
            goal: "Planned Next",
            status: SprintStatus.PLANNED,
            startDate: new Date("2026-11-08T00:00:00.000Z"),
            endDate: new Date("2026-11-14T00:00:00.000Z"),
            activatedAt: null,
            completedAt: null,
            cancelledAt: null,
            createdAt: new Date("2026-11-05T00:00:00Z"),
          },
        ],
        tasks: [
          // TASK_A: Baseline (5h) -> Completed in Sprint 1
          {
            id: TASK_A,
            title: "Task A",
            status: TaskStatus.DONE,
            sprintId: SPRINT_1_ID,
            estimateHours: 5,
            completedAt: new Date("2026-11-04T15:00:00+07:00"),
            createdAt: new Date("2026-10-30T00:00:00Z"),
          },
          // TASK_B: Baseline (8h) -> Rolled over to Sprint 2 on completion
          {
            id: TASK_B,
            title: "Task B",
            status: TaskStatus.IN_PROGRESS,
            sprintId: SPRINT_2_ID,
            estimateHours: 12, // Edited from 8h -> 12h after Sprint 1 closed
            completedAt: null,
            createdAt: new Date("2026-10-30T00:00:00Z"),
          },
          // TASK_C: Baseline (3h) -> Removed mid-sprint to Backlog
          {
            id: TASK_C,
            title: "Task C",
            status: TaskStatus.TODO,
            sprintId: null,
            estimateHours: 3,
            completedAt: null,
            createdAt: new Date("2026-10-30T00:00:00Z"),
          },
          // TASK_D: Added mid-sprint (6h) -> Rolled over to Backlog on completion
          {
            id: TASK_D,
            title: "Task D",
            status: TaskStatus.REVIEW,
            sprintId: null,
            estimateHours: 6,
            completedAt: null,
            createdAt: new Date("2026-11-02T09:00:00+07:00"),
          },
          // TASK_E: Added mid-sprint with null estimate -> Completed in Sprint 1
          {
            id: TASK_E,
            title: "Task E",
            status: TaskStatus.DONE,
            sprintId: SPRINT_1_ID,
            estimateHours: null,
            completedAt: new Date("2026-11-06T12:00:00+07:00"),
            createdAt: new Date("2026-11-03T09:00:00+07:00"),
          },
        ],
        sprintHistoryEvents: [
          {
            id: "sh1",
            taskId: TASK_C,
            action: TaskHistoryAction.SPRINT_REMOVED,
            oldValue: { sprintId: SPRINT_1_ID },
            newValue: { sprintId: null },
            metadata: { source: "PLANNING", sprintStatus: "ACTIVE", estimateHoursSnapshot: 3 },
            createdAt: new Date("2026-11-03T10:00:00+07:00"),
          },
          {
            id: "sh2",
            taskId: TASK_D,
            action: TaskHistoryAction.SPRINT_ASSIGNED,
            oldValue: { sprintId: null },
            newValue: { sprintId: SPRINT_1_ID },
            metadata: { source: "PLANNING", sprintStatus: "ACTIVE", estimateHoursSnapshot: 6 },
            createdAt: new Date("2026-11-02T11:00:00+07:00"),
          },
          {
            id: "sh3",
            taskId: TASK_E,
            action: TaskHistoryAction.SPRINT_ASSIGNED,
            oldValue: { sprintId: null },
            newValue: { sprintId: SPRINT_1_ID },
            metadata: { source: "PLANNING", sprintStatus: "ACTIVE", estimateHoursSnapshot: null },
            createdAt: new Date("2026-11-03T11:00:00+07:00"),
          },
          {
            id: "sh4",
            taskId: TASK_B,
            action: TaskHistoryAction.SPRINT_MOVED,
            oldValue: { sprintId: SPRINT_1_ID },
            newValue: { sprintId: SPRINT_2_ID },
            metadata: { source: "SPRINT_COMPLETION", completedSprintId: SPRINT_1_ID },
            createdAt: new Date("2026-11-07T18:00:00+07:00"),
          },
          {
            id: "sh5",
            taskId: TASK_D,
            action: TaskHistoryAction.SPRINT_REMOVED,
            oldValue: { sprintId: SPRINT_1_ID },
            newValue: { sprintId: null },
            metadata: { source: "SPRINT_COMPLETION", completedSprintId: SPRINT_1_ID },
            createdAt: new Date("2026-11-07T18:00:00+07:00"),
          },
        ],
        estimateHistoryEvents: [
          {
            id: "eh-b-post",
            taskId: TASK_B,
            action: TaskHistoryAction.INFO_UPDATED,
            oldValue: { estimateHours: 8 },
            newValue: { estimateHours: 12 },
            createdAt: new Date("2026-11-09T10:00:00+07:00"),
          },
        ],
        activationLogs: [
          {
            id: "act-1",
            entityId: SPRINT_1_ID,
            createdAt: new Date("2026-11-01T08:00:00+07:00"),
            metadata: {
              baselineTaskIds: [TASK_A, TASK_B, TASK_C],
              baselineTasks: [
                { taskId: TASK_A, estimateHours: 5 },
                { taskId: TASK_B, estimateHours: 8 },
                { taskId: TASK_C, estimateHours: 3 },
              ],
            },
          },
        ],
      });

      expect(report.isReadOnly).toBe(true);
      expect(report.totalSprints).toBe(2);
      expect(report.completedSprints).toBe(1);
      expect(report.totalRolledOverTasks).toBe(2);

      const s1 = report.sprints[0];
      expect(s1.baselineCommitment).toEqual({ taskCount: 3, estimateHours: 16 });
      expect(s1.scopeAdded).toEqual({ taskCount: 2, eventCount: 2, estimateHours: 6 });
      expect(s1.scopeRemoved).toEqual({ taskCount: 1, eventCount: 1, estimateHours: 3 });
      expect(s1.completedTasks).toEqual({
        taskCount: 2,
        estimateHours: 5,
        completionRatePercent: 50,
      });
      expect(s1.rolledOverToBacklog).toEqual({ taskCount: 1, estimateHours: 6 });
      expect(s1.rolledOverToSprint).toEqual({ taskCount: 1, estimateHours: 8 });
      expect(s1.finalScopeTaskCount).toBe(4);
      expect(s1.finalScopeEstimateHours).toBe(19); // 5 + 8 + 6 (frozen pre-Nov 9 edit!)
      expect(s1.estimateDeltaHours).toBe(3); // 19 - 16
      expect(s1.estimateCoveragePercent).toBe(75); // 3 out of 4 final tasks estimated
      expect(s1.hasPostSprintEstimateEdits).toBe(true);
      expect(s1.reconstructionConfidence).toBe("HIGH");

      const s2 = report.sprints[1];
      expect(s2.isBaselineAvailable).toBe(false);
      expect(s2.plannedTaskCount).toBe(1); // TASK_B rolled into Sprint 2
      expect(s2.plannedEstimateHours).toBe(12);
    });

    it("enforces REPORT_READ permission while allowing Member and Archived Project reads", async () => {
      await expect(
        getProjectSprintReportService(unauthorizedActor, PROJECT_ID)
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "FORBIDDEN",
      });

      projectAccessMock.assertProjectReadAccess.mockResolvedValue({
        project: { id: PROJECT_ID, status: "ARCHIVED" },
        memberRole: ProjectMemberRole.MEMBER,
        isWorkspaceAdmin: false,
      });
      sprintReportRepoMock.findProjectSprintReportSource.mockResolvedValue({
        project: { id: PROJECT_ID, name: "Archived Proj", status: "ARCHIVED" },
        sprints: [],
        tasks: [],
        sprintHistoryEvents: [],
        estimateHistoryEvents: [],
        activationLogs: [],
      });

      const result = await getProjectSprintReportService(memberActor, PROJECT_ID);
      expect(result.isReadOnly).toBe(true);
      expect(result.sprints).toEqual([]);
      expect(projectAccessMock.assertProjectReadAccess).toHaveBeenCalledWith(
        memberActor,
        PROJECT_ID
      );
    });
  });
});
