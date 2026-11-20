import { z } from "zod";
import { isValidYmd } from "@/lib/timezone";
import { uuidSchema } from "@/lib/validations/common";
import {
  END_TIME_PATTERN,
  hhmmToMinutes,
  SCHEDULE_RECURRENCE_SCOPES,
  START_TIME_PATTERN,
} from "@/modules/schedule/schedule.types";

const ymdDateSchema = z
  .string()
  .trim()
  .refine((val) => isValidYmd(val), {
    message: "Ngày không đúng định dạng YYYY-MM-DD hợp lệ.",
  });

const startTimeSchema = z
  .string()
  .trim()
  .regex(START_TIME_PATTERN, "Giờ bắt đầu phải theo định dạng HH:mm (00:00 – 23:59).");

const endTimeSchema = z
  .string()
  .trim()
  .regex(END_TIME_PATTERN, "Giờ kết thúc phải theo định dạng HH:mm (00:01 – 24:00).");

const optionalNoteSchema = z
  .string()
  .trim()
  .max(500, "Ghi chú không được vượt quá 500 ký tự.")
  .nullable()
  .optional()
  .transform((val) => (val && val.length > 0 ? val : null));

export const scheduleWeekQuerySchema = z.object({
  weekStart: ymdDateSchema.optional(),
  userId: uuidSchema.optional(),
});

export const createScheduleEntrySchema = z
  .object({
    date: ymdDateSchema,
    startTime: startTimeSchema,
    endTime: endTimeSchema,
    isRecurring: z.boolean().default(false),
    note: optionalNoteSchema,
  })
  .refine((data) => hhmmToMinutes(data.endTime) > hhmmToMinutes(data.startTime), {
    path: ["endTime"],
    message: "Giờ kết thúc phải lớn hơn giờ bắt đầu.",
  });

export const updateScheduleEntrySchema = z
  .object({
    scope: z.enum(SCHEDULE_RECURRENCE_SCOPES).default("ALL_SERIES"),
    occurrenceDate: ymdDateSchema,
    date: ymdDateSchema.optional(),
    startTime: startTimeSchema,
    endTime: endTimeSchema,
    isRecurring: z.boolean(),
    note: optionalNoteSchema,
  })
  .refine((data) => hhmmToMinutes(data.endTime) > hhmmToMinutes(data.startTime), {
    path: ["endTime"],
    message: "Giờ kết thúc phải lớn hơn giờ bắt đầu.",
  });

export const deleteScheduleEntrySchema = z.object({
  scope: z.enum(SCHEDULE_RECURRENCE_SCOPES).default("ALL_SERIES"),
  occurrenceDate: ymdDateSchema,
});

export type ScheduleWeekQueryInput = z.input<typeof scheduleWeekQuerySchema>;
export type CreateScheduleEntryInput = z.input<typeof createScheduleEntrySchema>;
export type UpdateScheduleEntryInput = z.input<typeof updateScheduleEntrySchema>;
export type DeleteScheduleEntryInput = z.input<typeof deleteScheduleEntrySchema>;
