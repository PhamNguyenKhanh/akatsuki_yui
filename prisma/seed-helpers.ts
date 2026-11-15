import { UserStatus, type PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  PERMISSION_CATALOG,
  ROLE_DEFINITIONS,
  ROLES,
  type RoleName,
} from "../src/modules/authorization/constants";

export const SEED_PASSWORD_POLICY_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/;

export type SeedDbClient = Pick<
  PrismaClient,
  "role" | "permission" | "rolePermission" | "user" | "userRole"
>;

export interface SeedPermissionCatalogResult {
  permissionMap: Map<string, string>;
  upsertedCount: number;
}

export interface BootstrapNewRolesResult {
  roleMap: Map<string, string>;
  createdRoles: string[];
  grantedDefaultPermissionCount: number;
}

export interface BootstrapAdminResult {
  created: boolean;
  skippedExisting: boolean;
  skippedMissingEnv: boolean;
  userId?: string;
}

/**
 * Step 1 (DEC-067): Upserts Permission catalog definitions (code, name, description)
 * ONLY — never reads, counts, inserts, or deletes RolePermission mappings.
 */
export async function seedPermissionCatalog(
  db: Pick<PrismaClient, "permission">
): Promise<SeedPermissionCatalogResult> {
  const permissionMap = new Map<string, string>();

  for (const permDef of PERMISSION_CATALOG) {
    const permission = await db.permission.upsert({
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

  return {
    permissionMap,
    upsertedCount: PERMISSION_CATALOG.length,
  };
}

/**
 * Step 2 (DEC-067): Ensures standard system roles exist, and populates default
 * RolePermission rows EXCLUSIVELY when creating a brand-new Role (`!existingRole`).
 *
 * Prohibited patterns intentionally avoided:
 * - Never checks `rolePermission.count === 0` (so stripping all permissions stays revoked).
 * - Never re-grants `project.template.manage` or any other default to existing roles.
 */
export async function bootstrapDefaultRolePermissionsForNewRoles(
  db: Pick<PrismaClient, "role" | "rolePermission">,
  permissionMap: Map<string, string>
): Promise<BootstrapNewRolesResult> {
  const roleMap = new Map<string, string>();
  const createdRoles: string[] = [];
  let grantedDefaultPermissionCount = 0;

  for (const [roleName, definition] of Object.entries(ROLE_DEFINITIONS)) {
    const existingRole = await db.role.findUnique({
      where: { name: roleName },
      select: { id: true, description: true },
    });

    if (existingRole) {
      roleMap.set(roleName, existingRole.id);
      if (existingRole.description !== definition.description) {
        await db.role.update({
          where: { id: existingRole.id },
          data: { description: definition.description },
        });
      }
      continue;
    }

    const createdRole = await db.role.create({
      data: {
        name: roleName,
        description: definition.description,
      },
    });
    roleMap.set(roleName, createdRole.id);
    createdRoles.push(roleName);

    for (const permCode of definition.permissions) {
      const permissionId = permissionMap.get(permCode);
      if (!permissionId) continue;

      await db.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: createdRole.id,
            permissionId,
          },
        },
        update: {},
        create: {
          roleId: createdRole.id,
          permissionId,
        },
      });
      grantedDefaultPermissionCount += 1;
    }
  }

  return {
    roleMap,
    createdRoles,
    grantedDefaultPermissionCount,
  };
}

/**
 * Step 3 (DEC-067): One-time Initial Admin bootstrap.
 * If a User with `SEED_ADMIN_EMAIL` already exists, does NOT overwrite
 * `fullName`, `passwordHash`, or `status` (never re-activates a SUSPENDED Admin).
 */
export async function bootstrapInitialAdmin(
  db: Pick<PrismaClient, "user" | "userRole">,
  roleMap: Map<string, string>,
  env: Record<string, string | undefined>
): Promise<BootstrapAdminResult> {
  const adminEmail = env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = env.SEED_ADMIN_PASSWORD;
  const adminName = env.SEED_ADMIN_NAME?.trim() || "Workspace Admin";

  if (!adminEmail || !adminPassword) {
    return {
      created: false,
      skippedExisting: false,
      skippedMissingEnv: true,
    };
  }

  if (!SEED_PASSWORD_POLICY_REGEX.test(adminPassword)) {
    throw new Error(
      "SEED_ADMIN_PASSWORD does not satisfy DEC-013 Password Policy (min 8 chars, upper, lower, number, special char)."
    );
  }

  const adminRoleId = roleMap.get(ROLES.ADMIN as RoleName);
  if (!adminRoleId) {
    throw new Error("ADMIN role missing after seed.");
  }

  const existingUser = await db.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });

  if (existingUser) {
    return {
      created: false,
      skippedExisting: true,
      skippedMissingEnv: false,
      userId: existingUser.id,
    };
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const createdAdmin = await db.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      fullName: adminName,
      status: UserStatus.ACTIVE,
      approvedAt: new Date(),
    },
    select: { id: true },
  });

  await db.userRole.upsert({
    where: {
      userId_roleId: {
        userId: createdAdmin.id,
        roleId: adminRoleId,
      },
    },
    update: {},
    create: {
      userId: createdAdmin.id,
      roleId: adminRoleId,
    },
  });

  return {
    created: true,
    skippedExisting: false,
    skippedMissingEnv: false,
    userId: createdAdmin.id,
  };
}

export async function runSafeSeed(
  db: SeedDbClient,
  env: Record<string, string | undefined> = process.env
) {
  const { permissionMap } = await seedPermissionCatalog(db);
  const { roleMap, createdRoles, grantedDefaultPermissionCount } =
    await bootstrapDefaultRolePermissionsForNewRoles(db, permissionMap);
  const adminResult = await bootstrapInitialAdmin(db, roleMap, env);

  return {
    permissionCount: permissionMap.size,
    createdRoles,
    grantedDefaultPermissionCount,
    adminResult,
  };
}
