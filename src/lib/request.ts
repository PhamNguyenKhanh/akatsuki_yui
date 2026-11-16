import "server-only";
import { ZodError } from "zod";
import { badRequestError, isAppError, payloadTooLargeError } from "@/lib/errors";
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

export const MAX_JSON_BODY_BYTES = 64 * 1024;

export async function readBoundedUtf8Body(
  request: Request,
  maxBytes: number = MAX_JSON_BODY_BYTES
): Promise<string> {
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw payloadTooLargeError();
    }
  }

  if (request.body && typeof request.body.getReader === "function") {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (!value || value.byteLength === 0) {
          continue;
        }
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel().catch(() => undefined);
          throw payloadTooLargeError();
        }
        chunks.push(value);
      }
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw badRequestError("Nội dung JSON không hợp lệ.");
    } finally {
      reader.releaseLock();
    }

    const merged = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(merged);
  }

  let rawBuffer: ArrayBuffer;
  try {
    rawBuffer = await request.arrayBuffer();
  } catch {
    throw badRequestError("Nội dung JSON không hợp lệ.");
  }

  if (rawBuffer.byteLength > maxBytes) {
    throw payloadTooLargeError();
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(rawBuffer);
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  const rawText = await readBoundedUtf8Body(request, MAX_JSON_BODY_BYTES);
  try {
    return JSON.parse(rawText);
  } catch {
    throw badRequestError("Nội dung JSON không hợp lệ.");
  }
}

export async function parseOptionalJsonBody<T = Record<string, unknown>>(
  request: Request,
  defaultValue: T = {} as T
): Promise<T | unknown> {
  const rawText = await readBoundedUtf8Body(request, MAX_JSON_BODY_BYTES);
  if (rawText.trim().length === 0) {
    return defaultValue;
  }

  try {
    return JSON.parse(rawText);
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
