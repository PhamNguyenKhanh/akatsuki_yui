import { SprintStatus } from "@prisma/client";
import { z } from "zod";
import { uuidSchema } from "@/lib/validations/common";
import { taskPrioritySchema, taskStatusSchema } from "@/modules/tasks/task.schema";

const nullableTextSchema = (maxLength: number, fieldLabel: string) =>
  z
    .string()
    .trim()
    .max(maxLength, `${fieldLabel} không được vượt quá ${maxLength} ký tự.`)
    .nullable()
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      return value && value.length > 0 ? value : null;
    });

const optionalBooleanQuerySchema = z.preprocess((raw) => {
  if (raw === undefined || raw === "") return undefined;
  if (raw === true || raw === "true" || raw === "1") return true;
  if (raw === false || raw === "false" || raw === "0") return false;
  return raw;
}, z.boolean().optional());

export function parseSprintCalendarDate(raw: unknown): Date | undefined {
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return undefined;
    return new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()));
  }
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (ymdMatch) {
    const year = Number(ymdMatch[1]);
    const month = Number(ymdMatch[2]);
    const day = Number(ymdMatch[3]);
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (
      candidate.getUTCFullYear() === year &&
      candidate.getUTCMonth() === month - 1 &&
      candidate.getUTCDate() === day
    ) {
      return candidate;
    }
    return undefined;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

const sprintCalendarDateSchema = (fieldLabel: string) =>
  z.preprocess(
    (raw) => {
      if (raw === undefined || raw === null || raw === "") return raw;
      return parseSprintCalendarDate(raw) ?? raw;
    },
    z
      .date({ message: `${fieldLabel} không hợp lệ.` })
      .refine((value) => !Number.isNaN(value.getTime()), {
        message: `${fieldLabel} không hợp lệ.`,
      })
  );

const parseDeadlineFilterBound = (raw: unknown, bound: "start" | "end") => {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return bound === "start" ? `${trimmed}T00:00:00.000+07:00` : `${trimmed}T23:59:59.999+07:00`;
    }
    return trimmed;
  }
  return raw;
};

const optionalFilterDateSchema = (bound: "start" | "end") =>
  z.preprocess(
    (raw) => parseDeadlineFilterBound(raw, bound),
    z.coerce
      .date({ message: "Ngày lọc deadline không hợp lệ." })
      .refine((value) => !Number.isNaN(value.getTime()), {
        message: "Ngày lọc deadline không hợp lệ.",
      })
      .optional()
  );

export function formatSprintDateYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export const sprintStatusSchema = z.enum([
  SprintStatus.PLANNED,
  SprintStatus.ACTIVE,
  SprintStatus.COMPLETED,
  SprintStatus.CANCELLED,
]);

export const sprintListQuerySchema = z.object({
  status: sprintStatusSchema.optional(),
  search: z.string().trim().max(150).optional(),
});

export const createSprintSchema = z
  .object({
    name: z
      .string({ message: "Vui lòng nhập tên Sprint." })
      .trim()
      .min(3, "Tên Sprint phải có ít nhất 3 ký tự.")
      .max(150, "Tên Sprint không được vượt quá 150 ký tự."),
    goal: nullableTextSchema(5000, "Mục tiêu Sprint"),
    startDate: sprintCalendarDateSchema("Ngày bắt đầu Sprint"),
    endDate: sprintCalendarDateSchema("Ngày kết thúc Sprint"),
  })
  .refine((data) => data.endDate.getTime() >= data.startDate.getTime(), {
    path: ["endDate"],
    message: "Ngày kết thúc Sprint phải lớn hơn hoặc bằng ngày bắt đầu.",
  });

export const updateSprintSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Tên Sprint phải có ít nhất 3 ký tự.")
      .max(150, "Tên Sprint không được vượt quá 150 ký tự.")
      .optional(),
    goal: nullableTextSchema(5000, "Mục tiêu Sprint"),
    startDate: sprintCalendarDateSchema("Ngày bắt đầu Sprint").optional(),
    endDate: sprintCalendarDateSchema("Ngày kết thúc Sprint").optional(),
    expectedUpdatedAt: z.string().datetime().optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.name !== undefined ||
      data.goal !== undefined ||
      data.startDate !== undefined ||
      data.endDate !== undefined,
    { message: "Cần ít nhất một thông tin để cập nhật Sprint." }
  )
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) return true;
      return data.endDate.getTime() >= data.startDate.getTime();
    },
    {
      path: ["endDate"],
      message: "Ngày kết thúc Sprint phải lớn hơn hoặc bằng ngày bắt đầu.",
    }
  );

