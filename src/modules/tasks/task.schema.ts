import { TaskPriority, TaskStatus } from "@prisma/client";
import { z } from "zod";
import { paginationQuerySchema, uuidSchema } from "@/lib/validations/common";

export const MAX_REFERENCE_LINKS = 20;
export const MAX_TASK_ASSIGNEES = 50;

export const LEADER_ONLY_TASK_UPDATE_FIELDS = new Set<string>([
  "title",
  "description",
  "priority",
  "startDate",
  "deadline",
  "estimateHours",
  "assignees",
  "assigneeIds",
  "dependencies",
]);

export const MEMBER_ALLOWED_TASK_UPDATE_FIELDS = new Set<string>([
  "status",
  "progressNotes",
  "referenceLinks",
  "expectedUpdatedAt",
]);

export function formatTaskCode(taskId: string): string {
  return `#${taskId.slice(0, 8)}`;
}

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

const httpUrlSchema = z
  .string()
  .trim()
  .min(1, "Liên kết tham chiếu không được để trống.")
  .max(1000, "Liên kết tham chiếu không được vượt quá 1000 ký tự.")
  .refine(
    (value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Liên kết tham chiếu phải bắt đầu bằng http:// hoặc https://." }
  );

export const referenceLinksSchema = z
  .array(httpUrlSchema)
  .max(MAX_REFERENCE_LINKS, `Tối đa ${MAX_REFERENCE_LINKS} liên kết tham chiếu cho mỗi Task.`)
  .transform((items) => {
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const item of items) {
      const normalized = item.trim();
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        deduped.push(normalized);
      }
    }
    return deduped;
  });

const requiredDateSchema = z.coerce
  .date({ message: "Deadline không hợp lệ." })
  .refine((value) => !Number.isNaN(value.getTime()), {
    message: "Deadline không hợp lệ.",
  });

const optionalNullableDateSchema = z.preprocess(
  (raw) => {
    if (raw === undefined) return undefined;
    if (raw === null || raw === "") return null;
    return raw;
  },
  z
    .union([
      z.null(),
      z.coerce
        .date({ message: "Ngày bắt đầu không hợp lệ." })
        .refine((value) => !Number.isNaN(value.getTime()), {
          message: "Ngày bắt đầu không hợp lệ.",
        }),
    ])
    .optional()
);

const optionalEstimateHoursSchema = z.preprocess(
  (raw) => {
    if (raw === undefined) return undefined;
    if (raw === null || raw === "") return null;
    if (typeof raw === "number") return raw;
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      return Number(trimmed);
    }
    return raw;
  },
  z
    .union([
      z.null(),
      z
        .number({ message: "Estimate Hours phải là một số hợp lệ." })
        .finite("Estimate Hours phải là một số hữu hạn.")
        .min(0, "Estimate Hours không được âm.")
        .max(10000, "Estimate Hours không được vượt quá 10000 giờ.")
        .transform((val) => Math.round(val * 100) / 100),
    ])
    .optional()
);

const dedupedUuidArraySchema = z
  .array(uuidSchema)
  .max(MAX_TASK_ASSIGNEES, `Tối đa ${MAX_TASK_ASSIGNEES} thành viên cho mỗi Task.`)
  .transform((ids) => Array.from(new Set(ids)));

const optionalBooleanQuerySchema = z.preprocess((raw) => {
  if (raw === undefined || raw === "") return undefined;
  if (raw === true || raw === "true" || raw === "1") return true;
  if (raw === false || raw === "false" || raw === "0") return false;
  return raw;
}, z.boolean().optional());

export const taskPrioritySchema = z.enum([
  TaskPriority.LOW,
  TaskPriority.MEDIUM,
  TaskPriority.HIGH,
  TaskPriority.CRITICAL,
]);

export const taskStatusSchema = z.enum([
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.REVIEW,
  TaskStatus.DONE,
]);

