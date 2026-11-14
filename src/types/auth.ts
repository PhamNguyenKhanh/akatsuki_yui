import type { UserStatus } from "@prisma/client";
import type { PermissionCode, RoleName } from "@/modules/authorization/constants";

export type { UserStatus };

export interface AuthContext {
  userId: string;
  email: string;
  fullName: string;
  status: UserStatus;
  roles: RoleName[];
  permissions: PermissionCode[];
}

export interface SafeUserDTO {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  status: UserStatus;
  roles: RoleName[];
  approvedAt: string | null;
  approvedBy: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}
