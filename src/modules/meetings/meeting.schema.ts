import { z } from "zod";
import { validateGoogleMeetUrl } from "@/lib/safe-url";
import { isValidYmd } from "@/lib/timezone";
import { uuidSchema } from "@/lib/validations/common";
import {
  END_TIME_PATTERN,
  hhmmToMinutes,
  START_TIME_PATTERN,
} from "@/modules/schedule/schedule.types";

const ymdDateSchema = z
  .string()
  .trim()
  .refine((val) => isValidYmd(val), {
    message: "Ngày họp không đúng định dạng YYYY-MM-DD hợp lệ.",
  });

const meetUrlSchema = z
  .string()
  .trim()
  .superRefine((val, ctx) => {
    const check = validateGoogleMeetUrl(val);
    if (!check.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: check.reason ?? "Link Google Meet không hợp lệ.",
      });
    }
  });

const optionalDescriptionSchema = z
  .string()
  .trim()
  .max(2000, "Mô tả không được vượt quá 2000 ký tự.")
  .nullable()
  .optional()
  .transform((val) => (val && val.length > 0 ? val : null));

const optionalShortDescriptionSchema = z
  .string()
  .trim()
  .max(500, "Ghi chú không được vượt quá 500 ký tự.")
  .nullable()
  .optional()
  .transform((val) => (val && val.length > 0 ? val : null));

export const createMeetLinkSchema = z.object({
  label: z
    .string()
    .trim()
    .min(2, "Tên phòng Meet phải có ít nhất 2 ký tự.")
    .max(150, "Tên phòng Meet không được vượt quá 150 ký tự."),
  url: meetUrlSchema,
  description: optionalShortDescriptionSchema,
  isDefault: z.boolean().default(false),
});

export const updateMeetLinkSchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(2, "Tên phòng Meet phải có ít nhất 2 ký tự.")
      .max(150, "Tên phòng Meet không được vượt quá 150 ký tự.")
      .optional(),
    url: meetUrlSchema.optional(),
    description: optionalShortDescriptionSchema,
    isDefault: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.label !== undefined ||
      data.url !== undefined ||
      data.description !== undefined ||
      data.isDefault !== undefined,
    { message: "Cần ít nhất một thông tin để cập nhật link Google Meet." }
  );

const startTimeSchema = z
  .string()
  .trim()
  .regex(START_TIME_PATTERN, "Giờ bắt đầu phải theo định dạng HH:mm (00:00 – 23:59).");

const endTimeSchema = z
  .string()
  .trim()
  .regex(END_TIME_PATTERN, "Giờ kết thúc phải theo định dạng HH:mm (00:01 – 24:00).");

const optionalMeetLinkIdSchema = z
  .union([uuidSchema, z.literal(""), z.null()])
  .optional()
  .transform((val) => (val && val.length > 0 ? val : null));

export const createProjectMeetingSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "Tiêu đề cuộc họp phải có ít nhất 2 ký tự.")
      .max(200, "Tiêu đề cuộc họp không được vượt quá 200 ký tự."),
    description: optionalDescriptionSchema,
    date: ymdDateSchema,
    startTime: startTimeSchema,
    endTime: endTimeSchema,
    meetLinkId: optionalMeetLinkIdSchema,
    meetUrl: z.string().trim().optional(),
    participantUserIds: z
      .array(uuidSchema)
      .min(1, "Cần chọn ít nhất một thành viên tham gia cuộc họp.")
      .max(50, "Số lượng thành viên tham gia tối đa là 50.")
      .transform((ids) => Array.from(new Set(ids))),
  })
  .refine((data) => hhmmToMinutes(data.endTime) > hhmmToMinutes(data.startTime), {
    path: ["endTime"],
    message: "Giờ kết thúc phải lớn hơn giờ bắt đầu.",
  })
  .superRefine((data, ctx) => {
    if (!data.meetLinkId && (!data.meetUrl || data.meetUrl.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["meetUrl"],
        message: "Vui lòng chọn một link Meet có sẵn hoặc nhập link Google Meet mới.",
      });
      return;
    }
    if (data.meetUrl && data.meetUrl.trim().length > 0) {
      const check = validateGoogleMeetUrl(data.meetUrl);
      if (!check.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["meetUrl"],
          message: check.reason ?? "Link Google Meet không hợp lệ.",
        });
      }
    }
  });

export const updateProjectMeetingSchema = createProjectMeetingSchema;

export type CreateMeetLinkInput = z.input<typeof createMeetLinkSchema>;
export type UpdateMeetLinkInput = z.input<typeof updateMeetLinkSchema>;
export type CreateProjectMeetingInput = z.input<typeof createProjectMeetingSchema>;
export type UpdateProjectMeetingInput = z.input<typeof updateProjectMeetingSchema>;
