import { Badge } from "@/components/ui/badge";
import { ROLES, type RoleName } from "@/modules/authorization/constants";
import type { UserStatus } from "@/types/auth";

const STATUS_BADGE_MAP: Record<
  UserStatus,
  { label: string; variant: "warning" | "success" | "destructive" | "secondary" }
> = {
  PENDING: { label: "Chờ duyệt", variant: "warning" },
  ACTIVE: { label: "Hoạt động", variant: "success" },
  REJECTED: { label: "Đã từ chối", variant: "destructive" },
  SUSPENDED: { label: "Tạm khóa", variant: "secondary" },
};

const ROLE_LABEL_MAP: Record<RoleName, string> = {
  [ROLES.ADMIN]: "Admin",
  [ROLES.INSTRUCTOR]: "Instructor",
  [ROLES.LEADER]: "Leader",
  [ROLES.MEMBER]: "Member",
};

export function AccountStatusBadge({ status }: { status: UserStatus }) {
  const config = STATUS_BADGE_MAP[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function RoleBadge({ role }: { role: string }) {
  const label = ROLE_LABEL_MAP[role as RoleName] ?? role;
  const variant =
    role === ROLES.ADMIN
      ? "default"
      : role === ROLES.LEADER || role === ROLES.INSTRUCTOR
        ? "secondary"
        : "outline";
  return <Badge variant={variant}>{label}</Badge>;
}
