import { DocumentCategory } from "@prisma/client";
import { z } from "zod";
import { uuidSchema } from "@/lib/validations/common";

export const ALLOWED_GOOGLE_DRIVE_HOSTS = new Set(["drive.google.com", "docs.google.com"]);

export interface GoogleDriveUrlValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  reason?: string;
}

/**
 * Validates that a URL is a legitimate HTTPS Google Drive or Google Docs link (DEC-035).
 * Rejects http:, embedded credentials, lookalike domains, subdomains, and bare root URLs.
 */
export function validateGoogleDriveUrl(rawUrl: string): GoogleDriveUrlValidationResult {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, reason: "URL tài liệu không được để trống." };
  }
  if (trimmed.length > 1000) {
    return { valid: false, reason: "URL tài liệu không được vượt quá 1000 ký tự." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, reason: "URL tài liệu không đúng định dạng hợp lệ." };
  }

  if (parsed.protocol !== "https:") {
    return {
      valid: false,
      reason: "Chỉ chấp nhận liên kết Google Drive / Google Docs sử dụng giao thức HTTPS.",
    };
  }

  if (parsed.username || parsed.password) {
    return {
      valid: false,
      reason: "URL tài liệu không được chứa thông tin xác thực (username/password).",
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!ALLOWED_GOOGLE_DRIVE_HOSTS.has(hostname)) {
    return {
      valid: false,
      reason:
        "Chỉ chấp nhận liên kết từ tên miền chính thức https://drive.google.com hoặc https://docs.google.com.",
    };
  }

  if (parsed.port && parsed.port !== "443") {
    return {
      valid: false,
      reason: "URL tài liệu không được sử dụng cổng mạng tùy chỉnh.",
    };
  }

  const cleanPath = parsed.pathname.replace(/\/+$/, "");
  if (!cleanPath || cleanPath === "") {
    return {
      valid: false,
      reason: "URL phải trỏ tới một tệp, thư mục hoặc tài liệu cụ thể trên Google Drive / Docs.",
    };
  }

  return {
    valid: true,
    normalizedUrl: trimmed,
  };
}

export const googleDriveUrlSchema = z
  .string()
  .trim()
  .min(1, "URL tài liệu không được để trống.")
  .max(1000, "URL tài liệu không được vượt quá 1000 ký tự.")
  .superRefine((val, ctx) => {
    const check = validateGoogleDriveUrl(val);
    if (!check.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: check.reason ?? "Liên kết Google Drive không hợp lệ.",
      });
    }
  });

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
});

export const updateDocumentSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Tiêu đề tài liệu không được để trống.")
      .max(200, "Tiêu đề tài liệu không được vượt quá 200 ký tự.")
      .optional(),
    url: googleDriveUrlSchema.optional(),
    category: documentCategorySchema.optional(),
    description: z
      .string()
      .trim()
      .max(2000, "Mô tả tài liệu không được vượt quá 2000 ký tự.")
      .nullable()
      .optional()
      .transform((v) => (v === undefined ? undefined : v && v.length > 0 ? v : null)),
    sprintId: uuidSchema.nullable().optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.url !== undefined ||
      data.category !== undefined ||
      data.description !== undefined ||
      data.sprintId !== undefined,
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
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateDocumentInput = z.input<typeof createDocumentSchema>;
export type ParsedCreateDocumentInput = z.output<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.input<typeof updateDocumentSchema>;
export type ParsedUpdateDocumentInput = z.output<typeof updateDocumentSchema>;
export type DocumentListQueryInput = z.input<typeof documentListQuerySchema>;
export type ParsedDocumentListQuery = z.output<typeof documentListQuerySchema>;