export const taskListQuerySchema = paginationQuerySchema.extend({
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().max(150).optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  assigneeId: uuidSchema.optional(),
  unassignedOnly: optionalBooleanQuerySchema,
  overdueOnly: optionalBooleanQuerySchema,
  sortBy: z
    .enum(["deadline", "priority", "createdAt", "updatedAt", "status", "title"])
    .default("deadline"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export const createTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Tiêu đề Task phải có ít nhất 3 ký tự.")
      .max(200, "Tiêu đề Task không được vượt quá 200 ký tự."),
    description: nullableTextSchema(5000, "Mô tả Task"),
    priority: taskPrioritySchema.default(TaskPriority.MEDIUM),
    startDate: optionalNullableDateSchema,
    deadline: requiredDateSchema,
    estimateHours: optionalEstimateHoursSchema,
    referenceLinks: referenceLinksSchema.optional().default([]),
    assigneeIds: dedupedUuidArraySchema.optional().default([]),
  })
  .refine(
    (data) => {
      if (!data.startDate) return true;
      return data.deadline.getTime() >= data.startDate.getTime();
    },
    {
      path: ["deadline"],
      message: "Deadline phải lớn hơn hoặc bằng ngày bắt đầu.",
    }
  );

export const updateTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Tiêu đề Task phải có ít nhất 3 ký tự.")
      .max(200, "Tiêu đề Task không được vượt quá 200 ký tự.")
      .optional(),
    description: nullableTextSchema(5000, "Mô tả Task"),
    priority: taskPrioritySchema.optional(),
    startDate: optionalNullableDateSchema,
    deadline: requiredDateSchema.optional(),
    estimateHours: optionalEstimateHoursSchema,
    status: taskStatusSchema.optional(),
    referenceLinks: referenceLinksSchema.optional(),
    progressNotes: nullableTextSchema(10000, "Ghi chú tiến độ"),
    expectedUpdatedAt: z.string().datetime().optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.title !== undefined ||
      data.description !== undefined ||
      data.priority !== undefined ||
      data.startDate !== undefined ||
      data.deadline !== undefined ||
      data.estimateHours !== undefined ||
      data.status !== undefined ||
      data.referenceLinks !== undefined ||
      data.progressNotes !== undefined,
    { message: "Cần ít nhất một thông tin để cập nhật Task." }
  );

export const syncTaskAssigneesSchema = z.object({
  assigneeIds: dedupedUuidArraySchema,
});

export const addTaskAssigneeSchema = z.object({
  userId: uuidSchema,
});

export const submitTaskReviewSchema = z.object({
  note: nullableTextSchema(1000, "Ghi chú gửi Review"),
  progressNotes: nullableTextSchema(10000, "Ghi chú tiến độ"),
  referenceLinks: referenceLinksSchema.optional(),
});

export const reviewReasonSchema = z
  .string({ message: "Vui lòng nhập lý do duyệt hoặc từ chối Task." })
  .trim()
  .min(1, "Lý do duyệt hoặc từ chối Task không được để trống.")
  .max(1000, "Lý do không được vượt quá 1000 ký tự.");

export const reviewDecisionSchema = z.object({
  reason: reviewReasonSchema,
});

export const addTaskDependencySchema = z.object({
  dependsOnTaskId: uuidSchema,
});

export const taskHistoryQuerySchema = paginationQuerySchema.extend({
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type TaskListQueryInput = z.input<typeof taskListQuerySchema>;
export type ParsedTaskListQuery = z.infer<typeof taskListQuerySchema>;
export type CreateTaskInput = z.input<typeof createTaskSchema>;
export type UpdateTaskInput = z.input<typeof updateTaskSchema>;
export type SyncTaskAssigneesInput = z.infer<typeof syncTaskAssigneesSchema>;
export type AddTaskAssigneeInput = z.infer<typeof addTaskAssigneeSchema>;
export type SubmitTaskReviewInput = z.input<typeof submitTaskReviewSchema>;
export type ReviewDecisionInput = z.infer<typeof reviewDecisionSchema>;
export type AddTaskDependencyInput = z.infer<typeof addTaskDependencySchema>;
export type TaskHistoryQueryInput = z.input<typeof taskHistoryQuerySchema>;
