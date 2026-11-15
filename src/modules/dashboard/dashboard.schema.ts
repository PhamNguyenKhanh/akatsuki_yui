import { z } from "zod";
import { uuidSchema } from "@/lib/validations/common";

export const dashboardQuerySchema = z.object({
  projectId: uuidSchema.optional(),
});

export type DashboardQueryInput = z.infer<typeof dashboardQuerySchema>;
