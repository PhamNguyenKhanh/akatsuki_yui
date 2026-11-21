import type { ProjectMeetingStatus, SprintStatus, TaskPriority, TaskStatus } from "@prisma/client";

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "To Do",
  IN_PROGRESS: "Đang làm",
  REVIEW: "Chờ Review",
  DONE: "Hoàn thành",
};

const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  HIGH: "Cao",
  CRITICAL: "Khẩn cấp (Critical)",
};

const SPRINT_STATUS_LABEL: Record<SprintStatus, string> = {
  PLANNED: "Lên kế hoạch",
  ACTIVE: "Đang chạy",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã hủy",
};

function truncateText(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

export interface TaskZaloSummaryInput {
  code: string;
  title: string;
  projectName: string;
  sprintName?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  deadlineText: string;
  isOverdue: boolean;
  blockedByCount: number;
  assigneeNames: string[];
  progressNotes?: string | null;
  referenceLinks?: string[];
  taskUrl?: string;
}

export function formatTaskZaloSummary(input: TaskZaloSummaryInput): string {
  const lines: string[] = [
    `[${input.code}] ${input.title}`,
    `📁 Dự án: ${input.projectName} | ${input.sprintName ? `Sprint: ${input.sprintName}` : "Product Backlog"}`,
    `📌 Trạng thái: ${TASK_STATUS_LABEL[input.status]} | Ưu tiên: ${TASK_PRIORITY_LABEL[input.priority]}`,
  ];

  const flags: string[] = [];
  if (input.isOverdue) {
    flags.push("⚠️ QUÁ HẠN");
  }
  if (input.blockedByCount > 0 && input.status !== "DONE") {
    flags.push(`⛔ Đang chờ ${input.blockedByCount} task tiền điều kiện`);
  }
  if (flags.length > 0) {
    lines.push(flags.join(" | "));
  }

  lines.push(
    `👤 Phụ trách: ${input.assigneeNames.length > 0 ? input.assigneeNames.join(", ") : "Chưa phân công"}`
  );
  lines.push(`⏰ Deadline: ${input.deadlineText}`);

  if (input.progressNotes && input.progressNotes.trim().length > 0) {
    lines.push(`📝 Tiến độ: ${truncateText(input.progressNotes, 280)}`);
  }

  const validLinks = (input.referenceLinks ?? []).map((l) => l.trim()).filter(Boolean);
  if (validLinks.length > 0) {
    lines.push("🔗 Tham chiếu:");
    for (const link of validLinks.slice(0, 3)) {
      lines.push(`- ${link}`);
    }
    if (validLinks.length > 3) {
      lines.push(`- (+${validLinks.length - 3} liên kết khác)`);
    }
  }

  if (input.taskUrl) {
    lines.push(`👉 Chi tiết: ${input.taskUrl}`);
  }

  if (input.status === "REVIEW") {
    lines.push("🔔 Nhờ Leader/Reviewer kiểm tra và duyệt giúp nhé!");
  } else if (input.isOverdue && input.status !== "DONE") {
    lines.push("⚠️ Task đã quá hạn, nhờ bạn cập nhật tiến độ sớm nhé!");
  }

  return lines.join("\n");
}

export interface MeetingZaloSummaryInput {
  title: string;
  status: ProjectMeetingStatus;
  isOngoing: boolean;
  isPast: boolean;
  dateText: string;
  startTime: string;
  endTime: string;
  meetUrl: string;
  participantNames: string[];
  description?: string | null;
  meetingsUrl?: string;
}

export function formatMeetingZaloSummary(input: MeetingZaloSummaryInput): string {
  const statusTag =
    input.status === "CANCELLED"
      ? " [ĐÃ HỦY]"
      : input.isOngoing
        ? " [ĐANG DIỄN RA]"
        : input.isPast
          ? " [ĐÃ KẾT THÚC]"
          : "";

  const lines: string[] = [
    `📅 [CUỘC HỌP] ${input.title}${statusTag}`,
    `⏰ Thời gian: ${input.dateText} (${input.startTime} – ${input.endTime})`,
  ];

  if (input.status !== "CANCELLED" && input.meetUrl) {
    lines.push(`🔗 Link Meet: ${input.meetUrl}`);
  }

  lines.push(
    `👥 Thành viên (${input.participantNames.length}): ${
      input.participantNames.length > 0 ? input.participantNames.join(", ") : "Chưa có"
    }`
  );

  if (input.description && input.description.trim().length > 0) {
    lines.push("📝 Nội dung / Action items:");
    lines.push(truncateText(input.description, 600));
  }

  if (input.meetingsUrl) {
    lines.push(`👉 Lịch họp dự án: ${input.meetingsUrl}`);
  }

  return lines.join("\n");
}

export interface SprintZaloTaskHighlight {
  code: string;
  title: string;
  assigneeNames: string[];
  deadlineText: string;
}

export interface SprintZaloSummaryInput {
  sprintName: string;
  projectName: string;
  status: SprintStatus;
  startDateText: string;
  endDateText: string;
  totalTasks: number;
  doneCount: number;
  inProgressCount: number;
  reviewCount: number;
  todoCount: number;
  overdueCount: number;
  progressPercent: number;
  hasEstimateData?: boolean;
  completedEstimateHours?: number;
  remainingEstimateHours?: number;
  currentScopeHours?: number;
  reviewTasks: SprintZaloTaskHighlight[];
  overdueTasks: SprintZaloTaskHighlight[];
  sprintUrl?: string;
}

export function formatSprintZaloSummary(input: SprintZaloSummaryInput): string {
  const lines: string[] = [
    `🏃 [SPRINT] ${input.sprintName} (${input.projectName})`,
    `📌 Trạng thái: ${SPRINT_STATUS_LABEL[input.status]} | 🗓️ ${input.startDateText} – ${input.endDateText}`,
    `📊 Tiến độ: ${input.doneCount}/${input.totalTasks} task hoàn thành (${input.progressPercent}%)`,
    `• Đang làm: ${input.inProgressCount} | Chờ Review: ${input.reviewCount} | To Do: ${input.todoCount}${
      input.overdueCount > 0 ? ` | ⚠️ Quá hạn: ${input.overdueCount}` : ""
    }`,
  ];

  if (
    input.hasEstimateData &&
    input.currentScopeHours !== undefined &&
    input.completedEstimateHours !== undefined &&
    input.remainingEstimateHours !== undefined
  ) {
    lines.push(
      `⏱️ Giờ ước lượng: xong ${input.completedEstimateHours}h / ${input.currentScopeHours}h (còn ${input.remainingEstimateHours}h)`
    );
  }

  if (input.reviewTasks.length > 0) {
    lines.push(`👀 Chờ Review (${input.reviewTasks.length}):`);
    for (const task of input.reviewTasks.slice(0, 5)) {
      const who = task.assigneeNames.length > 0 ? task.assigneeNames.join(", ") : "Chưa gán";
      lines.push(`- [${task.code}] ${task.title} (${who})`);
    }
    if (input.reviewTasks.length > 5) {
      lines.push(`- (+${input.reviewTasks.length - 5} task khác)`);
    }
  }

  if (input.overdueTasks.length > 0) {
    lines.push(`⚠️ Quá hạn (${input.overdueTasks.length}):`);
    for (const task of input.overdueTasks.slice(0, 5)) {
      const who = task.assigneeNames.length > 0 ? task.assigneeNames.join(", ") : "Chưa gán";
      lines.push(`- [${task.code}] ${task.title} (${who}, hạn ${task.deadlineText})`);
    }
    if (input.overdueTasks.length > 5) {
      lines.push(`- (+${input.overdueTasks.length - 5} task khác)`);
    }
  }

  if (input.sprintUrl) {
    lines.push(`👉 Chi tiết Sprint: ${input.sprintUrl}`);
  }

  return lines.join("\n");
}

export interface DashboardZaloSprintItem {
  name: string;
  doneCount: number;
  totalTasks: number;
  progressPercent: number;
  reviewCount: number;
  overdueCount: number;
}

export interface DashboardZaloSummaryInput {
  projectName: string;
  leaderName: string;
  activeMemberCount: number;
  taskSummary: {
    totalTasks: number;
    doneCount: number;
    inProgressCount: number;
    reviewCount: number;
    todoCount: number;
    overdueCount: number;
    workProgressPercent: number;
  } | null;
  timelineText?: string | null;
  sprints: DashboardZaloSprintItem[];
  dashboardUrl?: string;
}

export function formatDashboardZaloSummary(input: DashboardZaloSummaryInput): string {
  const lines: string[] = [
    `📊 [BÁO CÁO NHANH] ${input.projectName}`,
    `👑 Leader: ${input.leaderName} | 👥 ${input.activeMemberCount} thành viên`,
  ];

  if (input.taskSummary) {
    const t = input.taskSummary;
    lines.push(
      `✅ Tiến độ công việc: ${t.workProgressPercent}% (${t.doneCount}/${t.totalTasks} task Done)`
    );
    lines.push(
      `• Đang làm: ${t.inProgressCount} | Chờ Review: ${t.reviewCount} | To Do: ${t.todoCount}${
        t.overdueCount > 0 ? ` | ⚠️ Quá hạn: ${t.overdueCount}` : ""
      }`
    );
  }

  if (input.timelineText) {
    lines.push(`🗓️ Timeline: ${input.timelineText}`);
  }

  if (input.sprints.length > 0) {
    lines.push("🏃 Sprint:");
    for (const sprint of input.sprints) {
      const extras: string[] = [];
      if (sprint.reviewCount > 0) extras.push(`${sprint.reviewCount} chờ review`);
      if (sprint.overdueCount > 0) extras.push(`${sprint.overdueCount} quá hạn`);
      const extraSuffix = extras.length > 0 ? ` (${extras.join(", ")})` : "";
      lines.push(
        `- ${sprint.name}: ${sprint.doneCount}/${sprint.totalTasks} task (${sprint.progressPercent}%)${extraSuffix}`
      );
    }
  }

  if (input.dashboardUrl) {
    lines.push(`👉 Dashboard: ${input.dashboardUrl}`);
  }

  return lines.join("\n");
}
