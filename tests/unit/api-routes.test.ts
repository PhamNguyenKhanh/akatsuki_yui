import { NextRequest } from "next/server";
import { UserStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { unauthorizedError } from "@/lib/errors";
import { PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import type { AuthContext, SafeUserDTO } from "@/types/auth";

const {
  authMock,
  registerAccountMock,
  performCredentialsLoginMock,
  requireActiveUserMock,
  listUsersServiceMock,
  getUserDetailServiceMock,
  updateAccountStatusServiceMock,
  updateMyProfileServiceMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  registerAccountMock: vi.fn(),
  performCredentialsLoginMock: vi.fn(),
  requireActiveUserMock: vi.fn(),
  listUsersServiceMock: vi.fn(),
  getUserDetailServiceMock: vi.fn(),
  updateAccountStatusServiceMock: vi.fn(),
  updateMyProfileServiceMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
  signOut: vi.fn(),
  signIn: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
}));

vi.mock("@/modules/auth/auth.service", () => ({
  registerAccount: registerAccountMock,
  recordLogoutActivity: vi.fn(),
}));

vi.mock("@/modules/auth/sign-in-helper", () => ({
  performCredentialsLogin: performCredentialsLoginMock,
}));

vi.mock("@/modules/authorization/require-auth", () => ({
  requireActiveUser: requireActiveUserMock,
}));

vi.mock("@/modules/users/user.service", async () => {
  const actual = await vi.importActual<typeof import("@/modules/users/user.service")>(
    "@/modules/users/user.service"
  );
  return {
    ...actual,
    listUsersService: listUsersServiceMock,
    getUserDetailService: getUserDetailServiceMock,
    updateAccountStatusService: updateAccountStatusServiceMock,
    updateMyProfileService: updateMyProfileServiceMock,
  };
});

import { POST as registerPost } from "@/app/api/v1/auth/register/route";
import { GET as sessionGet } from "@/app/api/v1/auth/session/route";
import { PATCH as profilePatch } from "@/app/api/v1/profile/route";
import { GET as usersGet } from "@/app/api/v1/users/route";
import { GET as userDetailGet } from "@/app/api/v1/users/[userId]/route";

const ADMIN_CONTEXT: AuthContext = {
  userId: "11111111-1111-4111-8111-111111111111",
  email: "admin@example.com",
  fullName: "Admin",
  status: UserStatus.ACTIVE,
  roles: [ROLES.ADMIN],
  permissions: Object.values(PERMISSIONS),
};

describe("REST /api/v1 Route Handlers Contract Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /api/v1/auth/register returns 201 data envelope on valid signup", async () => {
    const dto: SafeUserDTO = {
      id: "33333333-3333-4333-8333-333333333333",
      email: "newbie@example.com",
      fullName: "New Member",
      avatarUrl: null,
      status: UserStatus.PENDING,
      roles: [ROLES.MEMBER],
      approvedAt: null,
      approvedBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    registerAccountMock.mockResolvedValue(dto);

    const req = new Request("http://localhost/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "New Member",
        email: "newbie@example.com",
        password: "Password@123",
        confirmPassword: "Password@123",
      }),
    });

    const res = await registerPost(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.email).toBe("newbie@example.com");
    expect(json.data.status).toBe("PENDING");
  });

  it("POST /api/v1/auth/register returns 400 VALIDATION_ERROR on invalid JSON", async () => {
    const req = new Request("http://localhost/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{bad-json",
    });

    const res = await registerPost(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /api/v1/auth/session returns 401 AUTH_REQUIRED when unauthenticated", async () => {
    requireActiveUserMock.mockRejectedValue(
      unauthorizedError("Vui lòng đăng nhập để tiếp tục.", "AUTH_REQUIRED")
    );

    const res = await sessionGet();
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error.code).toBe("AUTH_REQUIRED");
  });

  it("GET /api/v1/users returns paginated data + meta for authorized admin", async () => {
    requireActiveUserMock.mockResolvedValue(ADMIN_CONTEXT);
    listUsersServiceMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 1,
    });

    const req = new NextRequest("http://localhost/api/v1/users?status=&search=yui&page=1");
    const res = await usersGet(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(listUsersServiceMock).toHaveBeenCalledWith(ADMIN_CONTEXT, {
      search: "yui",
      page: "1",
    });
    expect(json).toEqual({
      data: [],
      meta: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
    });
  });

  it("GET /api/v1/users/[userId] forwards userId and returns 200 on match", async () => {
    requireActiveUserMock.mockResolvedValue(ADMIN_CONTEXT);
    getUserDetailServiceMock.mockResolvedValue({
      id: ADMIN_CONTEXT.userId,
      email: ADMIN_CONTEXT.email,
      fullName: ADMIN_CONTEXT.fullName,
      avatarUrl: null,
      status: UserStatus.ACTIVE,
      roles: [ROLES.ADMIN],
      approvedAt: null,
      approvedBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await userDetailGet(
      new Request(`http://localhost/api/v1/users/${ADMIN_CONTEXT.userId}`),
      { params: Promise.resolve({ userId: ADMIN_CONTEXT.userId }) }
    );
    expect(res.status).toBe(200);
  });

  it("PATCH /api/v1/profile propagates strict validation errors", async () => {
    requireActiveUserMock.mockResolvedValue(ADMIN_CONTEXT);
    const actualService = await vi.importActual<typeof import("@/modules/users/user.service")>(
      "@/modules/users/user.service"
    );
    updateMyProfileServiceMock.mockImplementation(actualService.updateMyProfileService);

    const req = new Request("http://localhost/api/v1/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: "Valid Name", email: "disallowed@example.com" }),
    });

    const res = await profilePatch(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });
});
