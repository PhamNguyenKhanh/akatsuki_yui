import { NextRequest } from "next/server";
import { SprintStatus, TaskPriority, TaskStatus, UserStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  badRequestError,
  conflictError,
  forbiddenError,
  notFoundError,
  unauthorizedError,
} from "@/lib/errors";
import { PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import type { AuthContext } from "@/types/auth";

vi.mock("server-only", () => ({}));

const {
  requireActiveUserMock,
  listProjectSprintsServiceMock,
  createSprintServiceMock,
  getSprintDetailServiceMock,
  updateSprintServiceMock,
  activateSprintServiceMock,
  cancelSprintServiceMock,
  getSprintCompletionPreviewServiceMock,
  completeSprintServiceMock,
  listBacklogTasksServiceMock,
  assignTasksToSprintServiceMock,
  moveSprintTaskServiceMock,
  getKanbanBoardServiceMock,
  getSprintProgressAndBurndownServiceMock,
} = vi.hoisted(() => ({
  requireActiveUserMock: vi.fn(),
  listProjectSprintsServiceMock: vi.fn(),
  createSprintServiceMock: vi.fn(),
  getSprintDetailServiceMock: vi.fn(),
  updateSprintServiceMock: vi.fn(),
  activateSprintServiceMock: vi.fn(),
  cancelSprintServiceMock: vi.fn(),
  getSprintCompletionPreviewServiceMock: vi.fn(),
  completeSprintServiceMock: vi.fn(),
  listBacklogTasksServiceMock: vi.fn(),
  assignTasksToSprintServiceMock: vi.fn(),
  moveSprintTaskServiceMock: vi.fn(),
  getKanbanBoardServiceMock: vi.fn(),
  getSprintProgressAndBurndownServiceMock: vi.fn(),
}));

vi.mock("@/modules/authorization/require-auth", () => ({
  requireActiveUser: requireActiveUserMock,
}));

vi.mock("@/modules/sprints/sprint.service", () => ({
  listProjectSprintsService: listProjectSprintsServiceMock,
  createSprintService: createSprintServiceMock,
  getSprintDetailService: getSprintDetailServiceMock,
  updateSprintService: updateSprintServiceMock,
  activateSprintService: activateSprintServiceMock,
  cancelSprintService: cancelSprintServiceMock,
}));

vi.mock("@/modules/sprints/sprint-completion.service", () => ({
  getSprintCompletionPreviewService: getSprintCompletionPreviewServiceMock,
  completeSprintService: completeSprintServiceMock,
}));

vi.mock("@/modules/sprints/sprint-planning.service", () => ({
  listBacklogTasksService: listBacklogTasksServiceMock,
  assignTasksToSprintService: assignTasksToSprintServiceMock,
  moveSprintTaskService: moveSprintTaskServiceMock,
}));

vi.mock("@/modules/sprints/kanban.service", () => ({
  getKanbanBoardService: getKanbanBoardServiceMock,
}));

vi.mock("@/modules/sprints/sprint-analytics.service", () => ({
  getSprintProgressAndBurndownService: getSprintProgressAndBurndownServiceMock,
}));

import {
  GET as projectSprintsGet,
  POST as projectSprintsPost,
} from "@/app/api/v1/projects/[projectId]/sprints/route";
import { GET as projectBacklogGet } from "@/app/api/v1/projects/[projectId]/backlog/route";
import { GET as projectKanbanGet } from "@/app/api/v1/projects/[projectId]/kanban/route";
import * as sprintDetailRouteModule from "@/app/api/v1/sprints/[sprintId]/route";
import { POST as sprintActivatePost } from "@/app/api/v1/sprints/[sprintId]/activate/route";
import { POST as sprintCancelPost } from "@/app/api/v1/sprints/[sprintId]/cancel/route";
import { GET as sprintCompletionPreviewGet } from "@/app/api/v1/sprints/[sprintId]/completion-preview/route";
import { POST as sprintCompletePost } from "@/app/api/v1/sprints/[sprintId]/complete/route";
import { PUT as sprintTasksPut } from "@/app/api/v1/sprints/[sprintId]/tasks/route";
import { POST as sprintTaskMovePost } from "@/app/api/v1/sprints/[sprintId]/tasks/[taskId]/move/route";
import { GET as sprintBurndownGet } from "@/app/api/v1/sprints/[sprintId]/burndown/route";

const LEADER_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const SPRINT_ID = "33333333-3333-4333-8333-333333333333";
const TARGET_SPRINT_ID = "44444444-4444-4444-8444-444444444444";
const TASK_ID = "55555555-5555-4555-8555-555555555555";

const leaderContext: AuthContext = {
  userId: LEADER_ID,
  email: "leader@akatsuki.local",
  fullName: "Leader",
  status: UserStatus.ACTIVE,
  roles: [ROLES.LEADER],
  permissions: Object.values(PERMISSIONS),
};

describe("Sprint 4 API Route Handlers Contract Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireActiveUserMock.mockResolvedValue(leaderContext);
  });

  it("handles GET and POST /api/v1/projects/[projectId]/sprints with 401, 200, and 201 + overlap meta", async () => {
    requireActiveUserMock.mockRejectedValueOnce(unauthorizedError());
    const unauthRes = await projectSprintsGet(
      new NextRequest(`http://localhost/api/v1/projects/${PROJECT_ID}/sprints`),
      { params: Promise.resolve({ projectId: PROJECT_ID }) }
    );
    expect(unauthRes.status).toBe(401);

    listProjectSprintsServiceMock.mockResolvedValue([
      { id: SPRINT_ID, name: "Sprint 1", status: SprintStatus.PLANNED },
    ]);
    const getRes = await projectSprintsGet(
      new NextRequest(
        `http://localhost/api/v1/projects/${PROJECT_ID}/sprints?status=PLANNED&search=Sprint`
      ),
      { params: Promise.resolve({ projectId: PROJECT_ID }) }
    );
    expect(getRes.status).toBe(200);
    expect(listProjectSprintsServiceMock).toHaveBeenCalledWith(leaderContext, PROJECT_ID, {
      status: "PLANNED",
      search: "Sprint",
    });

    createSprintServiceMock.mockResolvedValue({
      sprint: { id: SPRINT_ID, name: "Sprint 1", status: SprintStatus.PLANNED },
      overlappingSprints: [{ id: TARGET_SPRINT_ID, name: "Sprint Overlap" }],
    });
    const postRes = await projectSprintsPost(
      new Request(`http://localhost/api/v1/projects/${PROJECT_ID}/sprints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Sprint 1",
          startDate: "2026-11-16",
          endDate: "2026-11-30",
        }),
      }),
      { params: Promise.resolve({ projectId: PROJECT_ID }) }
    );
    expect(postRes.status).toBe(201);
    const postJson = await postRes.json();
    expect(postJson.data.id).toBe(SPRINT_ID);
    expect(postJson.meta.overlappingSprints).toHaveLength(1);
  });

  it("handles GET /api/v1/projects/[projectId]/backlog (paginated) and GET /kanban", async () => {
    listBacklogTasksServiceMock.mockResolvedValue({
      items: [{ id: TASK_ID, title: "Backlog Item", status: TaskStatus.TODO }],
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1,
    });

    const backlogRes = await projectBacklogGet(
      new NextRequest(
        `http://localhost/api/v1/projects/${PROJECT_ID}/backlog?priority=${TaskPriority.HIGH}&unassignedOnly=true`
      ),
      { params: Promise.resolve({ projectId: PROJECT_ID }) }
    );
    expect(backlogRes.status).toBe(200);
    expect(listBacklogTasksServiceMock).toHaveBeenCalledWith(leaderContext, PROJECT_ID, {
      priority: TaskPriority.HIGH,
      unassignedOnly: "true",
    });
    const backlogJson = await backlogRes.json();
    expect(backlogJson.meta).toEqual({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });

    getKanbanBoardServiceMock.mockResolvedValue({
      scope: "SPRINT",
      selectedSprint: { id: SPRINT_ID, name: "Sprint 1", status: SprintStatus.ACTIVE },
      totalTasks: 0,
      truncated: false,
      columns: { TODO: [], IN_PROGRESS: [], REVIEW: [], DONE: [] },
    });
    const kanbanRes = await projectKanbanGet(
      new NextRequest(
        `http://localhost/api/v1/projects/${PROJECT_ID}/kanban?scope=SPRINT&sprintId=${SPRINT_ID}`
      ),
      { params: Promise.resolve({ projectId: PROJECT_ID }) }
    );
    expect(kanbanRes.status).toBe(200);
    expect(getKanbanBoardServiceMock).toHaveBeenCalledWith(leaderContext, PROJECT_ID, {
      scope: "SPRINT",
      sprintId: SPRINT_ID,
    });
  });

  it("handles GET and PATCH /api/v1/sprints/[sprintId] and forbids DELETE", async () => {
    expect("DELETE" in sprintDetailRouteModule).toBe(false);

    getSprintDetailServiceMock.mockRejectedValueOnce(notFoundError("Không tìm thấy Sprint."));
    const notFoundRes = await sprintDetailRouteModule.GET(new Request("http://localhost"), {
      params: Promise.resolve({ sprintId: SPRINT_ID }),
    });
    expect(notFoundRes.status).toBe(404);

    updateSprintServiceMock.mockRejectedValueOnce(
      forbiddenError("Bạn không có quyền quản lý Sprint trong Project này.")
    );
    const forbiddenRes = await sprintDetailRouteModule.PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Renamed" }),
      }),
      { params: Promise.resolve({ sprintId: SPRINT_ID }) }
    );
    expect(forbiddenRes.status).toBe(403);

    updateSprintServiceMock.mockResolvedValueOnce({
      sprint: { id: SPRINT_ID, name: "Sprint Updated" },
      overlappingSprints: [],
    });
    const okPatchRes = await sprintDetailRouteModule.PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Sprint Updated" }),
      }),
      { params: Promise.resolve({ sprintId: SPRINT_ID }) }
    );
    expect(okPatchRes.status).toBe(200);
    const okPatchJson = await okPatchRes.json();
    expect(okPatchJson.meta).toBeUndefined();
  });

  it("handles activate, cancel (empty & invalid JSON), completion-preview, and complete (200 & 409)", async () => {
    activateSprintServiceMock.mockResolvedValue({ id: SPRINT_ID, status: SprintStatus.ACTIVE });
    const actRes = await sprintActivatePost(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ sprintId: SPRINT_ID }),
    });
    expect(actRes.status).toBe(200);

    cancelSprintServiceMock.mockResolvedValue({ id: SPRINT_ID, status: SprintStatus.CANCELLED });
    const emptyCancelRes = await sprintCancelPost(
      new Request("http://localhost", { method: "POST" }),
      { params: Promise.resolve({ sprintId: SPRINT_ID }) }
    );
    expect(emptyCancelRes.status).toBe(200);
    expect(cancelSprintServiceMock).toHaveBeenCalledWith(leaderContext, SPRINT_ID, {});

    const badJsonCancelRes = await sprintCancelPost(
      new Request("http://localhost", { method: "POST", body: "{broken" }),
      { params: Promise.resolve({ sprintId: SPRINT_ID }) }
    );
    expect(badJsonCancelRes.status).toBe(400);

    getSprintCompletionPreviewServiceMock.mockResolvedValue({
      sprint: { id: SPRINT_ID, status: SprintStatus.ACTIVE },
      doneTasksCount: 2,
      unfinishedTasks: [],
      availableTargetSprints: [],
    });
    const previewRes = await sprintCompletionPreviewGet(new Request("http://localhost"), {
      params: Promise.resolve({ sprintId: SPRINT_ID }),
    });
    expect(previewRes.status).toBe(200);

    completeSprintServiceMock.mockRejectedValueOnce(
      conflictError("SPRINT_UNFINISHED_TASKS_REQUIRE_DISPOSITION", "Vẫn còn Task chưa hoàn thành.")
    );
    const conflictCompleteRes = await sprintCompletePost(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskDispositions: [] }),
      }),
      { params: Promise.resolve({ sprintId: SPRINT_ID }) }
    );
    expect(conflictCompleteRes.status).toBe(409);
    expect((await conflictCompleteRes.json()).error.code).toBe(
      "SPRINT_UNFINISHED_TASKS_REQUIRE_DISPOSITION"
    );

    completeSprintServiceMock.mockResolvedValueOnce({
      id: SPRINT_ID,
      status: SprintStatus.COMPLETED,
    });
    const okCompleteRes = await sprintCompletePost(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskDispositions: [] }),
      }),
      { params: Promise.resolve({ sprintId: SPRINT_ID }) }
    );
    expect(okCompleteRes.status).toBe(200);
  });

  it("handles sprint planning PUT /tasks, POST /move, and GET /burndown", async () => {
    assignTasksToSprintServiceMock.mockResolvedValue({
      sprintId: SPRINT_ID,
      addedCount: 1,
      tasks: [{ id: TASK_ID }],
    });
    const assignRes = await sprintTasksPut(
      new Request("http://localhost", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: [TASK_ID] }),
      }),
      { params: Promise.resolve({ sprintId: SPRINT_ID }) }
    );
    expect(assignRes.status).toBe(200);

    moveSprintTaskServiceMock.mockRejectedValueOnce(
      badRequestError("Dữ liệu di chuyển Task khỏi Sprint không hợp lệ.")
    );
    const badMoveRes = await sprintTaskMovePost(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetSprintId: "not-a-uuid" }),
      }),
      { params: Promise.resolve({ sprintId: SPRINT_ID, taskId: TASK_ID }) }
    );
    expect(badMoveRes.status).toBe(400);

    moveSprintTaskServiceMock.mockResolvedValueOnce({ id: TASK_ID, sprintId: TARGET_SPRINT_ID });
    const okMoveRes = await sprintTaskMovePost(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetSprintId: TARGET_SPRINT_ID }),
      }),
      { params: Promise.resolve({ sprintId: SPRINT_ID, taskId: TASK_ID }) }
    );
    expect(okMoveRes.status).toBe(200);

    getSprintProgressAndBurndownServiceMock.mockResolvedValue({
      sprintId: SPRINT_ID,
      progress: { totalTasks: 1, doneCount: 1, progressPercent: 100 },
      burndown: { hasEstimateData: true, timezone: "Asia/Ho_Chi_Minh", points: [] },
    });
    const burndownRes = await sprintBurndownGet(new Request("http://localhost"), {
      params: Promise.resolve({ sprintId: SPRINT_ID }),
    });
    expect(burndownRes.status).toBe(200);
    expect((await burndownRes.json()).data.burndown.timezone).toBe("Asia/Ho_Chi_Minh");
  });
});
