import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAppError, unauthorizedError } from "@/lib/errors";
import type { PermissionCode } from "@/modules/authorization/constants";
import {
  assertAnyPermission,
  assertPermission,
  hasAnyPermission,
  hasPermission,
  loadTrustedAuthContext,
} from "@/modules/authorization/policy.service";
import type { AuthContext } from "@/types/auth";

export async function requireActiveUser(): Promise<AuthContext> {
  const session = await auth();
  if (!session?.user?.id) {
    throw unauthorizedError("Vui lòng đăng nhập để tiếp tục.", "AUTH_REQUIRED");
  }
  return loadTrustedAuthContext(session.user.id, {
    expectedTokenVersion: typeof session.user.tokenVersion === "number" ? session.user.tokenVersion : -1,
  });
}

export async function requirePermission(permission: PermissionCode): Promise<AuthContext> {
  const context = await requireActiveUser();
  assertPermission(context, permission);
  return context;
}

export async function requireAnyPermission(permissions: PermissionCode[]): Promise<AuthContext> {
  const context = await requireActiveUser();
  assertAnyPermission(context, permissions);
  return context;
}

export async function getOptionalAuthContext(): Promise<AuthContext | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  try {
    return await loadTrustedAuthContext(session.user.id, {
      expectedTokenVersion: typeof session.user.tokenVersion === "number" ? session.user.tokenVersion : -1,
    });
  } catch {
    return null;
  }
}

export async function requireActiveUserOrRedirect(): Promise<AuthContext> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  let context: AuthContext | null = null;
  let failureCode: string | null = null;

  try {
    context = await loadTrustedAuthContext(session.user.id, {
      expectedTokenVersion: typeof session.user.tokenVersion === "number" ? session.user.tokenVersion : -1,
    });
  } catch (error) {
    if (isAppError(error)) {
      failureCode = error.code;
    } else {
      throw error;
    }
  }

  if (!context) {
    if (failureCode === "ACCOUNT_NOT_ACTIVE") {
      redirect("/access-denied?reason=inactive");
    }
    redirect("/login");
  }

  return context;
}

export async function requirePermissionOrRedirect(
  permission: PermissionCode
): Promise<AuthContext> {
  const context = await requireActiveUserOrRedirect();
  if (!hasPermission(context, permission)) {
    redirect("/access-denied?reason=forbidden");
  }
  return context;
}

export async function requireAnyPermissionOrRedirect(
  permissions: PermissionCode[]
): Promise<AuthContext> {
  const context = await requireActiveUserOrRedirect();
  if (!hasAnyPermission(context, permissions)) {
    redirect("/access-denied?reason=forbidden");
  }
  return context;
}
