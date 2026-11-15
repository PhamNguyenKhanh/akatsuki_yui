import { ProjectMemberRole } from "@prisma/client";
import { z } from "zod";
import { uuidSchema } from "@/lib/validations/common";

export const projectMembersQuerySchema = z.object({
  includeHistory: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((value) => value === true || value === "true"),
});

export const addProjectMemberSchema = z.object({
  userId: uuidSchema,
  projectRole: z
    .enum([ProjectMemberRole.MEMBER, ProjectMemberRole.INSTRUCTOR, ProjectMemberRole.LEADER])
    .default(ProjectMemberRole.MEMBER),
});

export const changeProjectLeaderSchema = z.object({
  leaderId: uuidSchema,
});

export type ProjectMembersQueryInput = z.input<typeof projectMembersQuerySchema>;
export type AddProjectMemberInput = z.input<typeof addProjectMemberSchema>;
export type ChangeProjectLeaderInput = z.infer<typeof changeProjectLeaderSchema>;
