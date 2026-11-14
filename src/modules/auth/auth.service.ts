import "server-only";
import { UserStatus } from "@prisma/client";
import { conflictError, forbiddenError, unauthorizedError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from "@/modules/auth/auth.schema";
import { ROLES, type RoleName } from "@/modules/authorization/constants";
import { mapUserToSafeDTO, safeUserSelect, userRepository } from "@/modules/users/user.repository";
import type { SafeUserDTO } from "@/types/auth";

export interface AuthenticatedCredentialsUser {
  id: string;
  email: string;
  fullName: string;
  status: UserStatus;
  roles: RoleName[];
}

export async function registerAccount(rawInput: RegisterInput): Promise<SafeUserDTO> {
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

  const createdUser = await prisma.$transaction(async (tx) => {
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

    return user;
  });

  logger.info("User registered with PENDING status", {
    userId: createdUser.id,
    email: createdUser.email,
  });

  return mapUserToSafeDTO(createdUser);
}

export async function authenticateCredentials(
  rawInput: LoginInput
): Promise<AuthenticatedCredentialsUser> {
  const input = loginSchema.parse(rawInput);

  const user = await userRepository.findAuthCredentialsByEmail(input.email);
  if (!user) {
    throw unauthorizedError("Email hoặc mật khẩu không chính xác.", "INVALID_CREDENTIALS");
  }

  const isPasswordValid = await verifyPassword(input.password, user.passwordHash);
  if (!isPasswordValid) {
    logger.warn("Login failed: invalid password", { userId: user.id, email: user.email });
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
