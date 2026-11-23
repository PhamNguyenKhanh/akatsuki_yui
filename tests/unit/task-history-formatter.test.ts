import { TaskHistoryAction, TaskPriority, TaskStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  getHistoryDetailRows,
  getHistorySummaryChip,
} from "@/components/tasks/task-history-formatter";
import type { TaskHistoryItemDTO } from "@/modules/tasks/task-history.repository";

function makeItem(
  overrides: Partial<TaskHistoryItemDTO> & { action: TaskHistoryAction }
): TaskHistoryItemDTO {
  return {
    id: "hist-1",
    taskId: "task-1",
    actorId: "user-1",
    actor: {
      id: "user-1",
      fullName: "Akatsuki Yui",
      email: "yui@example.com",
    },
    fromStatus: null,
    toStatus: null,
    reason: null,
    oldValue: null,
    newValue: null,
    metadata: null,
    createdAt: new Date("2026-11-21T13:32:00.000Z"),
    ...overrides,
  };
}

describe("task-history-formatter", () => {
  it("formats SPRINT_ASSIGNED, SPRINT_REMOVED, SPRINT_MOVED concisely without UUIDs", () => {
    const assigned = makeItem({
      action: TaskHistoryAction.SPRINT_ASSIGNED,
      oldValue: { sprintId: null },
      newValue: { sprintId: "b981919f-8092-4f9e-8fb3-d3c4276f40aa", sprintName: "Sprint 0 - Preparation" },
    });

    expect(getHistorySummaryChip(assigned)).toEqual({
      kind: "transition",
      from: "Backlog",
      to: "Sprint 0 - Preparation",
    });
    expect(getHistoryDetailRows(assigned)).toEqual([
      {
        key: "sprintName",
        label: "Sprint",
        oldDisplay: "Backlog",
        newDisplay: "Sprint 0 - Preparation",
      },
    ]);

    const moved = makeItem({
      action: TaskHistoryAction.SPRINT_MOVED,
      oldValue: { sprintId: "s1", sprintName: "Sprint 0" },
      newValue: { sprintId: "s2", sprintName: "Sprint 1" },
    });
    expect(getHistorySummaryChip(moved)).toEqual({
      kind: "transition",
      from: "Sprint 0",
      to: "Sprint 1",
    });
  });

  it("formats ASSIGNEE_ADDED and ASSIGNEE_REMOVED concisely and hides userId in details", () => {
    const added = makeItem({
      action: TaskHistoryAction.ASSIGNEE_ADDED,
      newValue: {
        userId: "4ad4e1c8-2c69-438d-8da8-832220dc9274",
        fullName: "Tri Le",
        email: "gamblerstrongest@gmail.com",
      },
    });

    expect(getHistorySummaryChip(added)).toEqual({
      kind: "added",
      text: "+ Tri Le",
    });
    expect(getHistoryDetailRows(added)).toEqual([
      {
        key: "assignee",
        label: "Thành viên",
        newDisplay: "Tri Le (gamblerstrongest@gmail.com)",
      },
    ]);

    const removed = makeItem({
      action: TaskHistoryAction.ASSIGNEE_REMOVED,
      oldValue: { userId: "u2", fullName: "Tri Le", email: "gamblerstrongest@gmail.com" },
    });
    expect(getHistorySummaryChip(removed)).toEqual({
      kind: "removed",
      text: "- Tri Le",
    });
  });

  it("formats CREATED details in Vietnamese and converts assigneeIds to count", () => {
    const created = makeItem({
      action: TaskHistoryAction.CREATED,
      toStatus: TaskStatus.TODO,
      newValue: {
        title: "DOC - Game Design Document",
        priority: TaskPriority.CRITICAL,
        startDate: "2026-11-20T00:00:00.000Z",
        deadline: "2026-12-04T00:00:00.000Z",
        estimateHours: 24,
        assigneeIds: ["u1", "u2", "u3"],
      },
    });

    expect(getHistorySummaryChip(created)).toBeNull();
    const rows = getHistoryDetailRows(created);
    expect(rows.find((r) => r.key === "title")?.newDisplay).toBe("DOC - Game Design Document");
    expect(rows.find((r) => r.key === "priority")?.newDisplay).toBe("Khẩn cấp (Critical)");
    expect(rows.find((r) => r.key === "estimateHours")?.newDisplay).toBe("24 giờ");
    expect(rows.find((r) => r.key === "assigneeCount")?.newDisplay).toBe("3 thành viên");
    expect(rows.find((r) => r.key === "assigneeIds")).toBeUndefined();
  });

  it("formats INFO_UPDATED single and multi-field changes", () => {
    const single = makeItem({
      action: TaskHistoryAction.INFO_UPDATED,
      oldValue: { estimateHours: 8 },
      newValue: { estimateHours: 16 },
    });
    expect(getHistorySummaryChip(single)).toEqual({
      kind: "transition",
      from: "Ước lượng: 8 giờ",
      to: "16 giờ",
    });

    const multi = makeItem({
      action: TaskHistoryAction.INFO_UPDATED,
      oldValue: { title: "A", priority: TaskPriority.LOW },
      newValue: { title: "B", priority: TaskPriority.HIGH },
    });
    expect(getHistorySummaryChip(multi)).toEqual({
      kind: "neutral",
      text: "Tiêu đề, Độ ưu tiên",
    });
  });

  it("formats DEPENDENCY_ADDED and STATUS_CHANGED", () => {
    const dep = makeItem({
      action: TaskHistoryAction.DEPENDENCY_ADDED,
      newValue: {
        dependsOnTaskId: "t-99",
        code: "TSK-99",
        title: "Setup DB",
        status: TaskStatus.IN_PROGRESS,
      },
    });
    expect(getHistorySummaryChip(dep)).toEqual({
      kind: "added",
      text: "+ TSK-99 · Setup DB",
    });
    expect(getHistoryDetailRows(dep)).toEqual([
      {
        key: "dependency",
        label: "Task phụ thuộc",
        newDisplay: "TSK-99 — Setup DB",
      },
      {
        key: "status",
        label: "Trạng thái lúc thao tác",
        newDisplay: "In Progress",
      },
    ]);

    const status = makeItem({
      action: TaskHistoryAction.STATUS_CHANGED,
      fromStatus: TaskStatus.TODO,
      toStatus: TaskStatus.IN_PROGRESS,
    });
    expect(getHistorySummaryChip(status)).toBeNull();
    expect(getHistoryDetailRows(status)).toEqual([]);
  });
});
