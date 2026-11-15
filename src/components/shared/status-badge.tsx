import { ProjectMemberRole, ProjectStatus, TaskPriority, TaskStatus } from "@prisma/client";
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

const TASK_STATUS_BADGE_MAP: Record<TaskStatus, { label: string; className: string }> = {
  [TaskStatus.TODO]: {
    label: "To Do",
    className: "border-slate-300 bg-slate-100 text-slate-700",
  },
  [TaskStatus.IN_PROGRESS]: {
    label: "In Progress",
    className: "border-sky-300 bg-sky-50 text-sky-800",
  },
  [TaskStatus.REVIEW]: {
    label: "Review",
    className: "border-amber-300 bg-amber-50 text-amber-800",
  },
  [TaskStatus.DONE]: {
    label: "Done",
    className: "border-emerald-300 bg-emerald-50 text-emerald-800",
  },
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const config = TASK_STATUS_BADGE_MAP[status];
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

const TASK_PRIORITY_BADGE_MAP: Record<TaskPriority, { label: string; className: string }> = {
  [TaskPriority.LOW]: {
    label: "Low",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
  [TaskPriority.MEDIUM]: {
    label: "Medium",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  [TaskPriority.HIGH]: {
    label: "High",
    className: "border-orange-300 bg-orange-50 text-orange-800",
  },
  [TaskPriority.CRITICAL]: {
    label: "Critical",
    className: "border-red-300 bg-red-50 text-red-800",
  },
};

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  const config = TASK_PRIORITY_BADGE_MAP[priority];
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
