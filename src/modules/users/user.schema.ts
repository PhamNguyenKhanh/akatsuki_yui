import { UserStatus } from "@prisma/client";
import { z } from "zod";
import { ROLES } from "@/modules/authorization/constants";
import {
  fullNameSchema,
  paginationQuerySchema,
  passwordPolicySchema,
} from "@/lib/validations/common";

export const userStatusFilterSchema = z.enum([
  UserStatus.PENDING,
  UserStatus.ACTIVE,
  UserStatus.REJECTED,
  UserStatus.SUSPENDED,
]);

export const roleNameSchema = z.enum([
  ROLES.ADMIN,
  ROLES.INSTRUCTOR,
  ROLES.LEADER,
  ROLES.REVIEWER,
  ROLES.MEMBER,
]);

export const userListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(150).optional(),
  status: userStatusFilterSchema.optional(),
  role: roleNameSchema.optional(),
  sortBy: z.enum(["createdAt", "fullName", "email", "status"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type UserListQueryInput = z.infer<typeof userListQuerySchema>;

export const accountStatusActionSchema = z.enum(["APPROVE", "REJECT", "SUSPEND", "ACTIVATE"]);

export type AccountStatusAction = z.infer<typeof accountStatusActionSchema>;

export const updateUserStatusSchema = z.object({
  action: accountStatusActionSchema,
});

export const assignUserRoleSchema = z.object({
  roleName: roleNameSchema,
});

/**
 * DEC-018: Only fullName may be edited in Profile (strict rejects email/role/status).
 */
export const updateProfileSchema = z
  .object({
    fullName: fullNameSchema,
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * DEC-018 + DEC-013: Change Password requires Current Password and strong New Password.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại.").max(128),
    newPassword: passwordPolicySchema,
    confirmNewPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu mới."),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    path: ["confirmNewPassword"],
    message: "Mật khẩu mới xác nhận không khớp.",
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    path: ["newPassword"],
    message: "Mật khẩu mới không được trùng với mật khẩu hiện tại.",
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
