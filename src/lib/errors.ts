import type { ApiErrorDetail, ErrorCode } from "@/types/api";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: ApiErrorDetail[];

  constructor(options: {
    statusCode: number;
    code: ErrorCode;
    message: string;
    details?: ApiErrorDetail[];
  }) {
    super(options.message);
    this.name = "AppError";
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.details = options.details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function badRequestError(message: string, details?: ApiErrorDetail[]) {
  return new AppError({ statusCode: 400, code: "VALIDATION_ERROR", message, details });
}

export function unauthorizedError(
  message = "Bạn cần đăng nhập để tiếp tục.",
  code: ErrorCode = "AUTH_REQUIRED"
) {
  return new AppError({ statusCode: 401, code, message });
}

export function forbiddenError(
  message = "Bạn không có quyền thực hiện thao tác này.",
  code: ErrorCode = "FORBIDDEN"
) {
  return new AppError({ statusCode: 403, code, message });
}

export function notFoundError(message = "Không tìm thấy tài nguyên yêu cầu.") {
  return new AppError({ statusCode: 404, code: "NOT_FOUND", message });
}

export function conflictError(code: ErrorCode, message: string, details?: ApiErrorDetail[]) {
  return new AppError({ statusCode: 409, code, message, details });
}
