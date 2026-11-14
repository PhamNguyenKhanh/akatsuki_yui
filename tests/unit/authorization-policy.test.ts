import { UserStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: findUniqueMock,
    },
  },
}));

import { AppError } from "@/lib/errors";
import {
  PERMISSION_CATALOG,
  PERMISSIONS,
  ROLE_DEFINITIONS,
  ROLES,
} from "@/modules/authorization/constants";
import {
  assertAnyPermission,
  assertPermission,
  hasAnyPermission,
  hasPermission,
  loadTrustedAuthContext,
} from "@/modules/authorization/policy.service";
import type { AuthContext } from "@/types/auth";

describe("RBAC Catalog & Policy Service", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
  });

  it("defines all 4 roles and 25 unique permission codes", () => {
    const roleNames = Object.keys(ROLE_DEFINITIONS);
    expect(roleNames).toHaveLength(4);
    expect(PERMISSION_CATALOG).toHaveLength(25);

    expect(roleNames).toEqual(
      expect.arrayContaining([ROLES.ADMIN, ROLES.INSTRUCTOR, ROLES.LEADER, ROLES.MEMBER])
    );

    expect(ROLE_DEFINITIONS[ROLES.ADMIN].permissions).toHaveLength(25);
  });

  it("evaluates hasPermission, hasAnyPermission, and assertPermission accurately", () => {
    const memberCtx: AuthContext = {
      userId: "user-1",
      email: "member@example.com",
      fullName: "Member User",
      status: UserStatus.ACTIVE,
      roles: [ROLES.MEMBER],
      permissions: [PERMISSIONS.PROJECT_READ, PERMISSIONS.TASK_READ],
    };

    expect(hasPermission(memberCtx, PERMISSIONS.TASK_READ)).toBe(true);
    expect(hasPermission(memberCtx, PERMISSIONS.ACCOUNT_MANAGE)).toBe(false);
    expect(hasAnyPermission(memberCtx, [PERMISSIONS.ACCOUNT_READ, PERMISSIONS.PROJECT_READ])).toBe(
      true
    );

    expect(() => assertPermission(memberCtx, PERMISSIONS.TASK_READ)).not.toThrow();
    expect(() => assertPermission(memberCtx, PERMISSIONS.ACCOUNT_APPROVE)).toThrow(AppError);
    expect(() =>
      assertAnyPermission(memberCtx, [PERMISSIONS.ACCOUNT_MANAGE, PERMISSIONS.ROLE_MANAGE])
    ).toThrow(AppError);
  });

  it("loads fresh ACTIVE roles and permissions from PostgreSQL", async () => {
    findUniqueMock.mockResolvedValue({
      id: "u-1",
      email: "leader@example.com",
      fullName: "Team Leader",
      status: UserStatus.ACTIVE,
      userRoles: [
        {
          role: {
            name: ROLES.LEADER,
            rolePermissions: [
              { permission: { code: PERMISSIONS.ACCOUNT_READ } },
              { permission: { code: PERMISSIONS.PROJECT_CREATE } },
              { permission: { code: PERMISSIONS.ACCOUNT_READ } },
            ],
          },
        },
      ],
    });

    const ctx = await loadTrustedAuthContext("u-1");
    expect(ctx.roles).toEqual([ROLES.LEADER]);
    expect(ctx.permissions).toEqual([PERMISSIONS.ACCOUNT_READ, PERMISSIONS.PROJECT_CREATE]);
  });

  it("rejects missing or non-ACTIVE users with 401/403", async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    await expect(loadTrustedAuthContext("missing")).rejects.toMatchObject({
      statusCode: 401,
      code: "AUTH_REQUIRED",
    });

    for (const status of [UserStatus.PENDING, UserStatus.REJECTED, UserStatus.SUSPENDED]) {
      findUniqueMock.mockResolvedValueOnce({
        id: "u-2",
        email: "user@example.com",
        fullName: "User",
        status,
        userRoles: [],
      });
      await expect(loadTrustedAuthContext("u-2")).rejects.toMatchObject({
        statusCode: 403,
        code: "ACCOUNT_NOT_ACTIVE",
      });
    }
  });
});
