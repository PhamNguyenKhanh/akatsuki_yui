import "server-only";
import { ZodError } from "zod";
import { badRequestError, isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { ApiErrorDetail, ErrorCode } from "@/types/api";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: ErrorCode;
        message: string;
        details?: ApiErrorDetail[];
      };
    };

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw badRequestError("Nội dung JSON không hợp lệ.");
  }
}

export function toActionError<T = never>(
  error: unknown,
  context?: { action?: string }
): ActionResult<T> {
  if (isAppError(error)) {
    return {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    };
  }

  if (error instanceof ZodError) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: error.issues[0]?.message ?? "Dữ liệu đầu vào không hợp lệ.",
        details: error.issues.map((issue) => ({
          field: issue.path.join(".") || undefined,
          message: issue.message,
        })),
      },
    };
  }

  logger.error("Unhandled server action error", error, context);
  return {
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.",
    },
  };
}
