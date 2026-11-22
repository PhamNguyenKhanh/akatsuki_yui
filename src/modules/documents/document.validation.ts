import { DocumentCategory } from "@prisma/client";
import { z } from "zod";
import {
  ALLOWED_GOOGLE_DRIVE_HOSTS,
  type GoogleDriveUrlValidationResult,
  validateDocumentUrl,
  validateGoogleDriveUrl,
} from "@/lib/safe-url";
import { uuidSchema } from "@/lib/validations/common";

export {
  ALLOWED_GOOGLE_DRIVE_HOSTS,
  validateDocumentUrl,
  validateGoogleDriveUrl,
  type GoogleDriveUrlValidationResult,
};

export const documentUrlSchema = z
  .string()
  .trim()
  .min(1, "URL tài liệu không được để trống.")
  .max(1000, "URL tài liệu không được vượt quá 1000 ký tự.")
  .superRefine((val, ctx) => {
    const check = validateDocumentUrl(val);
    if (!check.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: check.reason ?? "Liên kết tài liệu không hợp lệ.",
      });
    }
  });

export const googleDriveUrlSchema = documentUrlSchema;

export const documentCategorySchema = z.nativeEnum(DocumentCategory, {
  error: "Danh mục tài liệu không hợp lệ.",
});

export const createDocumentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Tiêu đề tài liệu không được để trống.")
    .max(200, "Tiêu đề tài liệu không được vượt quá 200 ký tự."),
  url: googleDriveUrlSchema,
  category: documentCategorySchema.default(DocumentCategory.OTHER),
  description: z
    .string()
    .trim()
    .max(2000, "Mô tả tài liệu không được vượt quá 2000 ký tự.")
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  sprintId: uuidSchema.nullable().optional().default(null),
  isPinned: z.boolean().optional().default(false),
});

export const updateDocumentSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Tiêu đề tài liệu không được để trống.")
      .max(200, "Tiêu đề tài liệu không được vượt quá 200 ký tự.")
      .optional(),
    url: documentUrlSchema.optional(),
    category: documentCategorySchema.optional(),
    description: z
      .string()
      .trim()
      .max(2000, "Mô tả tài liệu không được vượt quá 2000 ký tự.")
      .nullable()
      .optional()
      .transform((v) => (v === undefined ? undefined : v && v.length > 0 ? v : null)),
    sprintId: uuidSchema.nullable().optional(),
    isPinned: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.url !== undefined ||
      data.category !== undefined ||
      data.description !== undefined ||
      data.sprintId !== undefined ||
      data.isPinned !== undefined,
    {
      message: "Cần cung cấp ít nhất một trường thông tin để cập nhật tài liệu.",
    }
  );

export const documentListQuerySchema = z.object({
  projectId: uuidSchema.optional(),
  sprintId: z.union([uuidSchema, z.literal("NONE")]).optional(),
  category: documentCategorySchema.optional(),
  search: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export type CreateDocumentInput = z.input<typeof createDocumentSchema>;
export type ParsedCreateDocumentInput = z.output<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.input<typeof updateDocumentSchema>;
export type ParsedUpdateDocumentInput = z.output<typeof updateDocumentSchema>;
export type DocumentListQueryInput = z.input<typeof documentListQuerySchema>;
export type ParsedDocumentListQuery = z.output<typeof documentListQuerySchema>;
