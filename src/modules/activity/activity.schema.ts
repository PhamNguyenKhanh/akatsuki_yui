import { TaskHistoryAction } from "@prisma/client";
import { z } from "zod";
import { AppError, badRequestError } from "@/lib/errors";
import { diffYmdDays, isValidYmd } from "@/lib/timezone";
import { uuidSchema } from "@/lib/validations/common";

export const ACTIVITY_SOURCES = ["ALL", "WORKSPACE", "TASK"] as const;
export type ActivitySourceFilter = (typeof ACTIVITY_SOURCES)[number];
export type ActivityRecordSource = "WORKSPACE" | "TASK";

export const ACTIVITY_ENTITY_TYPES = [
  "Project",
  "ProjectMember",
  "Sprint",
  "Document",
  "Task",
  "User",
  "Role",
  "ProjectTemplate",
] as const;
export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];

export interface DecodedActivityCursor {
  createdAt: Date;
  source: ActivityRecordSource;
  id: string;
}

const activityCursorPayloadSchema = z.object({
  createdAt: z.string().min(1),
  source: z.enum(["WORKSPACE", "TASK"]),
  id: uuidSchema,
});

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value === "string" && value.trim().length === 0) {
    return undefined;
  }
  return value;
};

const optionalUuidFilter = z.preprocess(emptyStringToUndefined, uuidSchema.optional());

const optionalYmdFilter = z.preprocess(
  emptyStringToUndefined,
  z
    .string()
    .trim()
    .refine((value) => isValidYmd(value), {
      message: "Ngày lọc phải có định dạng YYYY-MM-DD hợp lệ.",
    })
    .optional()
);

export const activityQuerySchema = z
  .object({
    projectId: optionalUuidFilter,
    source: z.preprocess(emptyStringToUndefined, z.enum(ACTIVITY_SOURCES).default("ALL")),
    entityType: z.preprocess((value) => {
      if (typeof value === "string" && (value.trim() === "" || value.trim() === "ALL")) {
        return undefined;
      }
      return value;
    }, z.enum(ACTIVITY_ENTITY_TYPES).optional()),
    userId: optionalUuidFilter,
    action: z.preprocess(emptyStringToUndefined, z.string().trim().max(100).optional()),
    from: optionalYmdFilter,
    to: optionalYmdFilter,
    search: z.preprocess(emptyStringToUndefined, z.string().trim().max(200).optional()),
    cursor: z.preprocess(emptyStringToUndefined, z.string().trim().max(1000).optional()),
    limit: z.preprocess(emptyStringToUndefined, z.coerce.number().int().min(1).max(50).default(20)),
  })
  .superRefine((data, ctx) => {
    if (data.from && data.to && diffYmdDays(data.from, data.to) < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "Ngày kết thúc (to) phải lớn hơn hoặc bằng ngày bắt đầu (from).",
      });
    }
  });

export type ActivityQueryInput = z.input<typeof activityQuerySchema>;
export type ParsedActivityQuery = z.infer<typeof activityQuerySchema>;

/**
 * Encodes a keyset pagination cursor for `(createdAt DESC, source DESC, id DESC)`.
 * This is a schema-validated opaque token; authorization and scoping are always
 * enforced independently on the server.
 */
export function encodeActivityCursor(payload: {
  createdAt: Date;
  source: ActivityRecordSource;
  id: string;
}): string {
  return Buffer.from(
    JSON.stringify({
      createdAt: payload.createdAt.toISOString(),
      source: payload.source,
      id: payload.id,
    }),
    "utf8"
  ).toString("base64url");
}

/**
 * Validates and decodes an opaque Base64url activity pagination cursor.
 * Rejects malformed or structurally invalid tokens with 400 VALIDATION_ERROR.
 */
export function decodeActivityCursor(rawCursor: string): DecodedActivityCursor {
  try {
    const jsonText = Buffer.from(rawCursor, "base64url").toString("utf8");
    const parsedJson: unknown = JSON.parse(jsonText);
    const parsed = activityCursorPayloadSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw badRequestError("Cursor phân trang không hợp lệ.", [
        { field: "cursor", message: "Cursor phân trang không đúng định dạng." },
      ]);
    }

    const parsedDate = new Date(parsed.data.createdAt);
    if (Number.isNaN(parsedDate.getTime())) {
      throw badRequestError("Cursor phân trang chứa mốc thời gian không hợp lệ.", [
        { field: "cursor", message: "Cursor phân trang không hợp lệ." },
      ]);
    }

    return {
      createdAt: parsedDate,
      source: parsed.data.source,
      id: parsed.data.id,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw badRequestError("Cursor phân trang không hợp lệ.", [
      { field: "cursor", message: "Không thể giải mã cursor phân trang." },
    ]);
  }
}

export const TASK_HISTORY_ACTION_SET = new Set<string>(Object.values(TaskHistoryAction));
