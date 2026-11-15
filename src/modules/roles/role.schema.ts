import { z } from "zod";
import { uuidSchema } from "@/lib/validations/common";

export const permissionMutationSchema = z
  .object({
    permissionId: uuidSchema.optional(),
    permissionCode: z.string().trim().min(1).max(100).optional(),
  })
  .refine((data) => Boolean(data.permissionId || data.permissionCode), {
    message: "Vui lòng cung cấp permissionId hoặc permissionCode.",
  });

export const toggleRolePermissionSchema = z
  .object({
    permissionId: uuidSchema.optional(),
    permissionCode: z.string().trim().min(1).max(100).optional(),
    granted: z.boolean(),
  })
  .refine((data) => Boolean(data.permissionId || data.permissionCode), {
    message: "Vui lòng cung cấp permissionId hoặc permissionCode.",
  });

export type PermissionMutationInput = z.infer<typeof permissionMutationSchema>;
export type ToggleRolePermissionInput = z.infer<typeof toggleRolePermissionSchema>;
