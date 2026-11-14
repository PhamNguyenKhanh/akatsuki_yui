export type ApiErrorDetail = {
  field?: string;
  message: string;
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
  | "TEMPLATE_IN_USE"
  | "INTERNAL_ERROR";
