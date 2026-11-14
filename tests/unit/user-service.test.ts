import { UserStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, userRepoMock, hashPasswordMock, verifyPasswordMock } = vi.hoisted(() => {
  const txMock = {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    role: {
      findUnique: vi.fn(),
    },
    userRole: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };

  return {
    prismaMock: {
      role: { findUnique: vi.fn() },
      activityLog: { create: vi.fn() },
      $transaction: vi.fn(async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock)),
      __tx: txMock,
    },
    userRepoMock: {
      findByEmail: vi.fn(),
      findAuthCredentialsByEmail: vi.fn(),
      findPasswordHashById: vi.fn(),
      findSafeById: vi.fn(),
      findManyPaginated: vi.fn(),
      countOtherActiveAdmins: vi.fn(),
    },
    hashPasswordMock: vi.fn(async (s: string) => `hashed:${s}`),
    verifyPasswordMock: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/password", () => ({
  hashPassword: hashPasswordMock,
  verifyPassword: verifyPasswordMock,
}));

vi.mock("@/modules/users/user.repository", () => ({
  safeUserSelect: {},
  mapUserToSafeDTO: (row: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl?: string | null;
    status: UserStatus;
    userRoles: Array<{ role: { name: string } }>;
    approvedAt?: Date | null;
    approvedBy?: { id: string; fullName: string; email: string } | null;
    createdAt: Date;
    updatedAt: Date;
  }) => ({
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    avatarUrl: row.avatarUrl ?? null,
    status: row.status,
    roles: row.userRoles.map((ur) => ur.role.name),
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    approvedBy: row.approvedBy ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }),
  userRepository: userRepoMock,
}));

import { authenticateCredentials, registerAccount } from "@/modules/auth/auth.service";
import { PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import {
  assignUserRoleService,
  changeMyPasswordService,
  updateAccountStatusService,
} from "@/modules/users/user.service";
import type { AuthContext } from "@/types/auth";

const ADMIN_ACTOR: AuthContext = {
  userId: "11111111-1111-4111-8111-111111111111",
  email: "admin@example.com",
  fullName: "Admin",
  status: UserStatus.ACTIVE,
  roles: [ROLES.ADMIN],
  permissions: Object.values(PERMISSIONS),
};

const MEMBER_ACTOR: AuthContext = {
  userId: "22222222-2222-4222-8222-222222222222",
  email: "member@example.com",
  fullName: "Member",
  status: UserStatus.ACTIVE,
  roles: [ROLES.MEMBER],
  permissions: [PERMISSIONS.PROJECT_READ],
};

const TARGET_ID = "33333333-3333-4333-8333-333333333333";

describe("Auth & User Services Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a new user with PENDING status and MEMBER role without passwordHash", async () => {
    const now = new Date();
    userRepoMock.findByEmail.mockResolvedValue(null);
    prismaMock.role.findUnique.mockResolvedValue({ id: "role-member" });
    prismaMock.__tx.user.create.mockResolvedValue({
      id: TARGET_ID,
      email: "newbie@example.com",
      fullName: "New Member",
      avatarUrl: null,
      status: UserStatus.PENDING,
      userRoles: [{ role: { name: ROLES.MEMBER } }],
      approvedAt: null,
      approvedBy: null,
      createdAt: now,
      updatedAt: now,
    });

    const dto = await registerAccount({
      fullName: "New Member",
      email: "Newbie@Example.com",
      password: "Password@123",
      confirmPassword: "Password@123",
    });

    expect(dto.status).toBe(UserStatus.PENDING);
    expect(dto.roles).toEqual([ROLES.MEMBER]);
    expect("passwordHash" in dto).toBe(false);
    expect(prismaMock.__tx.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "USER_REGISTERED" }),
      })
    );
  });

  it("rejects duplicate email registration with 409 EMAIL_ALREADY_EXISTS", async () => {
    userRepoMock.findByEmail.mockResolvedValue({ id: TARGET_ID });
    await expect(
      registerAccount({
        fullName: "Dup User",
        email: "dup@example.com",
        password: "Password@123",
        confirmPassword: "Password@123",
      })
    ).rejects.toMatchObject({ statusCode: 409, code: "EMAIL_ALREADY_EXISTS" });
  });

  it("enforces password check before status checks during login", async () => {
    userRepoMock.findAuthCredentialsByEmail.mockResolvedValue({
      id: TARGET_ID,
      email: "pending@example.com",
      fullName: "Pending User",
      passwordHash: "hash",
      status: UserStatus.PENDING,
      userRoles: [{ role: { name: ROLES.MEMBER } }],
    });

    verifyPasswordMock.mockResolvedValueOnce(false);
    await expect(
      authenticateCredentials({ email: "pending@example.com", password: "wrong" })
    ).rejects.toMatchObject({ statusCode: 401, code: "INVALID_CREDENTIALS" });

    verifyPasswordMock.mockResolvedValueOnce(true);
    await expect(
      authenticateCredentials({ email: "pending@example.com", password: "Password@123" })
    ).rejects.toMatchObject({ statusCode: 403, code: "ACCOUNT_PENDING" });
  });

  it("blocks unauthorized member from approving accounts", async () => {
    await expect(
      updateAccountStatusService(MEMBER_ACTOR, TARGET_ID, { action: "APPROVE" })
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
  });

  it("protects the last active Admin from suspension and role demotion", async () => {
    const now = new Date();
    const adminRow = {
      id: ADMIN_ACTOR.userId,
      email: ADMIN_ACTOR.email,
      fullName: ADMIN_ACTOR.fullName,
      avatarUrl: null,
      status: UserStatus.ACTIVE,
      userRoles: [{ role: { name: ROLES.ADMIN } }],
      approvedAt: now,
      approvedBy: null,
      createdAt: now,
      updatedAt: now,
    };

    prismaMock.__tx.user.findUnique.mockResolvedValue(adminRow);
    userRepoMock.countOtherActiveAdmins.mockResolvedValue(0);

    await expect(
      updateAccountStatusService(ADMIN_ACTOR, ADMIN_ACTOR.userId, { action: "SUSPEND" })
    ).rejects.toMatchObject({ statusCode: 409, code: "LAST_ADMIN_PROTECTION" });

    prismaMock.__tx.role.findUnique.mockResolvedValue({ id: "role-member", name: ROLES.MEMBER });
    await expect(
      assignUserRoleService(ADMIN_ACTOR, ADMIN_ACTOR.userId, { roleName: ROLES.MEMBER })
    ).rejects.toMatchObject({ statusCode: 409, code: "LAST_ADMIN_PROTECTION" });
  });

  it("rejects wrong currentPassword when changing password", async () => {
    userRepoMock.findPasswordHashById.mockResolvedValue({
      id: MEMBER_ACTOR.userId,
      passwordHash: "stored-hash",
      status: UserStatus.ACTIVE,
    });
    verifyPasswordMock.mockResolvedValue(false);

    await expect(
      changeMyPasswordService(MEMBER_ACTOR, {
        currentPassword: "WrongCurrent@1",
        newPassword: "NewStrong@123",
        confirmNewPassword: "NewStrong@123",
      })
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
  });
});
