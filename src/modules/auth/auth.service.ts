import "server-only";
import { UserStatus } from "@prisma/client";
import { z } from "zod";
import { conflictError, forbiddenError, unauthorizedError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import {
  RATE_LIMIT_SCOPES,
  consumeRateLimit,
  getRequestClientIp,
  runWithRateLimitContext,
} from "@/lib/rate-limit";
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from "@/modules/auth/auth.schema";
import { ROLES, type RoleName } from "@/modules/authorization/constants";
import { schedulePostCommitEmailDispatch } from "@/modules/notifications/notification-delivery.service";
import { recordAccountRegisteredNotifications } from "@/modules/notifications/notification-domain-events";
import { mapUserToSafeDTO, safeUserSelect, userRepository } from "@/modules/users/user.repository";
import type { SafeUserDTO } from "@/types/auth";

export interface AuthenticatedCredentialsUser {
  id: string;
  email: string;
  fullName: string;
  status: UserStatus;
  tokenVersion: number;
  roles: RoleName[];
}

export async function registerAccount(
  rawInput: RegisterInput,
  options?: { headers?: Headers | null }
): Promise<SafeUserDTO> {
  return runWithRateLimitContext(async () => {
    const clientIp = await getRequestClientIp(options?.headers);
    await consumeRateLimit({
      scope: RATE_LIMIT_SCOPES.AUTH_REGISTER_IP,
      identifier: clientIp,
    });

    const input = registerSchema.parse(rawInput);

    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw conflictError("EMAIL_ALREADY_EXISTS", "Email đã được sử dụng bởi tài khoản khác.");
    }

    const defaultRole = await prisma.role.findUnique({
      where: { name: ROLES.MEMBER },
      select: { id: true },
    });

    if (!defaultRole) {
      throw new Error("Default MEMBER role is missing. Run database seed first.");
    }

    const passwordHash = await hashPassword(input.password);

    const { user: createdUser, notificationHandles } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          fullName: input.fullName,
          passwordHash,
          status: UserStatus.PENDING,
          userRoles: {
            create: {
              roleId: defaultRole.id,
            },
          },
        },
        select: safeUserSelect,
      });

      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: "USER_REGISTERED",
          entityType: "User",
          entityId: user.id,
          description: `Tài khoản ${user.email} đã đăng ký và đang chờ phê duyệt.`,
        },
      });

      const handles = await recordAccountRegisteredNotifications(tx, {
        newUserId: user.id,
        newUserEmail: user.email,
        newUserFullName: user.fullName,
      });

      return { user, notificationHandles: handles };
    });

    await schedulePostCommitEmailDispatch(notificationHandles);

    logger.info("User registered with PENDING status", {
      userId: createdUser.id,
      email: createdUser.email,
    });

    return mapUserToSafeDTO(createdUser);
  });
}

const DUMMY_BCRYPT_HASH = "$2b$12$Nxjy92/aSkYJxD2z5bqFF.6UlLFohzksA9gqN8R3HwV.mLxkwlPlO";
const logoutUserIdSchema = z.string().uuid();

export async function authenticateCredentials(
  rawInput: LoginInput
): Promise<AuthenticatedCredentialsUser> {
  const input = loginSchema.parse(rawInput);

  const user = await userRepository.findAuthCredentialsByEmail(input.email);
  // Constant-time-aligned password check prevents distinguishing unknown emails from wrong passwords
  const passwordHashToVerify = user?.passwordHash ?? DUMMY_BCRYPT_HASH;
  const isPasswordValid = await verifyPassword(input.password, passwordHashToVerify);

  if (!user || !isPasswordValid) {
    if (user) {
      logger.warn("Login failed: invalid password", { userId: user.id, email: user.email });
    }
    throw unauthorizedError("Email hoặc mật khẩu không chính xác.", "INVALID_CREDENTIALS");
  }

  if (user.status === UserStatus.PENDING) {
    throw forbiddenError("Tài khoản đang chờ Admin phê duyệt.", "ACCOUNT_PENDING");
  }

  if (user.status === UserStatus.REJECTED) {
    throw forbiddenError("Tài khoản đã bị từ chối.", "ACCOUNT_REJECTED");
  }

  if (user.status === UserStatus.SUSPENDED) {
    throw forbiddenError("Tài khoản đã bị tạm khóa.", "ACCOUNT_SUSPENDED");
  }

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "USER_LOGIN",
      entityType: "User",
      entityId: user.id,
      description: `Người dùng ${user.email} đã đăng nhập vào hệ thống.`,
    },
  });

  logger.info("User authenticated successfully", {
    userId: user.id,
    email: user.email,
  });

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    status: user.status,
    tokenVersion: user.tokenVersion,
    roles: user.userRoles.map((ur) => ur.role.name as RoleName),
  };
}

export async function recordLogoutActivity(userId: string, email?: string): Promise<void> {
  await prisma.activityLog.create({
    data: {
      userId,
      action: "USER_LOGOUT",
      entityType: "User",
      entityId: userId,
      description: `Người dùng ${email ?? userId} đã đăng xuất.`,
    },
  });
}

export interface RevokeSessionOnLogoutInput {
  userId: string;
  email?: string | null;
  expectedTokenVersion?: number;
}

export async function revokeUserSessionOnLogout(
  input: RevokeSessionOnLogoutInput
): Promise<{ revoked: boolean }> {
  const parsedUserId = logoutUserIdSchema.safeParse(input.userId);
  if (!parsedUserId.success) {
    return { revoked: false };
  }

  const userId = parsedUserId.data;
  const updated = await prisma.user.updateMany({
    where: {
      id: userId,
      ...(typeof input.expectedTokenVersion === "number" && input.expectedTokenVersion >= 0
        ? { tokenVersion: input.expectedTokenVersion }
        : {}),
    },
    data: {
      tokenVersion: { increment: 1 },
    },
  });

  if (updated.count > 0) {
    await recordLogoutActivity(userId, input.email ?? undefined).catch(() => undefined);
    return { revoked: true };
  }

  return { revoked: false };
}
