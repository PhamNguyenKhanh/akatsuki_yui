import { NextURL } from "next/dist/server/web/next-url";
import { UserStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { unauthorizedError } from "@/lib/errors";
import type { AuthContext } from "@/types/auth";

vi.mock("server-only", () => ({}));

const { authMock, loadTrustedAuthContextMock, redirectMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  loadTrustedAuthContextMock: vi.fn(),
  redirectMock: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next-auth", () => ({
  default: () => ({
    auth: (handler: unknown) => handler,
  }),
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/modules/authorization/policy.service", () => ({
  assertAnyPermission: vi.fn(),
  assertPermission: vi.fn(),
  hasAnyPermission: vi.fn(),
  hasPermission: vi.fn(),
  loadTrustedAuthContext: loadTrustedAuthContextMock,
}));

import middleware from "@/middleware";
import { getOptionalAuthContext } from "@/modules/authorization/require-auth";

describe("Auth Redirect Loop Prevention & Optional Context Guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not bounce /login or /register to /dashboard from Edge middleware when a stale/revoked JWT cookie is present", async () => {
    const middlewareHandler = middleware as unknown as (req: {
      nextUrl: NextURL;
      auth: { user: { id: string } } | null;
    }) => Response;

    const loginRes = middlewareHandler({
      nextUrl: new NextURL("http://localhost:3000/login"),
      auth: { user: { id: "user-1" } },
    });
    expect(loginRes.headers.get("location")).toBeNull();
    expect(loginRes.status).toBe(200);

    const registerRes = middlewareHandler({
      nextUrl: new NextURL("http://localhost:3000/register"),
      auth: { user: { id: "user-1" } },
    });
    expect(registerRes.headers.get("location")).toBeNull();
    expect(registerRes.status).toBe(200);

    const unauthDashboardRes = middlewareHandler({
      nextUrl: new NextURL("http://localhost:3000/dashboard?tab=overview"),
      auth: null,
    });
    expect(unauthDashboardRes.status).toBe(307);
    expect(unauthDashboardRes.headers.get("location")).toBe(
      "http://localhost:3000/login?callbackUrl=%2Fdashboard%3Ftab%3Doverview"
    );
  });

  it("returns null on AppError (e.g. revoked tokenVersion) but rethrows unexpected DB/schema errors in getOptionalAuthContext", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", tokenVersion: 0 } });
    loadTrustedAuthContextMock.mockRejectedValueOnce(
      unauthorizedError("Phiên đăng nhập đã hết hiệu lực.")
    );
    await expect(getOptionalAuthContext()).resolves.toBeNull();

    const dbColumnError = new Error("The column `User.tokenVersion` does not exist.");
    loadTrustedAuthContextMock.mockRejectedValueOnce(dbColumnError);
    await expect(getOptionalAuthContext()).rejects.toThrow("User.tokenVersion");

    const validContext: AuthContext = {
      userId: "user-1",
      email: "user@akatsuki.local",
      fullName: "Valid User",
      status: UserStatus.ACTIVE,
      roles: ["MEMBER"],
      permissions: [],
    };
    loadTrustedAuthContextMock.mockResolvedValueOnce(validContext);
    await expect(getOptionalAuthContext()).resolves.toEqual(validContext);
  });
});
