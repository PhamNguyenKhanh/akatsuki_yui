import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  PERMISSION_CATALOG,
  type PermissionCode,
  type RoleName,
} from "@/modules/authorization/constants";

export interface PermissionDTO {
  id: string;
  code: PermissionCode;
  name: string;
  description: string | null;
}

export interface RoleWithPermissionsDTO {
  id: string;
  name: RoleName;
  description: string | null;
  userCount: number;
  permissions: PermissionDTO[];
  permissionCodes: PermissionCode[];
  createdAt: string;
}

export interface PermissionMatrixDTO {
  roles: RoleWithPermissionsDTO[];
  permissions: PermissionDTO[];
  coreAdminPermissions: readonly PermissionCode[];
}

const ROLE_ORDER: Record<string, number> = {
  ADMIN: 0,
  LEADER: 1,
  INSTRUCTOR: 2,
  MEMBER: 3,
};

const PERMISSION_ORDER = new Map<string, number>(
  PERMISSION_CATALOG.map((item, index) => [item.code, index])
);

const roleInclude = {
  _count: {
    select: {
      userRoles: true,
    },
  },
  rolePermissions: {
    select: {
      permission: {
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
        },
      },
    },
  },
} satisfies Prisma.RoleInclude;

type RoleRecord = Prisma.RoleGetPayload<{ include: typeof roleInclude }>;

export function mapRoleToDTO(role: RoleRecord): RoleWithPermissionsDTO {
  const sortedPerms = role.rolePermissions
    .map((rp) => ({
      id: rp.permission.id,
      code: rp.permission.code as PermissionCode,
      name: rp.permission.name,
      description: rp.permission.description,
    }))
    .sort((a, b) => (PERMISSION_ORDER.get(a.code) ?? 999) - (PERMISSION_ORDER.get(b.code) ?? 999));

  return {
    id: role.id,
    name: role.name as RoleName,
    description: role.description,
    userCount: role._count.userRoles,
    permissions: sortedPerms,
    permissionCodes: sortedPerms.map((p) => p.code),
    createdAt: role.createdAt.toISOString(),
  };
}

export const roleRepository = {
  async listRolesAndPermissions(tx: Prisma.TransactionClient = prisma) {
    const [roles, permissions] = await Promise.all([
      tx.role.findMany({
        include: roleInclude,
      }),
      tx.permission.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
        },
      }),
    ]);

    roles.sort((a, b) => (ROLE_ORDER[a.name] ?? 99) - (ROLE_ORDER[b.name] ?? 99));
    permissions.sort(
      (a, b) => (PERMISSION_ORDER.get(a.code) ?? 999) - (PERMISSION_ORDER.get(b.code) ?? 999)
    );

    return {
      roles: roles.map(mapRoleToDTO),
      permissions: permissions.map((p) => ({
        id: p.id,
        code: p.code as PermissionCode,
        name: p.name,
        description: p.description,
      })),
    };
  },

  async findRoleById(roleId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.role.findUnique({
      where: { id: roleId },
      include: roleInclude,
    });
  },

  async findPermission(
    query: { permissionId?: string; permissionCode?: string },
    tx: Prisma.TransactionClient = prisma
  ) {
    if (query.permissionId) {
      return tx.permission.findUnique({
        where: { id: query.permissionId },
        select: { id: true, code: true, name: true, description: true },
      });
    }
    if (query.permissionCode) {
      return tx.permission.findUnique({
        where: { code: query.permissionCode },
        select: { id: true, code: true, name: true, description: true },
      });
    }
    return null;
  },
};
