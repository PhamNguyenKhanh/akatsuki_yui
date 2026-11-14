import "server-only";
import { UserStatus } from "@prisma/client";
import { badRequestError, conflictError, forbiddenError, notFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, ROLES, type RoleName } from "@/modules/authorization/constants";
import { assertPermission, hasPermission } from "@/modules/authorization/policy.service";
import { mapUserToSafeDTO, safeUserSelect, userRepository } from "@/modules/users/user.repository";
import { uuidSchema } from "@/lib/validations/common";
import {
  assignUserRoleSchema,
  changePasswordSchema,
  updateProfileSchema,
  updateUserStatusSchema,
  userListQuerySchema,
  type AccountStatusAction,
  type ChangePasswordInput,
  type UpdateProfileInput,
  type UserListQueryInput,
} from "@/modules/users/user.schema";
import type { AuthContext, SafeUserDTO } from "@/types/auth";

function parseTargetUserId(targetUserId: string): string {
  const parsed = uuidSchema.safeParse(targetUserId);
  if (!parsed.success) {
    throw badRequestError(
      parsed.error.issues[0]?.message ?? "ID tài khoản không đúng định dạng UUID.",
      [
        {
          field: "userId",
          message: parsed.error.issues[0]?.message ?? "ID tài khoản không hợp lệ.",
        },
      ]
    );
  }
  return parsed.data;
}

export async function listUsersService(actor: AuthContext, rawQuery: Partial<UserListQueryInput>) {
  assertPermission(actor, PERMISSIONS.ACCOUNT_READ);
  const query = userListQuerySchema.parse(rawQuery);
  return userRepository.findManyPaginated(query);
}

export async function getUserDetailService(
  actor: AuthContext,
  targetUserId: string
): Promise<SafeUserDTO> {
  const validUserId = parseTargetUserId(targetUserId);
  const isSelf = actor.userId === validUserId;
  if (!isSelf && !hasPermission(actor, PERMISSIONS.ACCOUNT_READ)) {
    throw forbiddenError("Bạn không có quyền xem thông tin tài khoản này.");
  }

  const user = await userRepository.findSafeById(validUserId);
  if (!user) {
    throw notFoundError("Không tìm thấy tài khoản.");
  }

  return user;
}

function resolveNextUserStatus(currentStatus: UserStatus, action: AccountStatusAction): UserStatus {
  switch (action) {
    case "APPROVE":
      if (currentStatus !== UserStatus.PENDING) {
        throw conflictError(
          "INVALID_STATUS_TRANSITION",
          "Chỉ có thể phê duyệt tài khoản đang ở trạng thái PENDING."
        );
      }
      return UserStatus.ACTIVE;
    case "REJECT":
      if (currentStatus !== UserStatus.PENDING) {
        throw conflictError(
          "INVALID_STATUS_TRANSITION",
          "Chỉ có thể từ chối tài khoản đang ở trạng thái PENDING."
        );
      }
      return UserStatus.REJECTED;
    case "SUSPEND":
      if (currentStatus !== UserStatus.ACTIVE) {
        throw conflictError(
          "INVALID_STATUS_TRANSITION",
          "Chỉ có thể tạm khóa tài khoản đang ở trạng thái ACTIVE."
        );
      }
      return UserStatus.SUSPENDED;
    case "ACTIVATE":
      if (currentStatus !== UserStatus.SUSPENDED) {
        throw conflictError(
          "INVALID_STATUS_TRANSITION",
          "Chỉ có thể kích hoạt lại tài khoản đang ở trạng thái SUSPENDED."
        );
      }
      return UserStatus.ACTIVE;
  }
}

export async function updateAccountStatusService(
  actor: AuthContext,
  targetUserId: string,
  rawPayload: { action: AccountStatusAction }
): Promise<SafeUserDTO> {
  const validUserId = parseTargetUserId(targetUserId);
  const { action } = updateUserStatusSchema.parse(rawPayload);

  if (action === "APPROVE" || action === "REJECT") {
    assertPermission(actor, PERMISSIONS.ACCOUNT_APPROVE);
  } else {
    assertPermission(actor, PERMISSIONS.ACCOUNT_MANAGE);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: validUserId },
      select: safeUserSelect,
    });

    if (!target) {
      throw notFoundError("Không tìm thấy tài khoản.");
    }

    const nextStatus = resolveNextUserStatus(target.status, action);
    const targetRoles = target.userRoles.map((ur) => ur.role.name as RoleName);

    if (action === "SUSPEND" && targetRoles.includes(ROLES.ADMIN)) {
      const otherAdmins = await userRepository.countOtherActiveAdmins(target.id, tx);
      if (otherAdmins < 1) {
        throw conflictError(
          "LAST_ADMIN_PROTECTION",
          "Không thể tạm khóa Admin hoạt động cuối cùng của Workspace."
        );
      }
    }

    const isApprovalStep = action === "APPROVE" || action === "REJECT";
    const saved = await tx.user.update({
      where: { id: target.id },
      data: {
        status: nextStatus,
        ...(isApprovalStep
          ? {
              approvedAt: new Date(),
              approvedById: actor.userId,
            }
          : {}),
      },
      select: safeUserSelect,
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: `ACCOUNT_${action}`,
        entityType: "User",
        entityId: target.id,
        oldValue: { status: target.status },
        newValue: { status: nextStatus },
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.userId,
        action: `ACCOUNT_${action}`,
        entityType: "User",
        entityId: target.id,
        description: `Cập nhật trạng thái tài khoản ${target.email} từ ${target.status} sang ${nextStatus}.`,
      },
    });

    return saved;
  });

  logger.info("Account status updated", {
    actorId: actor.userId,
    targetUserId,
    action,
    nextStatus: updated.status,
  });

  return mapUserToSafeDTO(updated);
}

