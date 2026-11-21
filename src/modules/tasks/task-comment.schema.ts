import { z } from "zod";
import { uuidSchema } from "@/lib/validations/common";

export const createTaskCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Nội dung bình luận không được để trống.")
    .max(4000, "Bình luận không được vượt quá 4000 ký tự."),
  mentionedUserIds: z
    .array(uuidSchema)
    .max(20, "Tối đa 20 thành viên được nhắc tên trong một bình luận.")
    .optional()
    .default([]),
});

export type CreateTaskCommentInput = z.infer<typeof createTaskCommentSchema>;
