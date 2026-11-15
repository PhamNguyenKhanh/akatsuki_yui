import { NotificationDeliveryStatus, NotificationType } from "@prisma/client";
import { z } from "zod";
import { uuidSchema } from "@/lib/validations/common";

export const notificationTypeSchema = z.nativeEnum(NotificationType, {
  error: "Loại thông báo không hợp lệ.",
});

export const notificationDeliveryStatusSchema = z.nativeEnum(NotificationDeliveryStatus, {
  error: "Trạng thái gửi thông báo không hợp lệ.",
});

export const notificationListQuerySchema = z.object({
  status: z.enum(["all", "unread", "read"]).default("all"),
  type: notificationTypeSchema.optional(),
  projectId: uuidSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const markNotificationReadSchema = z.object({
  isRead: z.boolean().default(true),
});

export const deliveryHistoryQuerySchema = z.object({
  status: z
    .enum(["ALL", "PENDING", "SENT", "FAILED", "FAILED_RETRYABLE", "FAILED_TERMINAL"])
    .default("ALL"),
  type: notificationTypeSchema.optional(),
  recipientEmail: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type NotificationListQueryInput = z.input<typeof notificationListQuerySchema>;
export type ParsedNotificationListQuery = z.output<typeof notificationListQuerySchema>;
export type MarkNotificationReadInput = z.input<typeof markNotificationReadSchema>;
export type DeliveryHistoryQueryInput = z.input<typeof deliveryHistoryQuerySchema>;
export type ParsedDeliveryHistoryQuery = z.output<typeof deliveryHistoryQuerySchema>;