export async function assignUserRoleService(
  actor: AuthContext,
  targetUserId: string,
  rawPayload: { roleName: RoleName }
): Promise<SafeUserDTO> {
  const validUserId = parseTargetUserId(targetUserId);
  assertPermission(actor, PERMISSIONS.ROLE_MANAGE);
  const { roleName } = assignUserRoleSchema.parse(rawPayload);

  const updated = await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: validUserId },
      select: safeUserSelect,
    });

    if (!target) {
      throw notFoundError("Không tìm thấy tài khoản.");
    }

    const nextRole = await tx.role.findUnique({
      where: { name: roleName },
      select: { id: true, name: true },
    });

    if (!nextRole) {
      throw notFoundError("Không tìm thấy Role hợp lệ.");
    }

    const currentRoles = target.userRoles.map((ur) => ur.role.name as RoleName);
    const removingAdmin = currentRoles.includes(ROLES.ADMIN) && roleName !== ROLES.ADMIN;

    if (removingAdmin && target.status === UserStatus.ACTIVE) {
      const otherAdmins = await userRepository.countOtherActiveAdmins(target.id, tx);
      if (otherAdmins < 1) {
        throw conflictError(
          "LAST_ADMIN_PROTECTION",
          "Không thể loại bỏ quyền quản trị của Admin hoạt động cuối cùng."
        );
      }
    }

    await tx.userRole.deleteMany({
      where: { userId: target.id },
    });

    await tx.userRole.create({
      data: {
        userId: target.id,
        roleId: nextRole.id,
      },
    });

    const refreshed = await tx.user.findUniqueOrThrow({
      where: { id: target.id },
      select: safeUserSelect,
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: "USER_ROLE_ASSIGNED",
        entityType: "User",
        entityId: target.id,
        oldValue: { roles: currentRoles },
        newValue: { roles: [roleName] },
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.userId,
        action: "USER_ROLE_ASSIGNED",
        entityType: "User",
        entityId: target.id,
        description: `Gán Role ${roleName} cho tài khoản ${target.email}.`,
      },
    });

    return refreshed;
  });

  logger.info("User role reassigned", {
    actorId: actor.userId,
    targetUserId,
    roleName,
  });

  return mapUserToSafeDTO(updated);
}

export async function getMyProfileService(actor: AuthContext): Promise<SafeUserDTO> {
  const profile = await userRepository.findSafeById(actor.userId);
  if (!profile) {
    throw notFoundError("Không tìm thấy thông tin người dùng.");
  }
  return profile;
}

export async function updateMyProfileService(
  actor: AuthContext,
  rawPayload: unknown
): Promise<SafeUserDTO> {
  const input: UpdateProfileInput = updateProfileSchema.parse(rawPayload);

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.user.update({
      where: { id: actor.userId },
      data: { fullName: input.fullName },
      select: safeUserSelect,
    });

    await tx.activityLog.create({
      data: {
        userId: actor.userId,
        action: "PROFILE_UPDATED",
        entityType: "User",
        entityId: actor.userId,
        description: "Người dùng cập nhật họ tên hồ sơ cá nhân.",
      },
    });

    return saved;
  });

  return mapUserToSafeDTO(updated);
}

export async function changeMyPasswordService(
  actor: AuthContext,
  rawPayload: ChangePasswordInput
): Promise<void> {
  const input = changePasswordSchema.parse(rawPayload);

  const authRow = await userRepository.findPasswordHashById(actor.userId);
  if (!authRow) {
    throw notFoundError("Không tìm thấy tài khoản.");
  }

  const isCurrentValid = await verifyPassword(input.currentPassword, authRow.passwordHash);
  if (!isCurrentValid) {
    throw badRequestError("Mật khẩu hiện tại không chính xác.", [
      { field: "currentPassword", message: "Mật khẩu hiện tại không chính xác." },
    ]);
  }

  const nextHash = await hashPassword(input.newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: actor.userId },
      data: { passwordHash: nextHash },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: "PASSWORD_CHANGED",
        entityType: "User",
        entityId: actor.userId,
      },
    });
  });

  logger.info("User changed password", { userId: actor.userId });
}
