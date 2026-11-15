import { randomUUID } from "node:crypto";
import { UserStatus } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import { revokeRolePermissionService } from "@/modules/roles/role.service";
import type { AuthContext } from "@/types/auth";
import {
  bootstrapDefaultRolePermissionsForNewRoles,
  bootstrapInitialAdmin,
  runSafeSeed,
  seedPermissionCatalog,
} from "../../prisma/seed-helpers";

const runTag = randomUUID().slice(0, 8);
const createdRoleIds: string[] = [];
const createdUserEmails: string[] = [];

function testAdminActor(userId: string): AuthContext {
  return {
    userId,
    email: `seed.admin.${runTag}@test.akatsuki.local`,
    fullName: "Seed Safety Admin",
    status: UserStatus.ACTIVE,
    roles: [ROLES.ADMIN],
    permissions: [PERMISSIONS.ROLE_MANAGE],
  };
}

describe("Sprint 7 PostgreSQL Integration — 6-Step Permission Preservation & Safe Seed (DEC-067)", () => {
  afterAll(async () => {
    if (createdRoleIds.length > 0) {
      await prisma.role.deleteMany({ where: { id: { in: createdRoleIds } } });
    }
    if (createdUserEmails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: createdUserEmails } } });
    }
    await prisma.$disconnect();
  });

  it("executes mandatory 6-step permission preservation without re-granting revoked permissions", async () => {
    // Baseline seed on isolated TEST_DATABASE_URL
    await runSafeSeed(prisma, {});

    const [adminRole, memberRole, templatePerm] = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { name: ROLES.ADMIN } }),
      prisma.role.findUniqueOrThrow({ where: { name: ROLES.MEMBER } }),
      prisma.permission.findUniqueOrThrow({ where: { code: PERMISSIONS.PROJECT_TEMPLATE_MANAGE } }),
    ]);

    const adminUser = await prisma.user.create({
      data: {
        email: `admin.actor.${runTag}@test.akatsuki.local`,
        passwordHash: "$2b$12$dummyHashForTestActor00000000000000000000000000000",
        fullName: "Admin Tester",
        status: UserStatus.ACTIVE,
        approvedAt: new Date(),
      },
    });
    createdUserEmails.push(adminUser.email);

    const existingMemberPerms = await prisma.rolePermission.findMany({
      where: { roleId: memberRole.id },
      select: { permissionId: true },
    });
    const hadAdminTemplatePerm = Boolean(
      await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: { roleId: adminRole.id, permissionId: templatePerm.id },
        },
      })
    );

    try {
      const actor = testAdminActor(adminUser.id);

      // Step 1: Strip MEMBER permissions completely down to 0 rows
      await prisma.rolePermission.deleteMany({ where: { roleId: memberRole.id } });
      expect(await prisma.rolePermission.count({ where: { roleId: memberRole.id } })).toBe(0);

      // Step 2: Re-run seed
      await runSafeSeed(prisma, {});

      // Step 3: Verify 0-permission role remains stripped (NO count === 0 re-grant)
      expect(await prisma.rolePermission.count({ where: { roleId: memberRole.id } })).toBe(0);

      // Step 4: Admin revokes project.template.manage from ADMIN via RBAC service
      if (hadAdminTemplatePerm) {
        await revokeRolePermissionService(actor, adminRole.id, {
          permissionCode: PERMISSIONS.PROJECT_TEMPLATE_MANAGE,
        });
      }

      // Step 5: Re-run seed again
      const { permissionMap } = await seedPermissionCatalog(prisma);
      await bootstrapDefaultRolePermissionsForNewRoles(prisma, permissionMap);

      // Step 6: Verify project.template.manage is NOT re-granted
      const adminTemplateAfterSeed = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: { roleId: adminRole.id, permissionId: templatePerm.id },
        },
      });
      expect(adminTemplateAfterSeed).toBeNull();
    } finally {
      // Restore test DB baseline role permissions cleanly
      for (const rp of existingMemberPerms) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: memberRole.id, permissionId: rp.permissionId },
          },
          update: {},
          create: { roleId: memberRole.id, permissionId: rp.permissionId },
        });
      }
      if (hadAdminTemplatePerm) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: adminRole.id, permissionId: templatePerm.id },
          },
          update: {},
          create: { roleId: adminRole.id, permissionId: templatePerm.id },
        });
      }
      await prisma.auditLog.deleteMany({ where: { actorId: adminUser.id } });
      await prisma.activityLog.deleteMany({ where: { userId: adminUser.id } });
    }
  });

  it("skips overwriting suspended existing admin user in real PostgreSQL", async () => {
    const email = `suspended.admin.${runTag}@test.akatsuki.local`;
    createdUserEmails.push(email);

    const suspendedUser = await prisma.user.create({
      data: {
        email,
        passwordHash: "preserve-this-hash",
        fullName: "Original Name",
        status: UserStatus.SUSPENDED,
      },
    });

    const { permissionMap } = await seedPermissionCatalog(prisma);
    const { roleMap } = await bootstrapDefaultRolePermissionsForNewRoles(prisma, permissionMap);

    const result = await bootstrapInitialAdmin(prisma, roleMap, {
      SEED_ADMIN_EMAIL: email,
      SEED_ADMIN_PASSWORD: "Strong@Password123",
      SEED_ADMIN_NAME: "Overwrite Attempt",
    });

    expect(result.created).toBe(false);
    expect(result.skippedExisting).toBe(true);

    const refreshed = await prisma.user.findUniqueOrThrow({ where: { id: suspendedUser.id } });
    expect(refreshed.status).toBe(UserStatus.SUSPENDED);
    expect(refreshed.fullName).toBe("Original Name");
    expect(refreshed.passwordHash).toBe("preserve-this-hash");
  });
});
