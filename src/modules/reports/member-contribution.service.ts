import "server-only";
import { ProjectMemberRole, ReviewDecision, TaskHistoryAction, TaskStatus } from "@prisma/client";
import { badRequestError, notFoundError } from "@/lib/errors";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { assertPermission } from "@/modules/authorization/policy.service";
import {
  assertProjectReadAccess,
  isWorkspaceAdmin,
  parseProjectId,
} from "@/modules/projects/project.access";
import {
  memberContributionRepository,
  type MemberContributionSourceData,
  type MemberContributionUserRef,
} from "@/modules/reports/member-contribution.repository";
import {
  memberContributionQuerySchema,
  resolveAnalyticsDateWindow,
  type ResolvedAnalyticsDateWindow,
} from "@/modules/reports/report.schema";
import type { AuthContext } from "@/types/auth";

export type MembershipStatus = "ACTIVE" | "LEFT_PROJECT";
export type ContributionViewScope = "ALL_MEMBERS" | "SELF_ONLY";

export interface MemberContributionRowDTO {
  userId: string;
  fullName: string;
  email: string;
  projectRole: ProjectMemberRole | "FORMER_MEMBER";
  membershipStatus: MembershipStatus;
  membershipBadge: string;
  joinedAt: string | null;
  leftAt: string | null;
  currentAssigned: {
    total: number;
    soleAssignedCount: number;
    coAssignedCount: number;
    completedCount: number;
    completedSoleCount: number;
    completedCoAssignedCount: number;
    inProgressCount: number;
    reviewCount: number;
    todoCount: number;
    overdueCount: number;
    completionRatePercent: number;
    plannedEstimateHours: {
      total: number;
      sole: number;
      coAssigned: number;
      estimatedTaskCount: number;
      unestimatedTaskCount: number;
    };
  };
  historicalAssignments: {
    formerTasksDistinctCount: number;
    historicalDoneDistinctCount: number;
    uniqueTasksEverAssigned: number;
    removedOrDepartedEpisodeCount: number;
    totalAssignmentEpisodes: number;
  };
  verifiableActivity: {
    taskHistoryActionsTotal: number;
    statusTransitionsCount: number;
    progressUpdatesCount: number;
    reviewsSubmittedCount: number;
    reviewsConductedTotal: number;
    reviewsApprovedCount: number;
    reviewsRejectedCount: number;
    activityLogsCount: number;
  };
}

export interface MemberContributionReportDTO {
  projectId: string;
  projectName: string;
  projectStatus: string;
  isReadOnly: boolean;
  viewScope: ContributionViewScope;
  includeRemoved: boolean;
  hasDepartedMembers: boolean;
  window: {
    preset: string;
    fromYmd: string;
    toYmd: string;
    spanDays: number;
    wasClampedTo365Days: boolean;
    timezone: "Asia/Ho_Chi_Minh";
  };
  projectTotals: {
    totalTasks: number;
    doneTasks: number;
    inProgressTasks: number;
    reviewTasks: number;
    todoTasks: number;
    overdueTasks: number;
    soleAssignedTasks: number;
    coAssignedTasks: number;
    unassignedTasks: number;
    totalPlannedEstimateHours: number;
    unestimatedTaskCount: number;
    estimateCoveragePercent: number;
  };
  members: MemberContributionRowDTO[];
  disclaimers: string[];
}

interface ParticipantMeta {
  user: MemberContributionUserRef;
  projectRole: ProjectMemberRole | "FORMER_MEMBER";
  isActiveParticipant: boolean;
  joinedAt: Date | null;
  leftAt: Date | null;
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return roundOneDecimal((numerator / denominator) * 100);
}

const ROLE_SORT_PRIORITY: Record<ProjectMemberRole | "FORMER_MEMBER", number> = {
  LEADER: 0,
  INSTRUCTOR: 1,
  MEMBER: 2,
  FORMER_MEMBER: 3,
};

