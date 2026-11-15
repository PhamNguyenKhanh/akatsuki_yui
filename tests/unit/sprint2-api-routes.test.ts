import { NextRequest } from "next/server";
import { ProjectMemberRole, ProjectStatus, UserStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { conflictError, forbiddenError, unauthorizedError } from "@/lib/errors";
import { PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import type { AuthContext } from "@/types/auth";

const {
  requireActiveUserMock,
  getPermissionMatrixServiceMock,
  grantRolePermissionServiceMock,
  revokeRolePermissionServiceMock,
  listProjectTemplatesServiceMock,
  createProjectTemplateServiceMock,
  deleteProjectTemplateServiceMock,
  listProjectsServiceMock,
  createProjectServiceMock,
  activateProjectServiceMock,
  restoreProjectServiceMock,
  addProjectMemberServiceMock,
  changeProjectLeaderServiceMock,
  removeProjectMemberServiceMock,
} = vi.hoisted(() => ({
  requireActiveUserMock: vi.fn(),
  getPermissionMatrixServiceMock: vi.fn(),
  grantRolePermissionServiceMock: vi.fn(),
  revokeRolePermissionServiceMock: vi.fn(),
  listProjectTemplatesServiceMock: vi.fn(),
  createProjectTemplateServiceMock: vi.fn(),
  deleteProjectTemplateServiceMock: vi.fn(),
  listProjectsServiceMock: vi.fn(),
  createProjectServiceMock: vi.fn(),
  activateProjectServiceMock: vi.fn(),
  restoreProjectServiceMock: vi.fn(),
  addProjectMemberServiceMock: vi.fn(),
  changeProjectLeaderServiceMock: vi.fn(),
  removeProjectMemberServiceMock: vi.fn(),
}));

vi.mock("@/modules/authorization/require-auth", () => ({
  requireActiveUser: requireActiveUserMock,
}));

vi.mock("@/modules/roles/role.service", () => ({
  getPermissionMatrixService: getPermissionMatrixServiceMock,
  grantRolePermissionService: grantRolePermissionServiceMock,
  revokeRolePermissionService: revokeRolePermissionServiceMock,
  toggleRolePermissionService: vi.fn(),
}));

vi.mock("@/modules/project-templates/template.service", () => ({
  listProjectTemplatesService: listProjectTemplatesServiceMock,
  createProjectTemplateService: createProjectTemplateServiceMock,
  getProjectTemplateDetailService: vi.fn(),
  updateProjectTemplateService: vi.fn(),
  deleteProjectTemplateService: deleteProjectTemplateServiceMock,
}));

vi.mock("@/modules/projects/project.service", () => ({
  listProjectsService: listProjectsServiceMock,
  createProjectService: createProjectServiceMock,
  getProjectDetailService: vi.fn(),
  updateProjectService: vi.fn(),
  activateProjectService: activateProjectServiceMock,
  archiveProjectService: vi.fn(),
  restoreProjectService: restoreProjectServiceMock,
}));

vi.mock("@/modules/project-members/member.service", () => ({
  listProjectMembersService: vi.fn(),
  addProjectMemberService: addProjectMemberServiceMock,
  changeProjectLeaderService: changeProjectLeaderServiceMock,
  removeProjectMemberService: removeProjectMemberServiceMock,
}));

import { GET as rolesGet } from "@/app/api/v1/roles/route";
import {
  DELETE as rolePermissionDelete,
  POST as rolePermissionPost,
} from "@/app/api/v1/roles/[roleId]/permissions/route";
import { GET as templatesGet, POST as templatesPost } from "@/app/api/v1/project-templates/route";
import { DELETE as templateDelete } from "@/app/api/v1/project-templates/[templateId]/route";
import { GET as projectsGet, POST as projectsPost } from "@/app/api/v1/projects/route";
import { POST as projectActivatePost } from "@/app/api/v1/projects/[projectId]/activate/route";
import { POST as projectRestorePost } from "@/app/api/v1/projects/[projectId]/restore/route";
import { POST as projectMembersPost } from "@/app/api/v1/projects/[projectId]/members/route";
import { DELETE as projectMemberDelete } from "@/app/api/v1/projects/[projectId]/members/[userId]/route";
import { PATCH as projectLeaderPatch } from "@/app/api/v1/projects/[projectId]/leader/route";

const adminContext: AuthContext = {
  userId: "11111111-1111-4111-8111-111111111111",
  email: "admin@akatsuki.local",
  fullName: "Admin",
  status: UserStatus.ACTIVE,
  roles: [ROLES.ADMIN],
  permissions: Object.values(PERMISSIONS),
};

describe("Sprint 2 REST API Route Contract Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireActiveUserMock.mockResolvedValue(adminContext);
  });

  it("handles /api/v1/roles GET 401 and 200", async () => {
    requireActiveUserMock.mockRejectedValueOnce(unauthorizedError());
    const unauthRes = await rolesGet();
    expect(unauthRes.status).toBe(401);

    getPermissionMatrixServiceMock.mockResolvedValue({
      roles: [],
      permissions: [],
      coreAdminPermissions: [],
    });
    const okRes = await rolesGet();
    expect(okRes.status).toBe(200);
  });

  it("handles /api/v1/roles/[roleId]/permissions POST and DELETE 409 lock", async () => {
    grantRolePermissionServiceMock.mockResolvedValue({ id: "r1", permissionCodes: ["task.read"] });
    const postReq = new Request("http://localhost/api/v1/roles/r1/permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissionCode: "task.read" }),
    });
    const postRes = await rolePermissionPost(postReq, {
      params: Promise.resolve({ roleId: "r1" }),
    });
    expect(postRes.status).toBe(200);

    revokeRolePermissionServiceMock.mockRejectedValueOnce(
      conflictError("CORE_ADMIN_PERMISSION_LOCKED", "Locked")
    );
    const delReq = new NextRequest(
      "http://localhost/api/v1/roles/r1/permissions?permissionCode=role.manage",
      { method: "DELETE" }
    );
    const delRes = await rolePermissionDelete(delReq, {
      params: Promise.resolve({ roleId: "r1" }),
    });
    expect(delRes.status).toBe(409);
    const body = await delRes.json();
    expect(body.error.code).toBe("CORE_ADMIN_PERMISSION_LOCKED");
  });

  it("handles /api/v1/project-templates GET/POST and DELETE conflict", async () => {
    listProjectTemplatesServiceMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
    });
    const getReq = new NextRequest("http://localhost/api/v1/project-templates?activeOnly=true");
    const getRes = await templatesGet(getReq);
    expect(getRes.status).toBe(200);
    expect(listProjectTemplatesServiceMock).toHaveBeenCalledWith(adminContext, {
      activeOnly: "true",
    });

    createProjectTemplateServiceMock.mockResolvedValue({ id: "t1", name: "Capstone" });
    const postReq = new Request("http://localhost/api/v1/project-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Capstone" }),
    });
    const postRes = await templatesPost(postReq);
    expect(postRes.status).toBe(201);

    deleteProjectTemplateServiceMock.mockRejectedValueOnce(
      conflictError("TEMPLATE_IN_USE", "In use")
    );
    const delRes = await templateDelete(new Request("http://localhost"), {
      params: Promise.resolve({ templateId: "t1" }),
    });
    expect(delRes.status).toBe(409);
  });

  it("handles /api/v1/projects CRUD, activate conflict, and admin-only restore", async () => {
    listProjectsServiceMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 1,
    });
    const getRes = await projectsGet(new NextRequest("http://localhost/api/v1/projects"));
    expect(getRes.status).toBe(200);

    createProjectServiceMock.mockResolvedValue({ id: "p1", status: ProjectStatus.CREATED });
    const createReq = new Request("http://localhost/api/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Project X",
        startDate: "2026-11-01",
        endDate: "2026-12-01",
      }),
    });
    const createRes = await projectsPost(createReq);
    expect(createRes.status).toBe(201);

    activateProjectServiceMock.mockRejectedValueOnce(
      conflictError("PROJECT_ALREADY_ACTIVE", "Active project exists")
    );
    const actRes = await projectActivatePost(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ projectId: "p1" }),
    });
    expect(actRes.status).toBe(409);

    restoreProjectServiceMock.mockRejectedValueOnce(forbiddenError());
    const restoreReq = new Request("http://localhost/api/v1/projects/p1/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetStatus: "CREATED" }),
    });
    const restoreRes = await projectRestorePost(restoreReq, {
      params: Promise.resolve({ projectId: "p1" }),
    });
    expect(restoreRes.status).toBe(403);
  });

  it("handles /api/v1/projects/[projectId]/members and /leader routes", async () => {
    addProjectMemberServiceMock.mockResolvedValue({
      id: "m1",
      projectRole: ProjectMemberRole.MEMBER,
    });
    const addReq = new Request("http://localhost/api/v1/projects/p1/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "22222222-2222-4222-8222-222222222222",
        projectRole: "MEMBER",
      }),
    });
    const addRes = await projectMembersPost(addReq, {
      params: Promise.resolve({ projectId: "p1" }),
    });
    expect(addRes.status).toBe(201);

    changeProjectLeaderServiceMock.mockResolvedValue([]);
    const leaderReq = new Request("http://localhost/api/v1/projects/p1/leader", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaderId: "22222222-2222-4222-8222-222222222222" }),
    });
    const leaderRes = await projectLeaderPatch(leaderReq, {
      params: Promise.resolve({ projectId: "p1" }),
    });
    expect(leaderRes.status).toBe(200);

    removeProjectMemberServiceMock.mockResolvedValue({
      id: "m1",
      leftAt: new Date().toISOString(),
    });
    const delRes = await projectMemberDelete(
      new Request("http://localhost", { method: "DELETE" }),
      {
        params: Promise.resolve({ projectId: "p1", userId: "u2" }),
      }
    );
    expect(delRes.status).toBe(200);
  });
});
