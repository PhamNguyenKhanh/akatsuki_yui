import { TaskHistoryAction, TaskPriority, TaskStatus } from "@prisma/client";
import type { TaskHistoryItemDTO } from "@/modules/tasks/task-history.repository";

export interface HistorySummaryChip {
  kind: "transition" | "added" | "removed" | "neutral";
  from?: string;
  to?: string;
  text?: string;
}

export interface HistoryDetailRow {
  key: string;
  label: string;
  oldDisplay?: string;
  newDisplay?: string;
}

const TECHNICAL_ID_KEYS = new Set([
  "id",
  "taskId",
  "userId",
  "sprintId",
  "dependsOnTaskId",
  "assigneeIds",
]);

const FIELD_LABELS: Record<string, string> = {
  title: "Tiêu đề",
  description: "Mô tả",
  priority: "Độ ưu tiên",
  startDate: "Ngày bắt đầu",
  deadline: "Hạn chót",
  estimateHours: "Ước lượng",
  referenceLinks: "Liên kết tham khảo",
  progressNotes: "Ghi chú tiến độ",
  progressPercent: "Tiến độ",
  sprintName: "Sprint",
  fullName: "Họ tên",
  email: "Email",
  code: "Mã Task",
  status: "Trạng thái",
};

const PRIORITY_LABELS: Record<string, string> = {
  [TaskPriority.LOW]: "Thấp (Low)",
  [TaskPriority.MEDIUM]: "Trung bình (Medium)",
  [TaskPriority.HIGH]: "Cao (High)",
  [TaskPriority.CRITICAL]: "Khẩn cấp (Critical)",
};

