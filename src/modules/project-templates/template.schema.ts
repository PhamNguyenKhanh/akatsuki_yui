import { z } from "zod";
import { paginationQuerySchema } from "@/lib/validations/common";

const templateNameSchema = z
  .string()
  .trim()
  .min(2, "Tên Template phải có ít nhất 2 ký tự.")
  .max(150, "Tên Template không được vượt quá 150 ký tự.");

const templateDescriptionSchema = z
  .string()
  .trim()
  .max(2000, "Mô tả Template không được vượt quá 2000 ký tự.")
  .nullable()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const MAX_TEMPLATE_CONFIG_BYTES = 16 * 1024;

const templateConfigurationRecordSchema = z
  .record(z.string(), z.unknown())
  .refine((value) => Buffer.byteLength(JSON.stringify(value), "utf8") <= MAX_TEMPLATE_CONFIG_BYTES, {
    message: "Cấu hình JSON của Template không được vượt quá 16 KB.",
  });

const templateConfigurationSchema = templateConfigurationRecordSchema
  .nullable()
  .optional()
  .transform((value) => value ?? null);

export const projectTemplateListQuerySchema = paginationQuerySchema.extend({
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(150).optional(),
  activeOnly: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((value) => value === true || value === "true"),
});

export const createProjectTemplateSchema = z.object({
  name: templateNameSchema,
  description: templateDescriptionSchema,
  configuration: templateConfigurationSchema,
  isActive: z.boolean().optional().default(true),
});

export const updateProjectTemplateSchema = z
  .object({
    name: templateNameSchema.optional(),
    description: templateDescriptionSchema,
    configuration: templateConfigurationRecordSchema.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.configuration !== undefined ||
      data.isActive !== undefined,
    { message: "Cần ít nhất một trường dữ liệu để cập nhật Template." }
  );

export type ProjectTemplateListQueryInput = z.infer<typeof projectTemplateListQuerySchema>;
export type CreateProjectTemplateInput = z.input<typeof createProjectTemplateSchema>;
export type UpdateProjectTemplateInput = z.input<typeof updateProjectTemplateSchema>;
