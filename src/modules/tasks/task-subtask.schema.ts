import { z } from "zod";

export const createTaskSubtaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Tên đầu việc không được để trống.")
    .max(255, "Tên đầu việc không được vượt quá 255 ký tự."),
});

export const toggleTaskSubtaskSchema = z.object({
  isCompleted: z.boolean(),
});

export type CreateTaskSubtaskInput = z.infer<typeof createTaskSubtaskSchema>;
