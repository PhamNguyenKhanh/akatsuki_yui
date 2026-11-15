import "server-only";
import { UserStatus } from "@prisma/client";
import { forbiddenError, unauthorizedError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { PermissionCode, RoleName } from "@/modules/authorization/constants";
import type { AuthContext } from "@/types/auth";

/**
 * Steps 2-3 & 5 of Server-Side Enforcement (Authorization-Design.md §8):
 * Never trust Role/Permission/Status cached in client or stale JWT alone.
 * Always verify active User status and load Roles + Permissions from PostgreSQL.
 */
export async function loadTrustedAuthContext(
  userId: string,
  options?: { expectedTokenVersion?: number }
): Promise<AuthContext> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      status: true,
      tokenVersion: true,
      userRoles: {
        select: {
          role: {
            select: {
              name: true,
              rolePermissions: {
                select: {
                  permission: {
                    select: {
                      code: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw unauthorizedError("Phiên đăng nhập không hợp lệ hoặc tài khoản không tồn tại.");
  }

  if (options?.expectedTokenVersion !== undefined) {
    const dbVersion = typeof user.tokenVersion === "number" ? user.tokenVersion : 0;
    if (dbVersion !== options.expectedTokenVersion) {
      throw unauthorizedError("Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.");
    }
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw forbiddenError("Tài khoản hiện không ở trạng thái hoạt động.", "ACCOUNT_NOT_ACTIVE");
  }

  const roles = user.userRoles.map((ur) => ur.role.name as RoleName);
  const permissionSet = new Set<PermissionCode>();
  for (const ur of user.userRoles) {
    for (const rp of ur.role.rolePermissions) {
      permissionSet.add(rp.permission.code as PermissionCode);
    }
  }

  return {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    status: user.status,
    roles,
    permissions: Array.from(permissionSet),
  };
}

export function hasPermission(context: AuthContext, permission: PermissionCode): boolean {
  return context.permissions.includes(permission);
}

export function hasAnyPermission(context: AuthContext, permissions: PermissionCode[]): boolean {
  return permissions.some((permission) => context.permissions.includes(permission));
}

export function assertPermission(context: AuthContext, permission: PermissionCode): void {
  if (!hasPermission(context, permission)) {
    throw forbiddenError("Bạn không có quyền thực hiện thao tác này.");
  }
}

export function assertAnyPermission(context: AuthContext, permissions: PermissionCode[]): void {
  if (!hasAnyPermission(context, permissions)) {
    throw forbiddenError("Bạn không có quyền thực hiện thao tác này.");
  }
}