/**
 * Pure computation producing objective, non-additive member contribution metrics
 * complying strictly with DEC-047, DEC-048, DEC-049, DEC-050, DEC-052, P0-02, and P1-03.
 */
export function computeMemberContributionReport(
  source: MemberContributionSourceData,
  window: ResolvedAnalyticsDateWindow,
  options: {
    viewScope: ContributionViewScope;
    viewerUserId: string;
    includeRemoved: boolean;
    referenceNow?: Date;
  }
): MemberContributionReportDTO {
  const referenceNow = options.referenceNow ?? new Date();
  const participants = new Map<string, ParticipantMeta>();

  const registerParticipant = (
    user: MemberContributionUserRef,
    role: ProjectMemberRole | "FORMER_MEMBER",
    isActive: boolean,
    joinedAt: Date | null,
    leftAt: Date | null
  ) => {
    const existing = participants.get(user.id);
    if (!existing) {
      participants.set(user.id, {
        user,
        projectRole: role,
        isActiveParticipant: isActive,
        joinedAt,
        leftAt,
      });
      return;
    }

    const becameActive = existing.isActiveParticipant || isActive;
    // Active role wins over former role; if previously departed and later rejoined, clear leftAt.
    let nextRole = existing.projectRole;
    if (isActive && !existing.isActiveParticipant) {
      nextRole = role;
    } else if (role === ProjectMemberRole.LEADER || role === ProjectMemberRole.INSTRUCTOR) {
      if (isActive || existing.projectRole === "FORMER_MEMBER") {
        nextRole = role;
      }
    }

    const nextJoined =
      existing.joinedAt && joinedAt
        ? new Date(Math.min(existing.joinedAt.getTime(), joinedAt.getTime()))
        : (existing.joinedAt ?? joinedAt);

    let nextLeft: Date | null = existing.leftAt;
    if (becameActive) {
      nextLeft = null;
    } else if (leftAt) {
      nextLeft =
        !existing.leftAt || leftAt.getTime() > existing.leftAt.getTime() ? leftAt : existing.leftAt;
    }

    participants.set(user.id, {
      user,
      projectRole: nextRole,
      isActiveParticipant: becameActive,
      joinedAt: nextJoined,
      leftAt: nextLeft,
    });
  };

  // 1. Register Project Leader & Instructor (always active supervisors of the Project).
  registerParticipant(
    source.project.leader,
    ProjectMemberRole.LEADER,
    true,
    source.project.createdAt,
    null
  );
  if (source.project.instructor) {
    registerParticipant(
      source.project.instructor,
      ProjectMemberRole.INSTRUCTOR,
      true,
      source.project.createdAt,
      null
    );
  }

  // 2. Register all ProjectMember episodes (active + departed).
  for (const m of source.project.members) {
    registerParticipant(m.user, m.projectRole, m.leftAt === null, m.joinedAt, m.leftAt);
  }

  // 3. Ensure any historical assignee not already listed appears as FORMER_MEMBER.
  for (const task of source.tasks) {
    for (const a of task.assignees) {
      if (!participants.has(a.userId)) {
        registerParticipant(a.user, "FORMER_MEMBER", false, null, a.removedAt);
      }
    }
  }

  // Build Project Totals & resolve Current vs Historical task assignments per user.
  let projectDone = 0;
  let projectInProgress = 0;
  let projectReview = 0;
  let projectTodo = 0;
  let projectOverdue = 0;
  let projectSoleTasks = 0;
  let projectCoTasks = 0;
  let projectUnassignedTasks = 0;
  let projectPlannedHours = 0;
  let projectEstimatedTasks = 0;

  interface UserAccumulator {
    currentTaskIds: Set<string>;
    soleTaskIds: Set<string>;
    coAssignedTaskIds: Set<string>;
    completedCurrentTaskIds: Set<string>;
    completedSoleTaskIds: Set<string>;
    completedCoAssignedTaskIds: Set<string>;
    inProgressTaskIds: Set<string>;
    reviewTaskIds: Set<string>;
    todoTaskIds: Set<string>;
    overdueTaskIds: Set<string>;
    soleHours: number;
    coAssignedHours: number;
    currentEstimatedTaskIds: Set<string>;
    currentUnestimatedTaskIds: Set<string>;

    // Historical distinct & episode accumulators (P0-02 & P1-03)
    nonCurrentTaskIds: Set<string>;
    nonCurrentDoneTaskIds: Set<string>;
    everAssignedTaskIds: Set<string>;
    removedOrDepartedEpisodes: number;
    totalAssignmentEpisodes: number;

    // Verifiable window actions
    taskHistoryActionsTotal: number;
    statusTransitionsCount: number;
    progressUpdatesCount: number;
    reviewsSubmittedCount: number;
    reviewsApprovedCount: number;
    reviewsRejectedCount: number;
    activityLogsCount: number;
  }

  const accByUser = new Map<string, UserAccumulator>();
  const ensureAcc = (userId: string): UserAccumulator => {
    let acc = accByUser.get(userId);
    if (!acc) {
      acc = {
        currentTaskIds: new Set(),
        soleTaskIds: new Set(),
        coAssignedTaskIds: new Set(),
        completedCurrentTaskIds: new Set(),
        completedSoleTaskIds: new Set(),
        completedCoAssignedTaskIds: new Set(),
        inProgressTaskIds: new Set(),
        reviewTaskIds: new Set(),
        todoTaskIds: new Set(),
        overdueTaskIds: new Set(),
        soleHours: 0,
        coAssignedHours: 0,
        currentEstimatedTaskIds: new Set(),
        currentUnestimatedTaskIds: new Set(),
        nonCurrentTaskIds: new Set(),
        nonCurrentDoneTaskIds: new Set(),
        everAssignedTaskIds: new Set(),
        removedOrDepartedEpisodes: 0,
        totalAssignmentEpisodes: 0,
        taskHistoryActionsTotal: 0,
        statusTransitionsCount: 0,
        progressUpdatesCount: 0,
        reviewsSubmittedCount: 0,
        reviewsApprovedCount: 0,
        reviewsRejectedCount: 0,
        activityLogsCount: 0,
      };
      accByUser.set(userId, acc);
    }
    return acc;
  };

  for (const userId of participants.keys()) {
    ensureAcc(userId);
  }

  for (const task of source.tasks) {
    const isOverdue =
      task.status !== TaskStatus.DONE && task.deadline.getTime() < referenceNow.getTime();
    if (task.status === TaskStatus.DONE) projectDone += 1;
    else if (task.status === TaskStatus.IN_PROGRESS) projectInProgress += 1;
    else if (task.status === TaskStatus.REVIEW) projectReview += 1;
    else projectTodo += 1;
    if (isOverdue) projectOverdue += 1;

    if (task.estimateHours !== null && task.estimateHours > 0) {
      projectEstimatedTasks += 1;
      projectPlannedHours += task.estimateHours;
    }

    // P1-03: Effective active assignment requires BOTH TaskAssignee.removedAt === null AND active Project membership!
    const effectiveActiveAssignees = task.assignees.filter((a) => {
      if (a.removedAt !== null) return false;
      return participants.get(a.userId)?.isActiveParticipant === true;
    });
    const activeAssigneeUserIds = new Set(effectiveActiveAssignees.map((a) => a.userId));
    const activeCount = activeAssigneeUserIds.size;

    if (activeCount === 0) projectUnassignedTasks += 1;
    else if (activeCount === 1) projectSoleTasks += 1;
    else projectCoTasks += 1;

    // Count episodes & distinct historical involvements
    for (const assignee of task.assignees) {
      const acc = ensureAcc(assignee.userId);
      acc.totalAssignmentEpisodes += 1;
      acc.everAssignedTaskIds.add(task.id);

      const isActiveParticipant = participants.get(assignee.userId)?.isActiveParticipant === true;
      const isCurrentRow = assignee.removedAt === null && isActiveParticipant;

      if (!isCurrentRow) {
        acc.removedOrDepartedEpisodes += 1;
        // Track tasks where user had historical involvement (and is NOT currently assigned below).
        if (!activeAssigneeUserIds.has(assignee.userId)) {
          acc.nonCurrentTaskIds.add(task.id);
          if (task.status === TaskStatus.DONE) {
            acc.nonCurrentDoneTaskIds.add(task.id);
          }
        }
      }
    }

    // Current active distinct tasks (Sole vs Co-Assigned)
    for (const userId of activeAssigneeUserIds) {
      const acc = ensureAcc(userId);
      acc.currentTaskIds.add(task.id);

      const isSole = activeCount === 1;
      if (isSole) {
        acc.soleTaskIds.add(task.id);
      } else {
        acc.coAssignedTaskIds.add(task.id);
      }

      if (task.status === TaskStatus.DONE) {
        acc.completedCurrentTaskIds.add(task.id);
        if (isSole) acc.completedSoleTaskIds.add(task.id);
        else acc.completedCoAssignedTaskIds.add(task.id);
      } else if (task.status === TaskStatus.IN_PROGRESS) {
        acc.inProgressTaskIds.add(task.id);
      } else if (task.status === TaskStatus.REVIEW) {
        acc.reviewTaskIds.add(task.id);
      } else {
        acc.todoTaskIds.add(task.id);
      }

      if (isOverdue) {
        acc.overdueTaskIds.add(task.id);
      }

      if (task.estimateHours !== null && task.estimateHours > 0) {
        acc.currentEstimatedTaskIds.add(task.id);
        if (isSole) {
          acc.soleHours += task.estimateHours;
        } else {
          acc.coAssignedHours += task.estimateHours;
        }
      } else {
        acc.currentUnestimatedTaskIds.add(task.id);
      }
    }
  }

  // Merge verifiable DB activity aggregates within the selected date window.
  for (const row of source.taskHistoryActionsInWindow) {
    if (!row.actorId || !participants.has(row.actorId)) continue;
    const acc = ensureAcc(row.actorId);
    acc.taskHistoryActionsTotal += row.count;
    if (row.action === TaskHistoryAction.STATUS_CHANGED) {
      acc.statusTransitionsCount += row.count;
    } else if (row.action === TaskHistoryAction.PROGRESS_UPDATED) {
      acc.progressUpdatesCount += row.count;
    } else if (row.action === TaskHistoryAction.REVIEW_SUBMITTED) {
      acc.reviewsSubmittedCount += row.count;
    }
  }

  for (const row of source.taskReviewsInWindow) {
    if (!participants.has(row.reviewerId)) continue;
    const acc = ensureAcc(row.reviewerId);
    if (row.decision === ReviewDecision.APPROVED) {
      acc.reviewsApprovedCount += row.count;
    } else {
      acc.reviewsRejectedCount += row.count;
    }
  }

  for (const row of source.activityLogsInWindow) {
    if (!participants.has(row.userId)) continue;
    const acc = ensureAcc(row.userId);
    acc.activityLogsCount += row.count;
  }

  const hasDepartedMembers = Array.from(participants.values()).some((p) => !p.isActiveParticipant);

  // Build rows with strict DEC-052 & DEC-050 filtering.
  const rows: MemberContributionRowDTO[] = [];
  for (const [userId, meta] of participants.entries()) {
    if (options.viewScope === "SELF_ONLY" && userId !== options.viewerUserId) {
      continue;
    }
    if (
      options.viewScope === "ALL_MEMBERS" &&
      !options.includeRemoved &&
      !meta.isActiveParticipant
    ) {
      continue;
    }

    const acc = ensureAcc(userId);
    const currentTotal = acc.currentTaskIds.size;
    const completedTotal = acc.completedCurrentTaskIds.size;
    const membershipStatus: MembershipStatus = meta.isActiveParticipant ? "ACTIVE" : "LEFT_PROJECT";

    rows.push({
      userId,
      fullName: meta.user.fullName,
      email: meta.user.email,
      projectRole: meta.projectRole,
      membershipStatus,
      membershipBadge: membershipStatus === "LEFT_PROJECT" ? "Đã rời Project" : "Đang tham gia",
      joinedAt: meta.joinedAt ? meta.joinedAt.toISOString() : null,
      leftAt: meta.leftAt ? meta.leftAt.toISOString() : null,
      currentAssigned: {
        total: currentTotal,
        soleAssignedCount: acc.soleTaskIds.size,
        coAssignedCount: acc.coAssignedTaskIds.size,
        completedCount: completedTotal,
        completedSoleCount: acc.completedSoleTaskIds.size,
        completedCoAssignedCount: acc.completedCoAssignedTaskIds.size,
        inProgressCount: acc.inProgressTaskIds.size,
        reviewCount: acc.reviewTaskIds.size,
        todoCount: acc.todoTaskIds.size,
        overdueCount: acc.overdueTaskIds.size,
        completionRatePercent: formatPercent(completedTotal, currentTotal),
        plannedEstimateHours: {
          total: roundTwoDecimals(acc.soleHours + acc.coAssignedHours),
          sole: roundTwoDecimals(acc.soleHours),
          coAssigned: roundTwoDecimals(acc.coAssignedHours),
          estimatedTaskCount: acc.currentEstimatedTaskIds.size,
          unestimatedTaskCount: acc.currentUnestimatedTaskIds.size,
        },
      },
      historicalAssignments: {
        formerTasksDistinctCount: acc.nonCurrentTaskIds.size,
        historicalDoneDistinctCount: acc.nonCurrentDoneTaskIds.size,
        uniqueTasksEverAssigned: acc.everAssignedTaskIds.size,
        removedOrDepartedEpisodeCount: acc.removedOrDepartedEpisodes,
        totalAssignmentEpisodes: acc.totalAssignmentEpisodes,
      },
      verifiableActivity: {
        taskHistoryActionsTotal: acc.taskHistoryActionsTotal,
        statusTransitionsCount: acc.statusTransitionsCount,
        progressUpdatesCount: acc.progressUpdatesCount,
        reviewsSubmittedCount: acc.reviewsSubmittedCount,
        reviewsConductedTotal: acc.reviewsApprovedCount + acc.reviewsRejectedCount,
        reviewsApprovedCount: acc.reviewsApprovedCount,
        reviewsRejectedCount: acc.reviewsRejectedCount,
        activityLogsCount: acc.activityLogsCount,
      },
    });
  }

  // Deterministic alphabetical/status sort — never ranked by performance metrics (DEC-047).
  rows.sort((a, b) => {
    if (a.membershipStatus !== b.membershipStatus) {
      return a.membershipStatus === "ACTIVE" ? -1 : 1;
    }
    const roleDiff = ROLE_SORT_PRIORITY[a.projectRole] - ROLE_SORT_PRIORITY[b.projectRole];
    if (roleDiff !== 0) return roleDiff;
    return a.fullName.localeCompare(b.fullName, "vi");
  });

  const totalProjectTasks = source.tasks.length;
  return {
    projectId: source.project.id,
    projectName: source.project.name,
    projectStatus: source.project.status,
    isReadOnly: source.project.status === "ARCHIVED",
    viewScope: options.viewScope,
    includeRemoved: options.includeRemoved,
    hasDepartedMembers,
    window: {
      preset: window.preset,
      fromYmd: window.fromYmd,
      toYmd: window.toYmd,
      spanDays: window.spanDays,
      wasClampedTo365Days: window.wasClampedTo365Days,
      timezone: window.timezone,
    },
    projectTotals: {
      totalTasks: totalProjectTasks,
      doneTasks: projectDone,
      inProgressTasks: projectInProgress,
      reviewTasks: projectReview,
      todoTasks: projectTodo,
      overdueTasks: projectOverdue,
      soleAssignedTasks: projectSoleTasks,
      coAssignedTasks: projectCoTasks,
      unassignedTasks: projectUnassignedTasks,
      totalPlannedEstimateHours: roundTwoDecimals(projectPlannedHours),
      unestimatedTaskCount: Math.max(0, totalProjectTasks - projectEstimatedTasks),
      estimateCoveragePercent: formatPercent(projectEstimatedTasks, totalProjectTasks),
    },
    members: rows,
    disclaimers: [
      "Báo cáo ghi nhận tham gia phi cộng dồn (non-additive): một Task giao cho nhiều thành viên (Co-Assigned) được thống kê cho từng người tham gia; tổng các dòng thành viên có thể khác Tổng số Task của Project.",
      "Số liệu phản ánh vai trò tham gia và hành động ghi nhận được trong hệ thống, không đồng nhất với năng suất cá nhân hay xếp hạng thành viên.",
      "Estimate Hours chỉ là khối lượng kế hoạch dự kiến, không phản ánh giờ làm thực tế đã tiêu tốn.",
    ],
  };
}

