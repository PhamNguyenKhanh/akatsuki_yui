import { ProjectMemberRole, ProjectStatus } from "@prisma/client";
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

const PROJECT_STATUS_BADGE_MAP: Record<
  ProjectStatus,
  { label: string; variant: "secondary" | "success" | "outline" }
> = {
  [ProjectStatus.CREATED]: { label: "Mới tạo", variant: "secondary" },
  [ProjectStatus.ACTIVE]: { label: "Đang hoạt động", variant: "success" },
  [ProjectStatus.ARCHIVED]: { label: "Đã lưu trữ", variant: "outline" },
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const config = PROJECT_STATUS_BADGE_MAP[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

const PROJECT_MEMBER_ROLE_BADGE_MAP: Record<
  ProjectMemberRole,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  [ProjectMemberRole.LEADER]: { label: "Leader", variant: "default" },
  [ProjectMemberRole.INSTRUCTOR]: { label: "Instructor", variant: "secondary" },
  [ProjectMemberRole.MEMBER]: { label: "Member", variant: "outline" },
};

export function ProjectMemberRoleBadge({ role }: { role: ProjectMemberRole }) {
  const config = PROJECT_MEMBER_ROLE_BADGE_MAP[role];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
