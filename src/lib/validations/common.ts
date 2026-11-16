import { z } from "zod";

export const uuidSchema = z.string().uuid("ID không đúng định dạng UUID.");

const STRICT_EMAIL_FORBIDDEN_CHARS = /[\u0000-\u001F\u007F\s,;<>'"\\():]/;
const DOMAIN_LABEL_REGEX = /^[A-Za-z0-9-]+$/;

/**
 * Strict single-recipient email address check:
 * - Rejects display-name syntax ("Name <user@host>"), comma/semicolon lists, quotes, control chars/CRLF
 * - Validates RFC 5321 lengths (total <= 254, local <= 64, domain <= 253) and label syntax
 */
export function isStrictSingleEmailAddress(rawValue: string): boolean {
  if (typeof rawValue !== "string") return false;
  const trimmed = rawValue.trim();
  if (!trimmed || trimmed.length > 254 || STRICT_EMAIL_FORBIDDEN_CHARS.test(trimmed)) {
    return false;
  }

  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0 || trimmed.indexOf("@", atIndex + 1) !== -1) {
    return false;
  }

  const localPart = trimmed.slice(0, atIndex);
  const domainPart = trimmed.slice(atIndex + 1);

  if (
    localPart.length > 64 ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..")
  ) {
    return false;
  }

  if (
    domainPart.length < 3 ||
    domainPart.length > 253 ||
    domainPart.startsWith(".") ||
    domainPart.endsWith(".") ||
    domainPart.includes("..") ||
    !domainPart.includes(".")
  ) {
    return false;
  }

  const labels = domainPart.split(".");
  if (
    labels.some(
      (label) =>
        label.length === 0 ||
        label.length > 63 ||
        label.startsWith("-") ||
        label.endsWith("-") ||
        !DOMAIN_LABEL_REGEX.test(label)
    )
  ) {
    return false;
  }

  const tld = labels[labels.length - 1] ?? "";
  if (tld.length < 2 || /^\d+$/.test(tld)) {
    return false;
  }

  return z.string().email().safeParse(trimmed).success;
}

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Vui lòng nhập Email.")
  .max(254, "Email không được vượt quá 254 ký tự.")
  .email("Email không đúng định dạng.")
  .refine(isStrictSingleEmailAddress, {
    message: "Email không đúng định dạng địa chỉ hợp lệ.",
  })
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

export { isSafeHttpUrl } from "@/lib/safe-url";