/**
 * Loads and computes Member Contribution Report with DEC-052 MEMBER SELF_ONLY isolation
 * and DEC-050 departed member support.
 */
export async function getMemberContributionReportService(
  actor: AuthContext,
  projectId: string,
  rawQuery: Record<string, unknown> = {},
  referenceNow: Date = new Date()
): Promise<MemberContributionReportDTO> {
  assertPermission(actor, PERMISSIONS.REPORT_READ);
  const validProjectId = parseProjectId(projectId);

  const parsedQuery = memberContributionQuerySchema.safeParse(rawQuery);
  if (!parsedQuery.success) {
    throw badRequestError(
      "Tham số lọc báo cáo đóng góp thành viên không hợp lệ.",
      parsedQuery.error.issues.map((issue) => ({
        field: issue.path.join(".") || "query",
        message: issue.message,
      }))
    );
  }

  const accessProject = await assertProjectReadAccess(actor, validProjectId);
  const meta = await memberContributionRepository.findProjectMetaForMembers(validProjectId);
  if (!meta) {
    throw notFoundError("Không tìm thấy Project yêu cầu.");
  }

  const canViewAllMembers =
    isWorkspaceAdmin(actor) ||
    accessProject.leaderId === actor.userId ||
    accessProject.instructorId === actor.userId ||
    accessProject.members.some(
      (m) =>
        m.projectRole === ProjectMemberRole.LEADER || m.projectRole === ProjectMemberRole.INSTRUCTOR
    );

  const viewScope: ContributionViewScope = canViewAllMembers ? "ALL_MEMBERS" : "SELF_ONLY";

  const window = resolveAnalyticsDateWindow(
    {
      preset: parsedQuery.data.preset,
      from: parsedQuery.data.from,
      to: parsedQuery.data.to,
    },
    {
      startDate: meta.project.startDate,
      createdAt: meta.project.createdAt,
      earliestTaskCreatedAt: meta.earliestTaskCreatedAt,
    },
    referenceNow
  );

  const source = await memberContributionRepository.loadMemberContributionSource({
    project: meta.project,
    earliestTaskCreatedAt: meta.earliestTaskCreatedAt,
    fromUtc: window.fromUtc,
    toUtc: window.toUtc,
  });

  return computeMemberContributionReport(source, window, {
    viewScope,
    viewerUserId: actor.userId,
    includeRemoved: parsedQuery.data.includeRemoved,
    referenceNow,
  });
}
