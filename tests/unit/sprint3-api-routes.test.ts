import { NextRequest } from "next/server";
import { TaskPriority, TaskStatus, UserStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { conflictError, forbiddenError, notFoundError, unauthorizedError } from "@/lib/errors";
import { PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import type { AuthContext } from "@/types/auth";

vi.mock("server-only", () => ({}));

const {
  requireActiveUserMock,
  listProjectTasksServiceMock,
  createTaskServiceMock,
  getTaskDetailServiceMock,
  updateTaskServiceMock,
  listTaskAssigneesServiceMock,
  syncTaskAssigneesServiceMock,
  addTaskAssigneeServiceMock,
  removeTaskAssigneeServiceMock,
  submitTaskForReviewServiceMock,
  approveTaskReviewServiceMock,
  rejectTaskReviewServiceMock,
  listTaskDependenciesServiceMock,
  addTaskDependencyServiceMock,
  removeTaskDependencyServiceMock,
  listTaskHistoryServiceMock,
} = vi.hoisted(() => ({
  requireActiveUserMock: vi.fn(),
  listProjectTasksServiceMock: vi.fn(),
  createTaskServiceMock: vi.fn(),
  getTaskDetailServiceMock: vi.fn(),
  updateTaskServiceMock: vi.fn(),
  listTaskAssigneesServiceMock: vi.fn(),
  syncTaskAssigneesServiceMock: vi.fn(),
  addTaskAssigneeServiceMock: vi.fn(),
  removeTaskAssigneeServiceMock: vi.fn(),
  submitTaskForReviewServiceMock: vi.fn(),
  approveTaskReviewServiceMock: vi.fn(),
  rejectTaskReviewServiceMock: vi.fn(),
  listTaskDependenciesServiceMock: vi.fn(),
  addTaskDependencyServiceMock: vi.fn(),
  removeTaskDependencyServiceMock: vi.fn(),
  listTaskHistoryServiceMock: vi.fn(),
}));

vi.mock("@/modules/authorization/require-auth", () => ({
  requireActiveUser: requireActiveUserMock,
}));

vi.mock("@/modules/tasks/task.service", () => ({
  listProjectTasksService: listProjectTasksServiceMock,
  createTaskService: createTaskServiceMock,
  getTaskDetailService: getTaskDetailServiceMock,
  updateTaskService: updateTaskServiceMock,
}));

vi.mock("@/modules/tasks/task-assignment.service", () => ({
  listTaskAssigneesService: listTaskAssigneesServiceMock,
  syncTaskAssigneesService: syncTaskAssigneesServiceMock,
  addTaskAssigneeService: addTaskAssigneeServiceMock,
  removeTaskAssigneeService: removeTaskAssigneeServiceMock,
}));

vi.mock("@/modules/tasks/task-workflow.service", () => ({
  submitTaskForReviewService: submitTaskForReviewServiceMock,
  approveTaskReviewService: approveTaskReviewServiceMock,
  rejectTaskReviewService: rejectTaskReviewServiceMock,
}));

vi.mock("@/modules/tasks/task-dependency.service", () => ({
  listTaskDependenciesService: listTaskDependenciesServiceMock,
  addTaskDependencyService: addTaskDependencyServiceMock,
  removeTaskDependencyService: removeTaskDependencyServiceMock,
}));

vi.mock("@/modules/tasks/task-history.service", () => ({
  listTaskHistoryService: listTaskHistoryServiceMock,
}));

import {
  GET as projectTasksGet,
  POST as projectTasksPost,
} from "@/app/api/v1/projects/[projectId]/tasks/route";
import * as taskDetailRouteModule from "@/app/api/v1/tasks/[taskId]/route";
import {
  GET as assigneesGet,
  POST as assigneesPost,
  PUT as assigneesPut,
} from "@/app/api/v1/tasks/[taskId]/assignees/route";
import { DELETE as assigneeDelete } from "@/app/api/v1/tasks/[taskId]/assignees/[userId]/route";
import { POST as submitReviewPost } from "@/app/api/v1/tasks/[taskId]/submit-review/route";
import { POST as approvePost } from "@/app/api/v1/tasks/[taskId]/approve/route";
import { POST as rejectPost } from "@/app/api/v1/tasks/[taskId]/reject/route";
import {
  GET as dependenciesGet,
  POST as dependenciesPost,
} from "@/app/api/v1/tasks/[taskId]/dependencies/route";
import { DELETE as dependencyDelete } from "@/app/api/v1/tasks/[taskId]/dependencies/[dependsOnTaskId]/route";
import { GET as historyGet } from "@/app/api/v1/tasks/[taskId]/history/route";

const LEADER_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const TASK_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "44444444-4444-4444-8444-444444444444";
const DEP_TASK_ID = "55555555-5555-4555-8555-555555555555";

const leaderContext: AuthContext = {
  userId: LEADER_ID,
  email: "leader@akatsuki.local",
  fullName: "Leader",
  status: UserStatus.ACTIVE,
  roles: [ROLES.LEADER],
  permissions: Object.values(PERMISSIONS),
};

describe("Sprint 3 API Route Handlers Contract Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireActiveUserMock.mockResolvedValue(leaderContext);
  });

  it("handles GET and POST /api/v1/projects/[projectId]/tasks with 401, 200 paginated, and 201", async () => {
    requireActiveUserMock.mockRejectedValueOnce(unauthorizedError());
    const unauthRes = await projectTasksGet(
      new NextRequest(`http://localhost/api/v1/projects/${PROJECT_ID}/tasks`),
      { params: Promise.resolve({ projectId: PROJECT_ID }) }
    );
    expect(unauthRes.status).toBe(401);

    listProjectTasksServiceMock.mockResolvedValue({
      items: [{ id: TASK_ID, code: "#33333333", title: "Task 1", status: TaskStatus.TODO }],
      page: 2,
      pageSize: 10,
      totalItems: 15,
      totalPages: 2,
    });
    const getRes = await projectTasksGet(
      new NextRequest(
        `http://localhost/api/v1/projects/${PROJECT_ID}/tasks?status=TODO&priority=HIGH&page=2`
      ),
      { params: Promise.resolve({ projectId: PROJECT_ID }) }
    );
    expect(getRes.status).toBe(200);
    expect(listProjectTasksServiceMock).toHaveBeenCalledWith(leaderContext, PROJECT_ID, {
      status: "TODO",
      priority: "HIGH",
      page: "2",
    });
    const getJson = await getRes.json();
    expect(getJson.data).toHaveLength(1);
    expect(getJson.meta).toEqual({
      page: 2,
      pageSize: 10,
      total: 15,
      totalPages: 2,
    });

    createTaskServiceMock.mockResolvedValue({ id: TASK_ID, title: "New Task" });
    const postRes = await projectTasksPost(
      new Request(`http://localhost/api/v1/projects/${PROJECT_ID}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Task",
          priority: TaskPriority.HIGH,
          deadline: "2026-12-01T00:00:00.000Z",
        }),
      }),
      { params: Promise.resolve({ projectId: PROJECT_ID }) }
    );
    expect(postRes.status).toBe(201);
    const postJson = await postRes.json();
    expect(postJson.data.id).toBe(TASK_ID);
  });

  it("handles GET/PATCH /api/v1/tasks/[taskId] and ensures DELETE is absent per OQ-01", async () => {
    expect("DELETE" in taskDetailRouteModule).toBe(false);

    getTaskDetailServiceMock.mockRejectedValueOnce(notFoundError("Missing"));
    const notFoundRes = await taskDetailRouteModule.GET(new Request("http://localhost"), {
      params: Promise.resolve({ taskId: TASK_ID }),
    });
    expect(notFoundRes.status).toBe(404);

    updateTaskServiceMock.mockRejectedValueOnce(
      forbiddenError("Member cannot edit Leader-only fields.")
    );
    const forbiddenRes = await taskDetailRouteModule.PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Blocked" }),
      }),
      { params: Promise.resolve({ taskId: TASK_ID }) }
    );
    expect(forbiddenRes.status).toBe(403);

    updateTaskServiceMock.mockResolvedValueOnce({
      id: TASK_ID,
      status: TaskStatus.IN_PROGRESS,
    });
    const okPatchRes = await taskDetailRouteModule.PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: TaskStatus.IN_PROGRESS }),
      }),
      { params: Promise.resolve({ taskId: TASK_ID }) }
    );
    expect(okPatchRes.status).toBe(200);
  });

  it("handles assignees GET, PUT, POST (201), and DELETE", async () => {
    listTaskAssigneesServiceMock.mockResolvedValue([]);
    const getRes = await assigneesGet(new Request("http://localhost"), {
      params: Promise.resolve({ taskId: TASK_ID }),
    });
    expect(getRes.status).toBe(200);

    syncTaskAssigneesServiceMock.mockResolvedValue([{ userId: USER_ID }]);
    const putRes = await assigneesPut(
      new Request("http://localhost", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeIds: [USER_ID] }),
      }),
      { params: Promise.resolve({ taskId: TASK_ID }) }
    );
    expect(putRes.status).toBe(200);

    addTaskAssigneeServiceMock.mockRejectedValueOnce(
      conflictError("ASSIGNEE_NOT_PROJECT_MEMBER", "Not a project member")
    );
    const conflictRes = await assigneesPost(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: USER_ID }),
      }),
      { params: Promise.resolve({ taskId: TASK_ID }) }
    );
    expect(conflictRes.status).toBe(409);
    expect((await conflictRes.json()).error.code).toBe("ASSIGNEE_NOT_PROJECT_MEMBER");

    removeTaskAssigneeServiceMock.mockResolvedValue([]);
    const delRes = await assigneeDelete(new Request("http://localhost", { method: "DELETE" }), {
      params: Promise.resolve({ taskId: TASK_ID, userId: USER_ID }),
    });
    expect(delRes.status).toBe(200);
  });

  it("handles submit-review (empty body or JSON), approve, and reject conflicts", async () => {
    submitTaskForReviewServiceMock.mockResolvedValue({ id: TASK_ID, status: TaskStatus.REVIEW });
    const emptyBodySubmit = await submitReviewPost(
      new Request("http://localhost", { method: "POST" }),
      { params: Promise.resolve({ taskId: TASK_ID }) }
    );
    expect(emptyBodySubmit.status).toBe(200);
    expect(submitTaskForReviewServiceMock).toHaveBeenCalledWith(leaderContext, TASK_ID, {});

    const invalidJsonSubmit = await submitReviewPost(
      new Request("http://localhost", { method: "POST", body: "{invalid" }),
      { params: Promise.resolve({ taskId: TASK_ID }) }
    );
    expect(invalidJsonSubmit.status).toBe(400);

    approveTaskReviewServiceMock.mockRejectedValueOnce(
      conflictError("TASK_DEPENDENCY_NOT_COMPLETED", "Blocked")
    );
    const blockedApprove = await approvePost(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Approve" }),
      }),
      { params: Promise.resolve({ taskId: TASK_ID }) }
    );
    expect(blockedApprove.status).toBe(409);
    expect((await blockedApprove.json()).error.code).toBe("TASK_DEPENDENCY_NOT_COMPLETED");

    rejectTaskReviewServiceMock.mockRejectedValueOnce(
      conflictError("REVIEW_REASON_REQUIRED", "Reason required")
    );
    const blankReject = await rejectPost(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "" }),
      }),
      { params: Promise.resolve({ taskId: TASK_ID }) }
    );
    expect(blankReject.status).toBe(409);
    expect((await blankReject.json()).error.code).toBe("REVIEW_REASON_REQUIRED");
  });

  it("handles dependencies GET/POST/DELETE and history GET paginated", async () => {
    listTaskDependenciesServiceMock.mockResolvedValue([]);
    expect(
      (
        await dependenciesGet(new Request("http://localhost"), {
          params: Promise.resolve({ taskId: TASK_ID }),
        })
      ).status
    ).toBe(200);

    addTaskDependencyServiceMock.mockRejectedValueOnce(
      conflictError("TASK_DEPENDENCY_CYCLE", "Cycle")
    );
    const cycleRes = await dependenciesPost(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependsOnTaskId: DEP_TASK_ID }),
      }),
      { params: Promise.resolve({ taskId: TASK_ID }) }
    );
    expect(cycleRes.status).toBe(409);
    expect((await cycleRes.json()).error.code).toBe("TASK_DEPENDENCY_CYCLE");

    removeTaskDependencyServiceMock.mockResolvedValue([]);
    const delDepRes = await dependencyDelete(
      new Request("http://localhost", { method: "DELETE" }),
      {
        params: Promise.resolve({ taskId: TASK_ID, dependsOnTaskId: DEP_TASK_ID }),
      }
    );
    expect(delDepRes.status).toBe(200);

    listTaskHistoryServiceMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 1,
    });
    const histRes = await historyGet(
      new NextRequest(`http://localhost/api/v1/tasks/${TASK_ID}/history?page=1&pageSize=20`),
      { params: Promise.resolve({ taskId: TASK_ID }) }
    );
    expect(histRes.status).toBe(200);
    expect((await histRes.json()).meta).toEqual({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
    });
  });
});
