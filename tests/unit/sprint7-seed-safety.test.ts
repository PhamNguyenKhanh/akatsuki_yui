import { describe, expect, it, vi } from "vitest";
import { UserStatus } from "@prisma/client";
import {
  PERMISSION_CATALOG,
  PERMISSIONS,
  ROLE_DEFINITIONS,
  ROLES,
} from "@/modules/authorization/constants";
import {
  bootstrapDefaultRolePermissionsForNewRoles,
  bootstrapInitialAdmin,
  runSafeSeed,
  seedPermissionCatalog,
  type SeedDbClient,
} from "../../prisma/seed-helpers";

interface InMemoryRole {
  id: string;
  name: string;
  description: string | null;
}

interface InMemoryPermission {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

interface InMemoryUser {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  status: UserStatus;
  approvedAt: Date | null;
}

function createInMemorySeedDb(initial?: {
  roles?: InMemoryRole[];
  rolePermissions?: Array<{ roleId: string; permissionId: string }>;
  users?: InMemoryUser[];
}): {
  db: SeedDbClient;
  roles: Map<string, InMemoryRole>;
  permissions: Map<string, InMemoryPermission>;
  rolePermissions: Set<string>;
  users: Map<string, InMemoryUser>;
  userRoles: Set<string>;
} {
  const roles = new Map<string, InMemoryRole>(
    (initial?.roles ?? []).map((r) => [r.name, { ...r }])
  );
  const permissions = new Map<string, InMemoryPermission>();
  const rolePermissions = new Set<string>(
    (initial?.rolePermissions ?? []).map((rp) => `${rp.roleId}:${rp.permissionId}`)
  );
  const users = new Map<string, InMemoryUser>(
    (initial?.users ?? []).map((u) => [u.email, { ...u }])
  );
  const userRoles = new Set<string>();
  let seq = 1;

  const db = {
    permission: {
      upsert: vi.fn(
        async (args: {
          where: { code: string };
          update: { name: string; description: string | null };
          create: { code: string; name: string; description: string | null };
        }) => {
          const existing = permissions.get(args.where.code);
          if (existing) {
            existing.name = args.update.name;
            existing.description = args.update.description;
            return existing;
          }
          const created: InMemoryPermission = {
            id: `perm-${seq++}`,
            code: args.create.code,
            name: args.create.name,
            description: args.create.description,
          };
          permissions.set(created.code, created);
          return created;
        }
      ),
    },
    role: {
      findUnique: vi.fn(async (args: { where: { name: string } }) => {
        return roles.get(args.where.name) ?? null;
      }),
      update: vi.fn(
        async (args: { where: { id: string }; data: { description?: string | null } }) => {
          for (const role of roles.values()) {
            if (role.id === args.where.id) {
              role.description = args.data.description ?? null;
              return role;
            }
          }
          throw new Error("Role not found");
        }
      ),
      create: vi.fn(async (args: { data: { name: string; description?: string | null } }) => {
        const created: InMemoryRole = {
          id: `role-${seq++}`,
          name: args.data.name,
          description: args.data.description ?? null,
        };
        roles.set(created.name, created);
        return created;
      }),
    },
    rolePermission: {
      upsert: vi.fn(
        async (args: {
          where: { roleId_permissionId: { roleId: string; permissionId: string } };
          create: { roleId: string; permissionId: string };
        }) => {
          const key = `${args.create.roleId}:${args.create.permissionId}`;
          rolePermissions.add(key);
          return {
            id: `rp-${key}`,
            roleId: args.create.roleId,
            permissionId: args.create.permissionId,
          };
        }
      ),
    },
    user: {
      findUnique: vi.fn(async (args: { where: { email: string } }) => {
        return users.get(args.where.email) ?? null;
      }),
      create: vi.fn(
        async (args: {
          data: {
            email: string;
            passwordHash: string;
            fullName: string;
            status: UserStatus;
            approvedAt: Date | null;
          };
        }) => {
          const created: InMemoryUser = {
            id: `user-${seq++}`,
            email: args.data.email,
            passwordHash: args.data.passwordHash,
            fullName: args.data.fullName,
            status: args.data.status,
            approvedAt: args.data.approvedAt,
          };
          users.set(created.email, created);
          return created;
        }
      ),
    },
    userRole: {
      upsert: vi.fn(async (args: { create: { userId: string; roleId: string } }) => {
        userRoles.add(`${args.create.userId}:${args.create.roleId}`);
        return { id: `ur-${seq++}`, ...args.create };
      }),
    },
  } as unknown as SeedDbClient;

  return { db, roles, permissions, rolePermissions, users, userRoles };
}

describe("Sprint 7 Security — Permission-Preserving & Non-Destructive Seed (DEC-067)", () => {
  it("upserts all 32 permissions and populates defaults ONLY for newly created roles", async () => {
    const store = createInMemorySeedDb();
    const res = await runSafeSeed(store.db, {
      SEED_ADMIN_EMAIL: "admin@akatsuki.local",
      SEED_ADMIN_PASSWORD: "Strong@Password123",
      SEED_ADMIN_NAME: "Initial Admin",
    });

    expect(res.permissionCount).toBe(32);
    expect(PERMISSION_CATALOG).toHaveLength(32);
    expect(res.createdRoles.sort()).toEqual(Object.keys(ROLE_DEFINITIONS).sort());
    expect(res.adminResult.created).toBe(true);
    expect(store.users.get("admin@akatsuki.local")?.status).toBe(UserStatus.ACTIVE);
  });

  it("never re-grants revoked permissions (even if stripped to 0 permissions or project.template.manage removed)", async () => {
    const store = createInMemorySeedDb();
    await runSafeSeed(store.db, {});

    const adminRoleId = store.roles.get(ROLES.ADMIN)!.id;
    const memberRoleId = store.roles.get(ROLES.MEMBER)!.id;
    const templatePermId = store.permissions.get(PERMISSIONS.PROJECT_TEMPLATE_MANAGE)!.id;

    // Simulate Admin revoking project.template.manage from ADMIN and stripping ALL permissions from MEMBER (count === 0!)
    store.rolePermissions.delete(`${adminRoleId}:${templatePermId}`);
    for (const key of Array.from(store.rolePermissions)) {
      if (key.startsWith(`${memberRoleId}:`)) {
        store.rolePermissions.delete(key);
      }
    }

    const { permissionMap } = await seedPermissionCatalog(store.db);
    const secondRun = await bootstrapDefaultRolePermissionsForNewRoles(store.db, permissionMap);

    expect(secondRun.createdRoles).toEqual([]);
    expect(secondRun.grantedDefaultPermissionCount).toBe(0);
    expect(store.rolePermissions.has(`${adminRoleId}:${templatePermId}`)).toBe(false);
    expect(
      Array.from(store.rolePermissions).some((entry) => entry.startsWith(`${memberRoleId}:`))
    ).toBe(false);
  });

  it("never overwrites fullName, passwordHash, or re-activates a SUSPENDED existing Admin account", async () => {
    const store = createInMemorySeedDb({
      users: [
        {
          id: "admin-existing",
          email: "admin@akatsuki.local",
          passwordHash: "$2b$12$existingHashDoNotOverwrite",
          fullName: "Renamed By Owner",
          status: UserStatus.SUSPENDED,
          approvedAt: new Date("2026-10-01T00:00:00Z"),
        },
      ],
    });

    const { permissionMap } = await seedPermissionCatalog(store.db);
    const { roleMap } = await bootstrapDefaultRolePermissionsForNewRoles(store.db, permissionMap);

    const adminResult = await bootstrapInitialAdmin(store.db, roleMap, {
      SEED_ADMIN_EMAIL: "  ADMIN@AKATSUKI.LOCAL  ",
      SEED_ADMIN_PASSWORD: "NewStrong@Password999",
      SEED_ADMIN_NAME: "Reset Attempt",
    });

    expect(adminResult).toEqual({
      created: false,
      skippedExisting: true,
      skippedMissingEnv: false,
      userId: "admin-existing",
    });

    const persisted = store.users.get("admin@akatsuki.local")!;
    expect(persisted.status).toBe(UserStatus.SUSPENDED);
    expect(persisted.fullName).toBe("Renamed By Owner");
    expect(persisted.passwordHash).toBe("$2b$12$existingHashDoNotOverwrite");
  });

  it("rejects SEED_ADMIN_PASSWORD violating DEC-013 password complexity", async () => {
    const store = createInMemorySeedDb();
    const { permissionMap } = await seedPermissionCatalog(store.db);
    const { roleMap } = await bootstrapDefaultRolePermissionsForNewRoles(store.db, permissionMap);

    await expect(
      bootstrapInitialAdmin(store.db, roleMap, {
        SEED_ADMIN_EMAIL: "admin@akatsuki.local",
        SEED_ADMIN_PASSWORD: "weak",
      })
    ).rejects.toThrow(/DEC-013/);
  });
});
