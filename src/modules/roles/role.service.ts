import "server-only";
import { badRequestError, conflictError, notFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { uuidSchema } from "@/lib/validations/common";
import {
  CORE_ADMIN_PERMISSION_CODES,
  PERMISSIONS,
  ROLES,
  type PermissionCode,
} from "@/modules/authorization/constants";
import { assertPermission } from "@/modules/authorization/policy.service";
import {
  mapRoleToDTO,
  roleRepository,
  type PermissionMatrixDTO,
  type RoleWithPermissionsDTO,
} from "@/modules/roles/role.repository";
import {
  permissionMutationSchema,
  toggleRolePermissionSchema,
  type PermissionMutationInput,
  type ToggleRolePermissionInput,
} from "@/modules/roles/role.schema";
import type { AuthContext } from "@/types/auth";

function parseRoleId(roleId: string): string {
  const parsed = uuidSchema.safeParse(roleId);
  if (!parsed.success) {
    throw badRequestError("Role ID không đúng định dạng UUID.", [
      { field: "roleId", message: "Role ID không hợp lệ." },
    ]);
  }
  return parsed.data;
}

export async function getPermissionMatrixService(actor: AuthContext): Promise<PermissionMatrixDTO> {
  assertPermission(actor, PERMISSIONS.ROLE_MANAGE);
  const data = await roleRepository.listRolesAndPermissions();
  return {
    roles: data.roles,
    permissions: data.permissions,
    coreAdminPermissions: CORE_ADMIN_PERMISSION_CODES,
  };
}

export async function grantRolePermissionService(
  actor: AuthContext,
  roleId: string,
  rawPayload: PermissionMutationInput
): Promise<RoleWithPermissionsDTO> {
  assertPermission(actor, PERMISSIONS.ROLE_MANAGE);
  const validRoleId = parseRoleId(roleId);
  const payload = permissionMutationSchema.parse(rawPayload);

  const updated = await prisma.$transaction(async (tx) => {
    const [role, permission] = await Promise.all([
      roleRepository.findRoleById(validRoleId, tx),
      roleRepository.findPermission(payload, tx),
    ]);

    if (!role) {
      throw notFoundError("Không tìm thấy Role yêu cầu.");
    }
    if (!permission) {
      throw notFoundError("Không tìm thấy Permission yêu cầu.");
    }

    const existing = await tx.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id,
        },
      },
      select: { id: true },
    });

    if (existing) {
      return role;
    }

    const previousCodes = role.rolePermissions.map((rp) => rp.permission.code);

    await tx.rolePermission.create({
      data: {
        roleId: role.id,
        permissionId: permission.id,
      },
    });

    const nextCodes = [...previousCodes, permission.code];

    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: "ROLE_PERMISSION_GRANTED",
        entityType: "Role",
        entityId: role.id,
        oldValue: { roleName: role.name, permissions: previousCodes },
        newValue: {
          roleName: role.name,
          permissions: nextCodes,
          grantedPermission: permission.code,
        },
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.userId,
        action: "ROLE_PERMISSION_GRANTED",
        entityType: "Role",
        entityId: role.id,
        description: `Cấp quyền ${permission.code} cho Role ${role.name}.`,
        metadata: { roleName: role.name, permissionCode: permission.code },
      },
    });

    const refreshed = await roleRepository.findRoleById(role.id, tx);
    if (!refreshed) {
      throw notFoundError("Không tìm thấy Role sau khi cập nhật.");
    }
    return refreshed;
  });

  logger.info("Permission granted to role", {
    actorId: actor.userId,
    roleId: validRoleId,
    permission: payload.permissionCode ?? payload.permissionId,
  });

  return mapRoleToDTO(updated);
}

export async function revokeRolePermissionService(
  actor: AuthContext,
  roleId: string,
  rawPayload: PermissionMutationInput
): Promise<RoleWithPermissionsDTO> {
  assertPermission(actor, PERMISSIONS.ROLE_MANAGE);
  const validRoleId = parseRoleId(roleId);
  const payload = permissionMutationSchema.parse(rawPayload);

  const updated = await prisma.$transaction(async (tx) => {
    const [role, permission] = await Promise.all([
      roleRepository.findRoleById(validRoleId, tx),
      roleRepository.findPermission(payload, tx),
    ]);

    if (!role) {
      throw notFoundError("Không tìm thấy Role yêu cầu.");
    }
    if (!permission) {
      throw notFoundError("Không tìm thấy Permission yêu cầu.");
    }

    if (
      role.name === ROLES.ADMIN &&
      CORE_ADMIN_PERMISSION_CODES.includes(permission.code as PermissionCode)
    ) {
      throw conflictError(
        "CORE_ADMIN_PERMISSION_LOCKED",
        `Không thể thu hồi quyền quản trị cốt lõi (${permission.code}) khỏi Role ADMIN.`
      );
    }

    const existing = await tx.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      return role;
    }

    const previousCodes = role.rolePermissions.map((rp) => rp.permission.code);

    await tx.rolePermission.delete({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id,
        },
      },
    });

    const nextCodes = previousCodes.filter((code) => code !== permission.code);

    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: "ROLE_PERMISSION_REVOKED",
        entityType: "Role",
        entityId: role.id,
        oldValue: { roleName: role.name, permissions: previousCodes },
        newValue: {
          roleName: role.name,
          permissions: nextCodes,
          revokedPermission: permission.code,
        },
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.userId,
        action: "ROLE_PERMISSION_REVOKED",
        entityType: "Role",
        entityId: role.id,
        description: `Thu hồi quyền ${permission.code} khỏi Role ${role.name}.`,
        metadata: { roleName: role.name, permissionCode: permission.code },
      },
    });

    const refreshed = await roleRepository.findRoleById(role.id, tx);
    if (!refreshed) {
      throw notFoundError("Không tìm thấy Role sau khi cập nhật.");
    }
    return refreshed;
  });

  logger.info("Permission revoked from role", {
    actorId: actor.userId,
    roleId: validRoleId,
    permission: payload.permissionCode ?? payload.permissionId,
  });

  return mapRoleToDTO(updated);
}

export async function toggleRolePermissionService(
  actor: AuthContext,
  roleId: string,
  rawPayload: ToggleRolePermissionInput
): Promise<RoleWithPermissionsDTO> {
  const parsed = toggleRolePermissionSchema.parse(rawPayload);
  const mutationPayload: PermissionMutationInput = {
    permissionId: parsed.permissionId,
    permissionCode: parsed.permissionCode,
  };

  if (parsed.granted) {
    return grantRolePermissionService(actor, roleId, mutationPayload);
  }
  return revokeRolePermissionService(actor, roleId, mutationPayload);
}
