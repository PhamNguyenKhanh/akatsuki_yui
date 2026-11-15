import { z } from "zod";

export const uuidSchema = z.string().uuid("ID không đúng định dạng UUID.");

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Vui lòng nhập Email.")
  .max(255, "Email không được vượt quá 255 ký tự.")
  .email("Email không đúng định dạng.")
  .transform((value) => value.toLowerCase());

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Họ và tên phải có ít nhất 2 ký tự.")
  .max(150, "Họ và tên không được vượt quá 150 ký tự.");

/**
 * Password Policy (DEC-013):
 * - At least 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 digit
 * - At least 1 special character
 */
export const passwordPolicySchema = z
  .string()
  .min(8, "Mật khẩu phải có ít nhất 8 ký tự.")
  .max(128, "Mật khẩu không được vượt quá 128 ký tự.")
  .refine((value) => /[A-Z]/.test(value), {
    message: "Mật khẩu phải chứa ít nhất 1 chữ cái viết hoa.",
  })
  .refine((value) => /[a-z]/.test(value), {
    message: "Mật khẩu phải chứa ít nhất 1 chữ cái viết thường.",
  })
  .refine((value) => /\d/.test(value), {
    message: "Mật khẩu phải chứa ít nhất 1 chữ số.",
  })
  .refine((value) => /[^A-Za-z0-9]/.test(value), {
    message: "Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt.",
  });

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export function isSafeHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    if (parsed.username || parsed.password) {
      return false;
    }
    return parsed.hostname.length > 0;
  } catch {
    return false;
  }
}
