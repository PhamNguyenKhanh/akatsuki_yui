export const ROLES = {
  ADMIN: "ADMIN",
  INSTRUCTOR: "INSTRUCTOR",
  LEADER: "LEADER",
  MEMBER: "MEMBER",
  REVIEWER: "REVIEWER",
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

export const PERMISSIONS = {
  ACCOUNT_READ: "account.read",
  ACCOUNT_APPROVE: "account.approve",
  ACCOUNT_MANAGE: "account.manage",
  ROLE_MANAGE: "role.manage",
  PROJECT_CREATE: "project.create",
  PROJECT_READ: "project.read",
  PROJECT_UPDATE: "project.update",
  PROJECT_ACTIVATE: "project.activate",
  PROJECT_ARCHIVE: "project.archive",
  PROJECT_RESTORE: "project.restore",
  PROJECT_TEMPLATE_MANAGE: "project.template.manage",
  PROJECT_MEMBER_MANAGE: "project.member.manage",
  TASK_CREATE: "task.create",
  TASK_READ: "task.read",
  TASK_UPDATE: "task.update",
  TASK_ASSIGN: "task.assign",
  TASK_SUBMIT_REVIEW: "task.submit_review",
  TASK_REVIEW: "task.review",
  TASK_HISTORY_READ: "task.history.read",
  SPRINT_MANAGE: "sprint.manage",
  SPRINT_READ: "sprint.read",
  SCHEDULE_READ: "schedule.read",
  SCHEDULE_MANAGE: "schedule.manage",
  MEETING_READ: "meeting.read",
  MEETING_MANAGE: "meeting.manage",
  DOCUMENT_MANAGE: "document.manage",
  DOCUMENT_READ: "document.read",
  NOTIFICATION_READ: "notification.read",
  NOTIFICATION_DELIVERY_READ: "notification.delivery.read",
  NOTIFICATION_DELIVERY_RETRY: "notification.delivery.retry",
  REPORT_READ: "report.read",
  ACTIVITY_READ: "activity.read",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Core permissions that must remain granted to the ADMIN role (BR-AUTHZ-008)
 * so workspace administration and account/project recovery cannot be locked out.
 */
export const CORE_ADMIN_PERMISSION_CODES: readonly PermissionCode[] = [
  PERMISSIONS.ACCOUNT_READ,
  PERMISSIONS.ACCOUNT_APPROVE,
  PERMISSIONS.ACCOUNT_MANAGE,
  PERMISSIONS.ROLE_MANAGE,
  PERMISSIONS.PROJECT_RESTORE,
  PERMISSIONS.NOTIFICATION_DELIVERY_READ,
  PERMISSIONS.NOTIFICATION_DELIVERY_RETRY,
];

export interface PermissionDefinition {
  code: PermissionCode;
  name: string;
  description: string;
}

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  {
    code: PERMISSIONS.ACCOUNT_READ,
    name: "Read Accounts",
    description: "Xem danh sách và chi tiết tài khoản",
  },
  {
    code: PERMISSIONS.ACCOUNT_APPROVE,
    name: "Approve Accounts",
    description: "Phê duyệt hoặc từ chối tài khoản đăng ký",
  },
  {
    code: PERMISSIONS.ACCOUNT_MANAGE,
    name: "Manage Account Status",
    description: "Tạm khóa hoặc kích hoạt lại tài khoản",
  },
  {
    code: PERMISSIONS.ROLE_MANAGE,
    name: "Manage Roles",
    description: "Quản lý Role và Permission",
  },
  { code: PERMISSIONS.PROJECT_CREATE, name: "Create Project", description: "Tạo Project mới" },
  {
    code: PERMISSIONS.PROJECT_READ,
    name: "Read Project",
    description: "Xem Project trong phạm vi được phép",
  },
  {
    code: PERMISSIONS.PROJECT_UPDATE,
    name: "Update Project",
    description: "Cập nhật thông tin Project",
  },
  {
    code: PERMISSIONS.PROJECT_ACTIVATE,
    name: "Activate Project",
    description: "Kích hoạt Project",
  },
  { code: PERMISSIONS.PROJECT_ARCHIVE, name: "Archive Project", description: "Lưu trữ Project" },
  {
    code: PERMISSIONS.PROJECT_RESTORE,
    name: "Restore Project",
    description: "Khôi phục Project Archived (Admin only)",
  },
  {
    code: PERMISSIONS.PROJECT_TEMPLATE_MANAGE,
    name: "Manage Project Templates",
    description: "Tạo, chỉnh sửa và xóa Project Template",
  },
  {
    code: PERMISSIONS.PROJECT_MEMBER_MANAGE,
    name: "Manage Project Members",
    description: "Thêm hoặc gỡ thành viên Project",
  },
  { code: PERMISSIONS.TASK_CREATE, name: "Create Task", description: "Tạo Task mới" },
  {
    code: PERMISSIONS.TASK_READ,
    name: "Read Task",
    description: "Xem Task trong Project được phép",
  },
  {
    code: PERMISSIONS.TASK_UPDATE,
    name: "Update Task",
    description: "Cập nhật Task theo phạm vi quyền",
  },
  {
    code: PERMISSIONS.TASK_ASSIGN,
    name: "Assign Task",
    description: "Phân công Assignee cho Task",
  },
  {
    code: PERMISSIONS.TASK_SUBMIT_REVIEW,
    name: "Submit Task Review",
    description: "Gửi Task sang trạng thái REVIEW",
  },
  {
    code: PERMISSIONS.TASK_REVIEW,
    name: "Review Task",
    description: "Approve hoặc Reject Task Review",
  },
  {
    code: PERMISSIONS.TASK_HISTORY_READ,
    name: "Read Task History",
    description: "Xem lịch sử Task",
  },
  {
    code: PERMISSIONS.SPRINT_MANAGE,
    name: "Manage Sprint",
    description: "Tạo, cập nhật, lập kế hoạch và kết thúc Sprint",
  },
  { code: PERMISSIONS.SPRINT_READ, name: "Read Sprint", description: "Xem thông tin Sprint" },
  {
    code: PERMISSIONS.SCHEDULE_READ,
    name: "Read Project Schedule",
    description: "Xem lịch bận các thành viên trong Project",
  },
  {
    code: PERMISSIONS.SCHEDULE_MANAGE,
    name: "Manage Own Schedule",
    description: "Tạo, sửa và xóa lịch bận cá nhân trong Project",
  },
  {
    code: PERMISSIONS.MEETING_READ,
    name: "Read Project Meetings",
    description: "Xem lịch họp và danh sách link Google Meet của Project",
  },
  {
    code: PERMISSIONS.MEETING_MANAGE,
    name: "Manage Project Meetings",
    description: "Tạo, sửa, hủy cuộc họp và quản lý link Google Meet của Project",
  },
  {
    code: PERMISSIONS.DOCUMENT_MANAGE,
    name: "Manage Documents",
    description: "Thêm, sửa, xóa Document Record",
  },
  { code: PERMISSIONS.DOCUMENT_READ, name: "Read Documents", description: "Xem Document Record" },
  {
    code: PERMISSIONS.NOTIFICATION_READ,
    name: "Read Notifications",
    description: "Xem thông báo cá nhân",
  },
  {
    code: PERMISSIONS.NOTIFICATION_DELIVERY_READ,
    name: "Read Notification Deliveries",
    description: "Xem lịch sử gửi email thông báo toàn hệ thống (Admin only)",
  },
  {
    code: PERMISSIONS.NOTIFICATION_DELIVERY_RETRY,
    name: "Retry Notification Deliveries",
    description: "Thử gửi lại email thông báo thất bại (Admin only)",
  },
  {
    code: PERMISSIONS.REPORT_READ,
    name: "Read Reports",
    description: "Xem Dashboard và Reports theo phạm vi",
  },
  {
    code: PERMISSIONS.ACTIVITY_READ,
    name: "Read Activity Logs",
    description: "Xem Activity Log theo phạm vi",
  },
];

export const ROLE_DEFINITIONS: Record<
  RoleName,
  { description: string; permissions: PermissionCode[] }
> = {
  ADMIN: {
    description: "Quản trị toàn Workspace: tài khoản, phân quyền, vòng đời Project và hệ thống",
    permissions: [
      PERMISSIONS.ACCOUNT_READ,
      PERMISSIONS.ACCOUNT_APPROVE,
      PERMISSIONS.ACCOUNT_MANAGE,
      PERMISSIONS.ROLE_MANAGE,
      PERMISSIONS.PROJECT_CREATE,
      PERMISSIONS.PROJECT_READ,
      PERMISSIONS.PROJECT_UPDATE,
      PERMISSIONS.PROJECT_ACTIVATE,
      PERMISSIONS.PROJECT_ARCHIVE,
      PERMISSIONS.PROJECT_RESTORE,
      PERMISSIONS.PROJECT_TEMPLATE_MANAGE,
      PERMISSIONS.PROJECT_MEMBER_MANAGE,
      PERMISSIONS.TASK_CREATE,
      PERMISSIONS.TASK_READ,
      PERMISSIONS.TASK_UPDATE,
      PERMISSIONS.TASK_ASSIGN,
      PERMISSIONS.TASK_SUBMIT_REVIEW,
      PERMISSIONS.TASK_REVIEW,
      PERMISSIONS.TASK_HISTORY_READ,
      PERMISSIONS.SPRINT_MANAGE,
      PERMISSIONS.SPRINT_READ,
      PERMISSIONS.SCHEDULE_READ,
      PERMISSIONS.SCHEDULE_MANAGE,
      PERMISSIONS.MEETING_READ,
      PERMISSIONS.MEETING_MANAGE,
      PERMISSIONS.DOCUMENT_MANAGE,
      PERMISSIONS.DOCUMENT_READ,
      PERMISSIONS.NOTIFICATION_READ,
      PERMISSIONS.NOTIFICATION_DELIVERY_READ,
      PERMISSIONS.NOTIFICATION_DELIVERY_RETRY,
      PERMISSIONS.REPORT_READ,
      PERMISSIONS.ACTIVITY_READ,
    ],
  },
  INSTRUCTOR: {
    description:
      "Giảng viên hướng dẫn: theo dõi tiến độ Project, Task, Sprint, Documents và Reports (Read-only)",
    permissions: [
      PERMISSIONS.PROJECT_READ,
      PERMISSIONS.TASK_READ,
      PERMISSIONS.TASK_HISTORY_READ,
      PERMISSIONS.SPRINT_READ,
      PERMISSIONS.SCHEDULE_READ,
      PERMISSIONS.MEETING_READ,
      PERMISSIONS.DOCUMENT_READ,
      PERMISSIONS.NOTIFICATION_READ,
      PERMISSIONS.REPORT_READ,
      PERMISSIONS.ACTIVITY_READ,
    ],
  },
  LEADER: {
    description:
      "Trưởng nhóm Project: điều phối Project, thành viên, Task, Sprint, Review và Documents",
    permissions: [
      PERMISSIONS.PROJECT_CREATE,
      PERMISSIONS.PROJECT_READ,
      PERMISSIONS.PROJECT_UPDATE,
      PERMISSIONS.PROJECT_ACTIVATE,
      PERMISSIONS.PROJECT_ARCHIVE,
      PERMISSIONS.PROJECT_MEMBER_MANAGE,
      PERMISSIONS.TASK_CREATE,
      PERMISSIONS.TASK_READ,
      PERMISSIONS.TASK_UPDATE,
      PERMISSIONS.TASK_ASSIGN,
      PERMISSIONS.TASK_SUBMIT_REVIEW,
      PERMISSIONS.TASK_REVIEW,
      PERMISSIONS.TASK_HISTORY_READ,
      PERMISSIONS.SPRINT_MANAGE,
      PERMISSIONS.SPRINT_READ,
      PERMISSIONS.SCHEDULE_READ,
      PERMISSIONS.SCHEDULE_MANAGE,
      PERMISSIONS.MEETING_READ,
      PERMISSIONS.MEETING_MANAGE,
      PERMISSIONS.DOCUMENT_MANAGE,
      PERMISSIONS.DOCUMENT_READ,
      PERMISSIONS.NOTIFICATION_READ,
      PERMISSIONS.REPORT_READ,
      PERMISSIONS.ACTIVITY_READ,
    ],
  },
  MEMBER: {
    description:
      "Thành viên nhóm: xem Project tham gia, cập nhật tiến độ Task được giao và gửi Review",
    permissions: [
      PERMISSIONS.PROJECT_READ,
      PERMISSIONS.TASK_READ,
      PERMISSIONS.TASK_UPDATE,
      PERMISSIONS.TASK_SUBMIT_REVIEW,
      PERMISSIONS.TASK_HISTORY_READ,
      PERMISSIONS.SPRINT_READ,
      PERMISSIONS.SCHEDULE_READ,
      PERMISSIONS.SCHEDULE_MANAGE,
      PERMISSIONS.MEETING_READ,
      PERMISSIONS.DOCUMENT_READ,
      PERMISSIONS.NOTIFICATION_READ,
      PERMISSIONS.REPORT_READ,
      PERMISSIONS.ACTIVITY_READ,
    ],
  },
  REVIEWER: {
    description:
      "Người kiểm duyệt Task: xem Project, Sprint, Task, Tài liệu, bình luận và Approve/Reject Task đang chờ Review",
    permissions: [
      PERMISSIONS.PROJECT_READ,
      PERMISSIONS.TASK_READ,
      PERMISSIONS.TASK_REVIEW,
      PERMISSIONS.TASK_HISTORY_READ,
      PERMISSIONS.SPRINT_READ,
      PERMISSIONS.SCHEDULE_READ,
      PERMISSIONS.MEETING_READ,
      PERMISSIONS.DOCUMENT_READ,
      PERMISSIONS.NOTIFICATION_READ,
      PERMISSIONS.REPORT_READ,
      PERMISSIONS.ACTIVITY_READ,
    ],
  },
};
