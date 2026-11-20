import { ProjectMemberRole, ProjectStatus, UserStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { conflictError } from "@/lib/errors";
import { CORE_ADMIN_PERMISSION_CODES, PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import type { AuthContext } from "@/types/auth";

const {
  prismaMock,
  roleRepoMock,
  templateRepoMock,
  projectRepoMock,
  projectMemberRepoMock,
  taskGuardMock,
} = vi.hoisted(() => {
  const txMock = {
    rolePermission: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    projectTemplate: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    projectMember: {
      findFirst: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
  };

  return {
    prismaMock: {
      $transaction: vi.fn(async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock)),
      __tx: txMock,
    },
    roleRepoMock: {
      listRolesAndPermissions: vi.fn(),
      findRoleById: vi.fn(),
      findPermission: vi.fn(),
    },
    templateRepoMock: {
      findManyPaginated: vi.fn(),
      findById: vi.fn(),
    },
    projectRepoMock: {
      findManyPaginated: vi.fn(),
      findById: vi.fn(),
      findOtherActiveProject: vi.fn(),
      findAccessibleActiveProject: vi.fn(),
    },
    projectMemberRepoMock: {
      listByProject: vi.fn(),
      findActiveMembership: vi.fn(),
    },
    taskGuardMock: {
      assertNoActiveProjectTasks: vi.fn(),
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/modules/roles/role.repository", async () => {
  const actual = await vi.importActual<typeof import("@/modules/roles/role.repository")>(
    "@/modules/roles/role.repository"
  );
  return {
    ...actual,
    roleRepository: roleRepoMock,
    mapRoleToDTO: (row: unknown) => row,
  };
});

vi.mock("@/modules/project-templates/template.repository", async () => {
  const actual = await vi.importActual<
    typeof import("@/modules/project-templates/template.repository")
  >("@/modules/project-templates/template.repository");
  return {
    ...actual,
    projectTemplateRepository: templateRepoMock,
  };
});

vi.mock("@/modules/projects/project.repository", async () => {
  const actual = await vi.importActual<typeof import("@/modules/projects/project.repository")>(
    "@/modules/projects/project.repository"
  );
  return {
    ...actual,
    projectRepository: projectRepoMock,
  };
});

vi.mock("@/modules/project-members/member.repository", async () => {
  const actual = await vi.importActual<
    typeof import("@/modules/project-members/member.repository")
  >("@/modules/project-members/member.repository");
  return {
    ...actual,
    projectMemberRepository: projectMemberRepoMock,
  };
});

vi.mock("@/modules/project-members/task-assignment-guard", () => ({
  taskAssignmentGuard: taskGuardMock,
}));

import { createProjectSchema } from "@/modules/projects/project.schema";
import {
  activateProjectService,
  createProjectService,
  getAccessibleActiveProjectSummaryService,
  restoreProjectService,
  updateProjectService,
} from "@/modules/projects/project.service";
import { deleteProjectTemplateService } from "@/modules/project-templates/template.service";
import {
  addProjectMemberService,
  removeProjectMemberService,
} from "@/modules/project-members/member.service";
import { revokeRolePermissionService } from "@/modules/roles/role.service";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const LEADER_ID = "22222222-2222-4222-8222-222222222222";
const MEMBER_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_USER_ID = "44444444-4444-4444-8444-444444444444";
const PROJECT_ID = "55555555-5555-4555-8555-555555555555";
const ROLE_ID = "66666666-6666-4666-8666-666666666666";
const PERM_ID = "77777777-7777-4777-8777-777777777777";
const TEMPLATE_ID = "88888888-8888-4888-8888-888888888888";

const adminActor: AuthContext = {
  userId: ADMIN_ID,
  email: "admin@akatsuki.local",
  fullName: "Admin User",
  status: UserStatus.ACTIVE,
  roles: [ROLES.ADMIN],
  permissions: Object.values(PERMISSIONS),
};

const leaderActor: AuthContext = {
  userId: LEADER_ID,
  email: "leader@akatsuki.local",
  fullName: "Leader User",
  status: UserStatus.ACTIVE,
  roles: [ROLES.LEADER],
  permissions: [
    PERMISSIONS.PROJECT_CREATE,
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.PROJECT_UPDATE,
    PERMISSIONS.PROJECT_ACTIVATE,
    PERMISSIONS.PROJECT_ARCHIVE,
    PERMISSIONS.PROJECT_MEMBER_MANAGE,
  ],
};

const memberActor: AuthContext = {
  userId: MEMBER_ID,
  email: "member@akatsuki.local",
  fullName: "Member User",
  status: UserStatus.ACTIVE,
  roles: [ROLES.MEMBER],
  permissions: [PERMISSIONS.PROJECT_READ],
};

describe("Sprint 2 Business Rules & Service Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    taskGuardMock.assertNoActiveProjectTasks.mockResolvedValue(undefined);
  });

  describe("Project Validation Schema", () => {
    it("rejects endDate before startDate and dangerous repositoryUrl schemes", () => {
      const invalidDate = createProjectSchema.safeParse({
        name: "Test Project",
        startDate: "2026-12-10",
        endDate: "2026-12-01",
      });
      expect(invalidDate.success).toBe(false);

      const invalidUrl = createProjectSchema.safeParse({
        name: "Test Project",
        startDate: "2026-12-01",
        endDate: "2026-12-10",
        repositoryUrl: "javascript:alert(1)",
      });
      expect(invalidUrl.success).toBe(false);
    });

    it("accepts null templateId and instructorId and deduplicates technologies", () => {
      const valid = createProjectSchema.parse({
        name: "Akatsuki Portal",
        startDate: "2026-12-01",
        endDate: "2026-12-10",
        templateId: null,
        instructorId: null,
        technologies: ["Next.js", "next.js", "Prisma", "PostgreSQL"],
      });

      expect(valid.templateId).toBeNull();
      expect(valid.instructorId).toBeNull();
      expect(valid.technologies).toEqual(["Next.js", "Prisma", "PostgreSQL"]);
    });
  });

  describe("Module 1 — Permission Matrix Guards", () => {
    it("forbids non-ROLE_MANAGE actors from revoking permissions", async () => {
      await expect(
        revokeRolePermissionService(leaderActor, ROLE_ID, { permissionCode: PERMISSIONS.TASK_READ })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "FORBIDDEN",
      });
    });

    it("blocks revoking core administrative permissions from ADMIN role (BR-AUTHZ-008)", async () => {
      const lockedCode = CORE_ADMIN_PERMISSION_CODES[0];
      roleRepoMock.findRoleById.mockResolvedValue({
        id: ROLE_ID,
        name: ROLES.ADMIN,
        rolePermissions: [],
      });
      roleRepoMock.findPermission.mockResolvedValue({
        id: PERM_ID,
        code: lockedCode,
        name: "Core Permission",
      });

      await expect(
        revokeRolePermissionService(adminActor, ROLE_ID, { permissionId: PERM_ID })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "CORE_ADMIN_PERMISSION_LOCKED",
      });
    });
  });

  describe("Module 3 — Project Template Safety", () => {
    it("prevents deleting a template referenced by existing projects", async () => {
      templateRepoMock.findById.mockResolvedValue({
        id: TEMPLATE_ID,
        name: "Capstone Template",
        isActive: true,
        _count: { projects: 2 },
      });

      await expect(deleteProjectTemplateService(adminActor, TEMPLATE_ID)).rejects.toMatchObject({
        statusCode: 409,
        code: "TEMPLATE_IN_USE",
      });
      expect(prismaMock.__tx.projectTemplate.delete).not.toHaveBeenCalled();
    });
  });

  describe("Module 2 — Project Lifecycle & Single Active Project", () => {
    it("auto-assigns Leader creator as Project Leader (BR-PROJ-003)", async () => {
      prismaMock.__tx.user.findMany.mockResolvedValue([
        { id: LEADER_ID, status: UserStatus.ACTIVE, fullName: "Leader User" },
      ]);
      prismaMock.__tx.project.create.mockResolvedValue({ id: PROJECT_ID, name: "Sprint 2 App" });
      projectRepoMock.findById.mockResolvedValue({
        id: PROJECT_ID,
        name: "Sprint 2 App",
        description: null,
        objectives: null,
        scope: null,
        startDate: new Date("2026-11-01"),
        endDate: new Date("2026-12-01"),
        status: ProjectStatus.CREATED,
        repositoryUrl: null,
        technologies: [],
        templateId: null,
        template: null,
        leaderId: LEADER_ID,
        leader: {
          id: LEADER_ID,
          fullName: "Leader User",
          email: "l@a.vn",
          status: UserStatus.ACTIVE,
        },
        instructorId: null,
        instructor: null,
        createdById: LEADER_ID,
        createdBy: {
          id: LEADER_ID,
          fullName: "Leader User",
          email: "l@a.vn",
          status: UserStatus.ACTIVE,
        },
        _count: { members: 1 },
        archivedAt: null,
        createdAt: new Date("2026-11-01"),
        updatedAt: new Date("2026-11-01"),
      });

      const created = await createProjectService(leaderActor, {
        name: "Sprint 2 App",
        startDate: "2026-11-01",
        endDate: "2026-12-01",
        leaderId: OTHER_USER_ID, // non-Admin attempt should be overridden by BR-PROJ-003
      });

      expect(created.leaderId).toBe(LEADER_ID);
      expect(prismaMock.__tx.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ leaderId: LEADER_ID }),
        })
      );
    });

    it("rejects modifying an ARCHIVED project (BR-PROJ-008)", async () => {
      prismaMock.__tx.project.findUnique.mockResolvedValue({
        id: PROJECT_ID,
        name: "Old Project",
        status: ProjectStatus.ARCHIVED,
        leaderId: LEADER_ID,
        instructorId: null,
        members: [{ id: "m1", projectRole: ProjectMemberRole.LEADER }],
      });
      projectRepoMock.findById.mockResolvedValue({
        id: PROJECT_ID,
        name: "Old Project",
        status: ProjectStatus.ARCHIVED,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-02-01"),
        leaderId: LEADER_ID,
        instructorId: null,
        templateId: null,
      });

      await expect(
        updateProjectService(leaderActor, PROJECT_ID, { name: "Updated Title" })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "PROJECT_ARCHIVED",
      });
    });

    it("rejects activating a project when another ACTIVE project exists (BR-PROJ-004)", async () => {
      prismaMock.__tx.project.findUnique.mockResolvedValue({
        id: PROJECT_ID,
        name: "Project B",
        status: ProjectStatus.CREATED,
        leaderId: LEADER_ID,
        instructorId: null,
        members: [{ id: "m1", projectRole: ProjectMemberRole.LEADER }],
      });
      projectRepoMock.findById.mockResolvedValue({
        id: PROJECT_ID,
        name: "Project B",
        status: ProjectStatus.CREATED,
        leaderId: LEADER_ID,
      });
      projectRepoMock.findOtherActiveProject.mockResolvedValue({
        id: "99999999-9999-4999-8999-999999999999",
        name: "Project A",
      });

      await expect(activateProjectService(leaderActor, PROJECT_ID)).rejects.toMatchObject({
        statusCode: 409,
        code: "PROJECT_ALREADY_ACTIVE",
      });
    });

    it("restricts Project Restore to Admin and requires ARCHIVED state (DEC-008)", async () => {
      await expect(
        restoreProjectService(memberActor, PROJECT_ID, { targetStatus: "CREATED" })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "FORBIDDEN",
      });

      projectRepoMock.findById.mockResolvedValue({
        id: PROJECT_ID,
        name: "Not Archived",
        status: ProjectStatus.ACTIVE,
        archivedAt: null,
      });

      await expect(
        restoreProjectService(adminActor, PROJECT_ID, { targetStatus: "CREATED" })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "PROJECT_NOT_ARCHIVED",
      });
    });
  });

  describe("Module 4 — Project Member Guards", () => {
    it("rejects adding PENDING user or duplicate active member", async () => {
      prismaMock.__tx.project.findUnique.mockResolvedValue({
        id: PROJECT_ID,
        name: "Project A",
        status: ProjectStatus.ACTIVE,
        leaderId: LEADER_ID,
        instructorId: null,
        members: [{ id: "m1", projectRole: ProjectMemberRole.LEADER }],
      });

      prismaMock.__tx.user.findMany.mockResolvedValue([
        { id: OTHER_USER_ID, status: UserStatus.PENDING, fullName: "Pending Student" },
      ]);

      await expect(
        addProjectMemberService(leaderActor, PROJECT_ID, {
          userId: OTHER_USER_ID,
          projectRole: ProjectMemberRole.MEMBER,
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "ACCOUNT_NOT_ACTIVE",
      });

      prismaMock.__tx.user.findMany.mockResolvedValue([
        { id: MEMBER_ID, status: UserStatus.ACTIVE, fullName: "Active Student" },
      ]);
      projectMemberRepoMock.findActiveMembership.mockResolvedValue({ id: "existing" });

      await expect(
        addProjectMemberService(leaderActor, PROJECT_ID, {
          userId: MEMBER_ID,
          projectRole: ProjectMemberRole.MEMBER,
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "ALREADY_PROJECT_MEMBER",
      });
    });

    it("blocks removing Project Leader and blocks member with active tasks (DEC-009)", async () => {
      prismaMock.__tx.project.findUnique.mockResolvedValue({
        id: PROJECT_ID,
        name: "Project A",
        status: ProjectStatus.ACTIVE,
        leaderId: LEADER_ID,
        instructorId: null,
        members: [{ id: "m1", projectRole: ProjectMemberRole.LEADER }],
      });

      await expect(
        removeProjectMemberService(leaderActor, PROJECT_ID, LEADER_ID)
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "CONFLICT",
      });

      projectMemberRepoMock.findActiveMembership.mockResolvedValue({
        id: "mem-1",
        projectId: PROJECT_ID,
        userId: MEMBER_ID,
        projectRole: ProjectMemberRole.MEMBER,
      });
      taskGuardMock.assertNoActiveProjectTasks.mockRejectedValueOnce(
        conflictError(
          "TASK_ASSIGNEE_REASSIGN_REQUIRED",
          "Thành viên vẫn còn Task đang phụ trách chưa hoàn thành."
        )
      );

      await expect(
        removeProjectMemberService(leaderActor, PROJECT_ID, MEMBER_ID)
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "TASK_ASSIGNEE_REASSIGN_REQUIRED",
      });
    });
  });

  describe("getAccessibleActiveProjectSummaryService", () => {
    it("returns null when actor lacks PROJECT_READ permission", async () => {
      const noProjectReadActor: AuthContext = {
        ...memberActor,
        permissions: [PERMISSIONS.NOTIFICATION_READ],
      };

      const result = await getAccessibleActiveProjectSummaryService(noProjectReadActor);
      expect(result).toBeNull();
      expect(projectRepoMock.findAccessibleActiveProject).not.toHaveBeenCalled();
    });

    it("scopes active project lookup to adminViewAll=true for ADMIN and scoped for non-ADMIN", async () => {
      projectRepoMock.findAccessibleActiveProject.mockResolvedValueOnce({
        id: PROJECT_ID,
        name: "Active Project",
      });
      const adminResult = await getAccessibleActiveProjectSummaryService(adminActor);
      expect(adminResult).toEqual({ id: PROJECT_ID, name: "Active Project" });
      expect(projectRepoMock.findAccessibleActiveProject).toHaveBeenLastCalledWith({
        adminViewAll: true,
        userId: ADMIN_ID,
      });

      projectRepoMock.findAccessibleActiveProject.mockResolvedValueOnce(null);
      const memberResult = await getAccessibleActiveProjectSummaryService(memberActor);
      expect(memberResult).toBeNull();
      expect(projectRepoMock.findAccessibleActiveProject).toHaveBeenLastCalledWith({
        adminViewAll: false,
        userId: MEMBER_ID,
      });
    });
  });
});
