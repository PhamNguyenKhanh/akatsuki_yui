import { ProjectStatus } from "@prisma/client";
import { z } from "zod";
import { isSafeHttpUrl, paginationQuerySchema, uuidSchema } from "@/lib/validations/common";

const nullableTextSchema = (maxLength: number, fieldLabel: string) =>
  z
    .string()
    .trim()
    .max(maxLength, `${fieldLabel} không được vượt quá ${maxLength} ký tự.`)
    .nullable()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));

const optionalRepositoryUrlSchema = z
  .string()
  .trim()
  .max(1000, "Repository URL không được vượt quá 1000 ký tự.")
  .nullable()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null))
  .refine((value) => (value === null ? true : isSafeHttpUrl(value)), {
    message: "Repository URL phải bắt đầu bằng http:// hoặc https:// và không chứa thông tin đăng nhập.",
  });

const technologiesSchema = z
  .array(z.string().trim().min(1).max(50, "Mỗi công nghệ tối đa 50 ký tự."))
  .max(30, "Tối đa 30 công nghệ cho mỗi Project.")
  .optional()
  .transform((items) => {
    if (!items) return undefined;
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const item of items) {
      const normalized = item.trim();
      const key = normalized.toLowerCase();
      if (normalized && !seen.has(key)) {
        seen.add(key);
        deduped.push(normalized);
      }
    }
    return deduped;
  });

const dateInputSchema = z.coerce
  .date({ message: "Ngày không hợp lệ." })
  .refine((value) => !Number.isNaN(value.getTime()), {
    message: "Ngày không hợp lệ.",
  });

const optionalUuidSchema = z
  .union([uuidSchema, z.literal(""), z.null()])
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

export const projectStatusFilterSchema = z.enum([
  ProjectStatus.CREATED,
  ProjectStatus.ACTIVE,
  ProjectStatus.ARCHIVED,
]);

export const projectListQuerySchema = paginationQuerySchema.extend({
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().max(150).optional(),
  status: projectStatusFilterSchema.optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "startDate", "name", "status"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const createProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Tên Project phải có ít nhất 2 ký tự.")
      .max(200, "Tên Project không được vượt quá 200 ký tự."),
    description: nullableTextSchema(5000, "Mô tả"),
    objectives: nullableTextSchema(5000, "Mục tiêu"),
    scope: nullableTextSchema(5000, "Phạm vi"),
    startDate: dateInputSchema,
    endDate: dateInputSchema,
    repositoryUrl: optionalRepositoryUrlSchema,
    technologies: technologiesSchema.default([]),
    templateId: optionalUuidSchema,
    leaderId: optionalUuidSchema,
    instructorId: optionalUuidSchema,
    memberIds: z.array(uuidSchema).max(50).optional().default([]),
  })
  .refine((data) => data.endDate.getTime() >= data.startDate.getTime(), {
    path: ["endDate"],
    message: "Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.",
  });

export const updateProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Tên Project phải có ít nhất 2 ký tự.")
      .max(200, "Tên Project không được vượt quá 200 ký tự.")
      .optional(),
    description: nullableTextSchema(5000, "Mô tả"),
    objectives: nullableTextSchema(5000, "Mục tiêu"),
    scope: nullableTextSchema(5000, "Phạm vi"),
    startDate: dateInputSchema.optional(),
    endDate: dateInputSchema.optional(),
    repositoryUrl: optionalRepositoryUrlSchema,
    technologies: technologiesSchema,
    templateId: optionalUuidSchema,
    instructorId: optionalUuidSchema,
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.objectives !== undefined ||
      data.scope !== undefined ||
      data.startDate !== undefined ||
      data.endDate !== undefined ||
      data.repositoryUrl !== undefined ||
      data.technologies !== undefined ||
      data.templateId !== undefined ||
      data.instructorId !== undefined,
    { message: "Cần ít nhất một thông tin để cập nhật Project." }
  );

export const restoreProjectSchema = z.object({
  targetStatus: z.enum([ProjectStatus.CREATED, ProjectStatus.ACTIVE]),
});

export const PROJECT_CANDIDATE_KINDS = ["instructor", "leader", "member"] as const;
export type ProjectCandidateKind = (typeof PROJECT_CANDIDATE_KINDS)[number];

export const projectCandidateQuerySchema = z.object({
  kind: z.enum(PROJECT_CANDIDATE_KINDS),
  q: z
    .string()
    .trim()
    .max(100, "Từ khóa tìm kiếm tối đa 100 ký tự.")
    .optional()
    .transform((val) => (val && val.length > 0 ? val : undefined)),
  projectId: uuidSchema.optional(),
  excludeCurrentMembers: z
    .enum(["true", "false"])
    .optional()
    .transform((val) => val === "true"),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

export type ProjectListQueryInput = z.infer<typeof projectListQuerySchema>;
export type CreateProjectInput = z.input<typeof createProjectSchema>;
export type UpdateProjectInput = z.input<typeof updateProjectSchema>;
export type RestoreProjectInput = z.infer<typeof restoreProjectSchema>;
export type ProjectCandidateQueryInput = z.input<typeof projectCandidateQuerySchema>;