const STATUS_LABELS: Record<string, string> = {
  [TaskStatus.TODO]: "To Do",
  [TaskStatus.IN_PROGRESS]: "In Progress",
  [TaskStatus.REVIEW]: "Review",
  [TaskStatus.DONE]: "Done",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function truncateText(text: string, maxLength = 48): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function formatDateVi(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Chưa có";
  }

  if (key === "priority" && typeof value === "string") {
    return PRIORITY_LABELS[value] ?? value;
  }

  if (key === "status" && typeof value === "string") {
    return STATUS_LABELS[value] ?? value;
  }

  if ((key === "startDate" || key === "deadline") && typeof value === "string") {
    return formatDateVi(value);
  }

  if (key === "estimateHours" && typeof value === "number") {
    return `${value} giờ`;
  }

  if (key === "progressPercent" && typeof value === "number") {
    return `${value}%`;
  }

  if (key === "referenceLinks" && Array.isArray(value)) {
    const links = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    return links.length > 0 ? links.join(", ") : "Chưa có";
  }

  if (typeof value === "boolean") {
    return value ? "Có" : "Không";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return JSON.stringify(value);
}

export function getHistorySummaryChip(item: TaskHistoryItemDTO): HistorySummaryChip | null {
  const oldRec = asRecord(item.oldValue);
  const newRec = asRecord(item.newValue);

  switch (item.action) {
    case TaskHistoryAction.ASSIGNEE_ADDED: {
      const name = asNonEmptyString(newRec?.fullName) ?? asNonEmptyString(newRec?.email);
      return name ? { kind: "added", text: `+ ${name}` } : null;
    }

    case TaskHistoryAction.ASSIGNEE_REMOVED: {
      const name = asNonEmptyString(oldRec?.fullName) ?? asNonEmptyString(oldRec?.email);
      return name ? { kind: "removed", text: `- ${name}` } : null;
    }

    case TaskHistoryAction.SPRINT_ASSIGNED: {
      const sprintName = asNonEmptyString(newRec?.sprintName);
      if (!sprintName) return null;
      return { kind: "transition", from: "Backlog", to: sprintName };
    }

    case TaskHistoryAction.SPRINT_REMOVED: {
      const sprintName = asNonEmptyString(oldRec?.sprintName);
      if (!sprintName) return null;
      return { kind: "transition", from: sprintName, to: "Backlog" };
    }

    case TaskHistoryAction.SPRINT_MOVED: {
      const fromSprint = asNonEmptyString(oldRec?.sprintName) ?? "Backlog";
      const toSprint = asNonEmptyString(newRec?.sprintName) ?? "Backlog";
      return { kind: "transition", from: fromSprint, to: toSprint };
    }

    case TaskHistoryAction.DEPENDENCY_ADDED: {
      const code = asNonEmptyString(newRec?.code);
      const title = asNonEmptyString(newRec?.title);
      const label = [code, title].filter(Boolean).join(" · ");
      return label ? { kind: "added", text: `+ ${truncateText(label)}` } : null;
    }

    case TaskHistoryAction.DEPENDENCY_REMOVED: {
      const code = asNonEmptyString(oldRec?.code);
      const title = asNonEmptyString(oldRec?.title);
      const label = [code, title].filter(Boolean).join(" · ");
      return label ? { kind: "removed", text: `- ${truncateText(label)}` } : null;
    }

    case TaskHistoryAction.INFO_UPDATED:
    case TaskHistoryAction.PROGRESS_UPDATED: {
      const keys = Array.from(
        new Set([...Object.keys(oldRec ?? {}), ...Object.keys(newRec ?? {})])
      ).filter((key) => !TECHNICAL_ID_KEYS.has(key));

      if (keys.length === 0) return null;

      if (keys.length === 1) {
        const key = keys[0];
        const fieldLabel = FIELD_LABELS[key] ?? key;
        if (key === "priority" || key === "deadline" || key === "startDate" || key === "estimateHours" || key === "progressPercent") {
          return {
            kind: "transition",
            from: `${fieldLabel}: ${formatFieldValue(key, oldRec?.[key])}`,
            to: formatFieldValue(key, newRec?.[key]),
          };
        }
        return { kind: "neutral", text: fieldLabel };
      }

      const labels = keys.map((key) => FIELD_LABELS[key] ?? key);
      const preview =
        labels.length <= 3 ? labels.join(", ") : `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
      return { kind: "neutral", text: preview };
    }

    default:
      return null;
  }
}

export function getHistoryDetailRows(item: TaskHistoryItemDTO): HistoryDetailRow[] {
  const oldRec = asRecord(item.oldValue);
  const newRec = asRecord(item.newValue);

  if (!oldRec && !newRec) {
    return [];
  }

  if (
    item.action === TaskHistoryAction.SPRINT_ASSIGNED ||
    item.action === TaskHistoryAction.SPRINT_REMOVED ||
    item.action === TaskHistoryAction.SPRINT_MOVED
  ) {
    const oldSprint = asNonEmptyString(oldRec?.sprintName) ?? "Backlog";
    const newSprint = asNonEmptyString(newRec?.sprintName) ?? "Backlog";
    return [
      {
        key: "sprintName",
        label: "Sprint",
        oldDisplay: oldSprint,
        newDisplay: newSprint,
      },
    ];
  }

  if (
    item.action === TaskHistoryAction.ASSIGNEE_ADDED ||
    item.action === TaskHistoryAction.ASSIGNEE_REMOVED
  ) {
    const rec = item.action === TaskHistoryAction.ASSIGNEE_ADDED ? newRec : oldRec;
    const fullName = asNonEmptyString(rec?.fullName);
    const email = asNonEmptyString(rec?.email);
    const display = fullName && email ? `${fullName} (${email})` : (fullName ?? email ?? "Không rõ");
    return [
      {
        key: "assignee",
        label: "Thành viên",
        ...(item.action === TaskHistoryAction.ASSIGNEE_ADDED
          ? { newDisplay: display }
          : { oldDisplay: display }),
      },
    ];
  }

  if (
    item.action === TaskHistoryAction.DEPENDENCY_ADDED ||
    item.action === TaskHistoryAction.DEPENDENCY_REMOVED
  ) {
    const rec = item.action === TaskHistoryAction.DEPENDENCY_ADDED ? newRec : oldRec;
    const code = asNonEmptyString(rec?.code);
    const title = asNonEmptyString(rec?.title);
    const status = asNonEmptyString(rec?.status);
    const taskDisplay = [code, title].filter(Boolean).join(" — ") || "Không rõ";
    const rows: HistoryDetailRow[] = [
      {
        key: "dependency",
        label: "Task phụ thuộc",
        ...(item.action === TaskHistoryAction.DEPENDENCY_ADDED
          ? { newDisplay: taskDisplay }
          : { oldDisplay: taskDisplay }),
      },
    ];
    if (status) {
      rows.push({
        key: "status",
        label: "Trạng thái lúc thao tác",
        ...(item.action === TaskHistoryAction.DEPENDENCY_ADDED
          ? { newDisplay: formatFieldValue("status", status) }
          : { oldDisplay: formatFieldValue("status", status) }),
      });
    }
    return rows;
  }

  const keys = Array.from(new Set([...Object.keys(oldRec ?? {}), ...Object.keys(newRec ?? {})]));
  const rows: HistoryDetailRow[] = [];

  for (const key of keys) {
    if (key === "assigneeIds" && item.action === TaskHistoryAction.CREATED) {
      const assignees = Array.isArray(newRec?.assigneeIds) ? newRec.assigneeIds : [];
      if (assignees.length > 0) {
        rows.push({
          key: "assigneeCount",
          label: "Số người được phân công",
          newDisplay: `${assignees.length} thành viên`,
        });
      }
      continue;
    }

    if (TECHNICAL_ID_KEYS.has(key)) {
      continue;
    }

    const hasOld = oldRec !== null && key in oldRec;
    const hasNew = newRec !== null && key in newRec;

    rows.push({
      key,
      label: FIELD_LABELS[key] ?? key,
      ...(hasOld ? { oldDisplay: formatFieldValue(key, oldRec[key]) } : {}),
      ...(hasNew ? { newDisplay: formatFieldValue(key, newRec[key]) } : {}),
    });
  }

  return rows;
}
