import { randomUUID } from "node:crypto";
import { ProjectMemberRole, ProjectStatus, UserStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import { loadTrustedAuthContext } from "@/modules/authorization/policy.service";
import {
  addProjectMemberService,
  changeProjectLeaderService,
  listProjectMembersService,
  removeProjectMemberService,
} from "@/modules/project-members/member.service";
import {
  createProjectTemplateService,
  deleteProjectTemplateService,
  updateProjectTemplateService,
} from "@/modules/project-templates/template.service";
import {
  activateProjectService,
  archiveProjectService,
  createProjectService,
  getProjectDetailService,
  listProjectsService,
  restoreProjectService,
  updateProjectService,
} from "@/modules/projects/project.service";
import {
  grantRolePermissionService,
  revokeRolePermissionService,
} from "@/modules/roles/role.service";
import type { AuthContext } from "@/types/auth";

const runTag = randomUUID().slice(0, 8);
const createdUserIds: string[] = [];
const createdProjectIds: string[] = [];
const createdTemplateIds: string[] = [];

async function createSeededTestUser(
  prefix: string,
  roleName: (typeof ROLES)[keyof typeof ROLES],
  status: UserStatus = UserStatus.ACTIVE
) {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
  const passwordHash = await hashPassword("TestPass@123");
  const user = await prisma.user.create({
    data: {
      email: `${prefix}.${runTag}@test.akatsuki.local`,
      fullName: `Sprint2 ${prefix}`,
      passwordHash,
      status,
      userRoles: {
        create: { roleId: role.id },
      },
    },
  });
  createdUserIds.push(user.id);
  return user;
}

describe("Sprint 2 PostgreSQL Integration Tests", () => {
  let adminActor: AuthContext;
  let leader1Actor: AuthContext;
  let leader2Actor: AuthContext;
  let member1UserId: string;
  let member2UserId: string;
  let pendingUserId: string;

  beforeAll(async () => {
    const [adminUser, leader1User, leader2User, member1User, member2User, pendingUser] =
      await Promise.all([
        createSeededTestUser("admin", ROLES.ADMIN),
        createSeededTestUser("leader1", ROLES.LEADER),
        createSeededTestUser("leader2", ROLES.LEADER),
        createSeededTestUser("member1", ROLES.MEMBER),
        createSeededTestUser("member2", ROLES.MEMBER),
        createSeededTestUser("pending", ROLES.MEMBER, UserStatus.PENDING),
      ]);

    member1UserId = member1User.id;
    member2UserId = member2User.id;
    pendingUserId = pendingUser.id;

    [adminActor, leader1Actor, leader2Actor] = await Promise.all([
      loadTrustedAuthContext(adminUser.id),
      loadTrustedAuthContext(leader1User.id),
      loadTrustedAuthContext(leader2User.id),
    ]);
  });

  afterAll(async () => {
    const entityIds = [...createdProjectIds, ...createdTemplateIds, ...createdUserIds];

    if (createdProjectIds.length > 0) {
      await prisma.project.deleteMany({
        where: { id: { in: createdProjectIds } },
      });
    }
    if (createdTemplateIds.length > 0) {
      await prisma.projectTemplate.deleteMany({
        where: { id: { in: createdTemplateIds } },
      });
    }
    if (entityIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [{ entityId: { in: entityIds } }, { actorId: { in: createdUserIds } }],
        },
      });
      await prisma.activityLog.deleteMany({
        where: {
          OR: [{ entityId: { in: entityIds } }, { userId: { in: createdUserIds } }],
        },
      });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
    await prisma.$disconnect();
  });

  it("enforces Permission Matrix grant/revoke immediately in PostgreSQL and protects core ADMIN permissions", async () => {
    const memberRole = await prisma.role.findUniqueOrThrow({ where: { name: ROLES.MEMBER } });
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: ROLES.ADMIN } });

    await expect(
      revokeRolePermissionService(adminActor, adminRole.id, {
        permissionCode: PERMISSIONS.ROLE_MANAGE,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "CORE_ADMIN_PERMISSION_LOCKED",
    });

    const beforeCtx = await loadTrustedAuthContext(member1UserId);
    expect(beforeCtx.permissions).toContain(PERMISSIONS.REPORT_READ);

    await revokeRolePermissionService(adminActor, memberRole.id, {
      permissionCode: PERMISSIONS.REPORT_READ,
    });

    const afterRevokeCtx = await loadTrustedAuthContext(member1UserId);
    expect(afterRevokeCtx.permissions).not.toContain(PERMISSIONS.REPORT_READ);

    await grantRolePermissionService(adminActor, memberRole.id, {
      permissionCode: PERMISSIONS.REPORT_READ,
    });

    const afterGrantCtx = await loadTrustedAuthContext(member1UserId);
    expect(afterGrantCtx.permissions).toContain(PERMISSIONS.REPORT_READ);

    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: "Role",
        entityId: memberRole.id,
        actorId: adminActor.userId,
      },
    });
    expect(logs.length).toBeGreaterThanOrEqual(2);
  });

  it("creates Projects with/without Templates, enforces scoping, Single Active Project DB unique index, and Admin-only Restore", async () => {
    const existingActive = await prisma.project.findFirst({
      where: { status: ProjectStatus.ACTIVE },
      select: { id: true },
    });

    // DEC-064: Only ADMIN can manage templates; LEADER cannot create project templates
    await expect(
      createProjectTemplateService(leader1Actor, {
        name: `Leader Forbidden Template ${runTag}`,
        description: "Forbidden",
        isActive: true,
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });

    const template = await createProjectTemplateService(adminActor, {
      name: `Capstone Template ${runTag}`,
      description: "Web template",
      configuration: { defaultTechnologies: ["Next.js", "PostgreSQL"], sprintDays: 14 },
      isActive: true,
    });
    createdTemplateIds.push(template.id);

    const projectA = await createProjectService(leader1Actor, {
      name: `Project Alpha ${runTag}`,
      startDate: "2026-11-01",
      endDate: "2026-12-31",
      templateId: template.id,
      technologies: ["Next.js", "Prisma"],
    });
    createdProjectIds.push(projectA.id);
    expect(projectA.status).toBe(ProjectStatus.CREATED);
    expect(projectA.leaderId).toBe(leader1Actor.userId);

    // Template referenced by Project A cannot be hard-deleted, only deactivated (by ADMIN)
    await expect(deleteProjectTemplateService(adminActor, template.id)).rejects.toMatchObject({
      statusCode: 409,
      code: "TEMPLATE_IN_USE",
    });

    const deactivatedTemplate = await updateProjectTemplateService(adminActor, template.id, {
      isActive: false,
    });
    expect(deactivatedTemplate.isActive).toBe(false);

    // Uninvited Leader 2 cannot access Project A
    await expect(getProjectDetailService(leader2Actor, projectA.id)).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });

    const projectB = await createProjectService(leader2Actor, {
      name: `Project Beta ${runTag}`,
      startDate: "2026-11-01",
      endDate: "2026-12-31",
    });
    createdProjectIds.push(projectB.id);

    const leader2List = await listProjectsService(leader2Actor, { search: runTag });
    expect(leader2List.items.map((item) => item.id)).toEqual([projectB.id]);

    if (!existingActive) {
      const activatedA = await activateProjectService(leader1Actor, projectA.id);
      expect(activatedA.status).toBe(ProjectStatus.ACTIVE);

      // Service blocks activating second project
      await expect(activateProjectService(leader2Actor, projectB.id)).rejects.toMatchObject({
        statusCode: 409,
        code: "PROJECT_ALREADY_ACTIVE",
      });

      // Raw PostgreSQL partial unique index also rejects a second ACTIVE project
      await expect(
        prisma.project.update({
          where: { id: projectB.id },
          data: { status: ProjectStatus.ACTIVE },
        })
      ).rejects.toThrow();

      // Archive Project A -> blocks update, allows activating Project B
      const archivedA = await archiveProjectService(leader1Actor, projectA.id);
      expect(archivedA.status).toBe(ProjectStatus.ARCHIVED);
      expect(archivedA.archivedAt).not.toBeNull();

      await expect(
        updateProjectService(leader1Actor, projectA.id, { name: "Blocked Edit" })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "PROJECT_ARCHIVED",
      });

      const activatedB = await activateProjectService(leader2Actor, projectB.id);
      expect(activatedB.status).toBe(ProjectStatus.ACTIVE);

      // Non-Admin Leader cannot restore Project A
      await expect(
        restoreProjectService(leader1Actor, projectA.id, { targetStatus: ProjectStatus.CREATED })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "FORBIDDEN",
      });

      // Admin cannot restore Project A directly to ACTIVE while Project B is ACTIVE
      await expect(
        restoreProjectService(adminActor, projectA.id, { targetStatus: ProjectStatus.ACTIVE })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "PROJECT_ALREADY_ACTIVE",
      });

      // Admin restores Project A cleanly to CREATED
      const restoredA = await restoreProjectService(adminActor, projectA.id, {
        targetStatus: ProjectStatus.CREATED,
      });
      expect(restoredA.status).toBe(ProjectStatus.CREATED);
      expect(restoredA.archivedAt).toBeNull();
    }
  });

  it("manages Project Members with soft-leave history, partial unique rejoin, and Leader handoff", async () => {
    const project = await createProjectService(leader1Actor, {
      name: `Members Project ${runTag}`,
      startDate: "2026-11-01",
      endDate: "2026-12-31",
    });
    createdProjectIds.push(project.id);

    // Reject PENDING account
    await expect(
      addProjectMemberService(leader1Actor, project.id, {
        userId: pendingUserId,
        projectRole: ProjectMemberRole.MEMBER,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "ACCOUNT_NOT_ACTIVE",
    });

    // Add member1 -> reject duplicate active add -> soft-leave -> rejoin preserves history
    const added = await addProjectMemberService(leader1Actor, project.id, {
      userId: member1UserId,
      projectRole: ProjectMemberRole.MEMBER,
    });
    expect(added.userId).toBe(member1UserId);

    await expect(
      addProjectMemberService(leader1Actor, project.id, {
        userId: member1UserId,
        projectRole: ProjectMemberRole.MEMBER,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "ALREADY_PROJECT_MEMBER",
    });

    const removed = await removeProjectMemberService(leader1Actor, project.id, member1UserId);
    expect(removed.leftAt).not.toBeNull();

    const rejoined = await addProjectMemberService(leader1Actor, project.id, {
      userId: member1UserId,
      projectRole: ProjectMemberRole.MEMBER,
    });
    expect(rejoined.leftAt).toBeNull();

    const fullHistory = await listProjectMembersService(leader1Actor, project.id, {
      includeHistory: true,
    });
    const member1Rows = fullHistory.filter((row) => row.userId === member1UserId);
    expect(member1Rows).toHaveLength(2);
    expect(member1Rows.some((r) => r.leftAt !== null)).toBe(true);
    expect(member1Rows.some((r) => r.leftAt === null)).toBe(true);

    // Change Leader -> old Leader becomes MEMBER, member2 becomes LEADER
    const updatedRoster = await changeProjectLeaderService(leader1Actor, project.id, {
      leaderId: member2UserId,
    });
    const nextLeaderRow = updatedRoster.find(
      (r) => r.userId === member2UserId && r.leftAt === null
    );
    const oldLeaderRow = updatedRoster.find(
      (r) => r.userId === leader1Actor.userId && r.leftAt === null
    );
    expect(nextLeaderRow?.projectRole).toBe(ProjectMemberRole.LEADER);
    expect(oldLeaderRow?.projectRole).toBe(ProjectMemberRole.MEMBER);
  });
});
