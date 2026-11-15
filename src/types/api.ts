export type ApiErrorDetail = {
  field?: string;
  message: string;
  taskId?: string;
  taskTitle?: string;
  taskStatus?: string;
};

export interface ApiSuccessResponse<T, M = Record<string, unknown>> {
  data: T;
  meta?: M;
}

export interface ApiErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: ApiErrorDetail[];
  };
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "AUTH_REQUIRED"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_NOT_ACTIVE"
  | "ACCOUNT_PENDING"
  | "ACCOUNT_REJECTED"
  | "ACCOUNT_SUSPENDED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "EMAIL_ALREADY_EXISTS"
  | "INVALID_STATUS_TRANSITION"
  | "LAST_ADMIN_PROTECTION"
  | "CORE_ADMIN_PERMISSION_LOCKED"
  | "PROJECT_ALREADY_ACTIVE"
  | "PROJECT_ARCHIVED"
  | "PROJECT_NOT_ARCHIVED"
  | "ALREADY_PROJECT_MEMBER"
  | "TASK_ASSIGNEE_REASSIGN_REQUIRED"
  | "ASSIGNEE_NOT_PROJECT_MEMBER"
  | "TASK_DEPENDENCY_NOT_COMPLETED"
  | "TASK_DEPENDENCY_SELF_REFERENCE"
  | "TASK_DEPENDENCY_EXISTS"
  | "TASK_DEPENDENCY_CYCLE"
  | "REVIEW_REASON_REQUIRED"
  | "TEMPLATE_IN_USE"
  | "SPRINT_NOT_FOUND"
  | "SPRINT_INVALID_STATUS"
  | "SPRINT_DATE_INVALID"
  | "SPRINT_TASK_ALREADY_ASSIGNED"
  | "SPRINT_NOT_PLANNING_ELIGIBLE"
  | "SPRINT_UNFINISHED_TASKS_REQUIRE_DISPOSITION"
  | "SPRINT_INVALID_DISPOSITION_TARGET"
  | "TASK_ALREADY_COMPLETED"
  | "INTERNAL_ERROR";