export const cancelSprintSchema = z
  .object({
    reason: nullableTextSchema(1000, "Lý do hủy Sprint"),
  })
  .optional()
  .transform((val): { reason?: string | null } => val ?? {});

export const sprintPlanningAssignSchema = z.object({
  taskIds: z
    .array(uuidSchema, { message: "Danh sách Task không hợp lệ." })
    .min(1, "Vui lòng chọn ít nhất một Task để đưa vào Sprint.")
    .max(100, "Chỉ có thể đưa tối đa 100 Task mỗi lần.")
    .transform((ids) => Array.from(new Set(ids))),
});

export const moveSprintTaskSchema = z.object({
  targetSprintId: uuidSchema.nullable(),
});

export const sprintDispositionActionSchema = z.enum(["MOVE_TO_BACKLOG", "MOVE_TO_SPRINT"]);

export const sprintTaskDispositionItemSchema = z
  .object({
    taskId: uuidSchema,
    action: sprintDispositionActionSchema,
    targetSprintId: uuidSchema.nullable().optional(),
    expectedStatus: taskStatusSchema.optional(),
  })
  .superRefine((item, ctx) => {
    if (item.action === "MOVE_TO_SPRINT" && !item.targetSprintId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetSprintId"],
        message: "Vui lòng chọn Sprint đích khi chọn chuyển Task sang Sprint khác.",
      });
    }
    if (item.action === "MOVE_TO_BACKLOG" && item.targetSprintId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetSprintId"],
        message: "Không truyền Sprint đích khi chọn chuyển Task về Backlog.",
      });
    }
  });

export const completeSprintSchema = z.object({
  expectedUpdatedAt: z.string().datetime().optional(),
  note: nullableTextSchema(2000, "Ghi chú tổng kết Sprint"),
  taskDispositions: z.array(sprintTaskDispositionItemSchema).default([]),
});

export const kanbanScopeSchema = z.enum(["PROJECT", "SPRINT", "BACKLOG"]);

export const kanbanQuerySchema = z
  .object({
    scope: kanbanScopeSchema.optional(),
    sprintId: uuidSchema.optional(),
    backlogOnly: optionalBooleanQuerySchema,
    search: z.string().trim().max(150).optional(),
    priority: taskPrioritySchema.optional(),
    assigneeId: uuidSchema.optional(),
    unassignedOnly: optionalBooleanQuerySchema,
    overdueOnly: optionalBooleanQuerySchema,
    deadlineFrom: optionalFilterDateSchema("start"),
    deadlineTo: optionalFilterDateSchema("end"),
  })
  .superRefine((data, ctx) => {
    if (data.sprintId && data.backlogOnly === true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sprintId"],
        message: "Không thể lọc đồng thời Sprint và Product Backlog.",
      });
    }
    if (data.scope === "SPRINT" && !data.sprintId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sprintId"],
        message: "Vui lòng chọn Sprint khi xem Kanban theo Sprint.",
      });
    }
    if (data.scope === "BACKLOG" && data.sprintId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scope"],
        message: "Không thể kết hợp chế độ Backlog với Sprint cụ thể.",
      });
    }
    if (data.deadlineFrom && data.deadlineTo) {
      if (data.deadlineTo.getTime() < data.deadlineFrom.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["deadlineTo"],
          message: "Ngày kết thúc deadline phải lớn hơn hoặc bằng ngày bắt đầu.",
        });
      }
    }
  });

export type SprintListQueryInput = z.input<typeof sprintListQuerySchema>;
export type ParsedSprintListQuery = z.infer<typeof sprintListQuerySchema>;
export type CreateSprintInput = z.input<typeof createSprintSchema>;
export type UpdateSprintInput = z.input<typeof updateSprintSchema>;
export type CancelSprintInput = z.input<typeof cancelSprintSchema>;
export type SprintPlanningAssignInput = z.input<typeof sprintPlanningAssignSchema>;
export type MoveSprintTaskInput = z.input<typeof moveSprintTaskSchema>;
export type SprintTaskDispositionInput = z.input<typeof sprintTaskDispositionItemSchema>;
export type CompleteSprintInput = z.input<typeof completeSprintSchema>;
export type KanbanQueryInput = z.input<typeof kanbanQuerySchema>;
export type ParsedKanbanQuery = z.infer<typeof kanbanQuerySchema>;
