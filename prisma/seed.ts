import "dotenv/config";
import { PrismaClient, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  PERMISSION_CATALOG,
  ROLE_DEFINITIONS,
  ROLES,
  type RoleName,
} from "../src/modules/authorization/constants";

const prisma = new PrismaClient();

const PASSWORD_POLICY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/;

async function main() {
  console.info("Seeding roles and permissions...");

  const roleMap = new Map<string, string>();
  for (const [roleName, definition] of Object.entries(ROLE_DEFINITIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: { description: definition.description },
      create: {
        name: roleName,
        description: definition.description,
      },
    });
    roleMap.set(roleName, role.id);
  }

  const permissionMap = new Map<string, string>();
  for (const permDef of PERMISSION_CATALOG) {
    const permission = await prisma.permission.upsert({
      where: { code: permDef.code },
      update: {
        name: permDef.name,
        description: permDef.description,
      },
      create: {
        code: permDef.code,
        name: permDef.name,
        description: permDef.description,
      },
    });
    permissionMap.set(permDef.code, permission.id);
  }

  for (const [roleName, definition] of Object.entries(ROLE_DEFINITIONS)) {
    const roleId = roleMap.get(roleName);
    if (!roleId) continue;

    for (const permCode of definition.permissions) {
      const permissionId = permissionMap.get(permCode);
      if (!permissionId) continue;

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId,
          },
        },
        update: {},
        create: {
          roleId,
          permissionId,
        },
      });
    }
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const adminName = process.env.SEED_ADMIN_NAME?.trim() || "Workspace Admin";

  if (adminEmail && adminPassword) {
    if (!PASSWORD_POLICY_REGEX.test(adminPassword)) {
      throw new Error(
        "SEED_ADMIN_PASSWORD does not satisfy DEC-013 Password Policy (min 8 chars, upper, lower, number, special char)."
      );
    }

    const adminRoleId = roleMap.get(ROLES.ADMIN as RoleName);
    if (!adminRoleId) {
      throw new Error("ADMIN role missing after seed.");
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const adminUser = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        fullName: adminName,
        status: UserStatus.ACTIVE,
      },
      create: {
        email: adminEmail,
        passwordHash,
        fullName: adminName,
        status: UserStatus.ACTIVE,
        approvedAt: new Date(),
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: adminUser.id,
          roleId: adminRoleId,
        },
      },
      update: {},
      create: {
        userId: adminUser.id,
        roleId: adminRoleId,
      },
    });

    console.info(`Seeded active Admin user: ${adminEmail}`);
  } else {
    console.warn(
      "SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD is not set; skipped initial Admin user creation."
    );
  }

  console.info("Seed completed successfully.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
