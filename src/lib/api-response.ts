import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { ApiErrorDetail, ApiErrorResponse, ApiSuccessResponse } from "@/types/api";

export function apiSuccess<T, M = Record<string, unknown>>(
  data: T,
  options?: { status?: number; meta?: M }
) {
  const payload: ApiSuccessResponse<T, M> = options?.meta ? { data, meta: options.meta } : { data };

  return NextResponse.json(payload, { status: options?.status ?? 200 });
}

export function apiError(error: unknown, context?: { route?: string }) {
  if (isAppError(error)) {
    const body: ApiErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    };
    return NextResponse.json(body, { status: error.statusCode });
  }

  if (error instanceof ZodError) {
    const details: ApiErrorDetail[] = error.issues.map((issue) => ({
      field: issue.path.join(".") || undefined,
      message: issue.message,
    }));
    const body: ApiErrorResponse = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu đầu vào không hợp lệ.",
        details,
      },
    };
    return NextResponse.json(body, { status: 400 });
  }

  logger.error("Unhandled API error", error, context);
  const body: ApiErrorResponse = {
    error: {
      code: "INTERNAL_ERROR",
      message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.",
    },
  };
  return NextResponse.json(body, { status: 500 });
}
