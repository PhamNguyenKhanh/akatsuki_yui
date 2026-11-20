import "server-only";
import { ProjectMemberRole, ProjectStatus, type Prisma } from "@prisma/client";
import { badRequestError, conflictError, forbiddenError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { uuidSchema } from "@/lib/validations/common";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { assertPermission, hasPermission } from "@/modules/authorization/policy.service";
import { assertProjectReadAccess, isWorkspaceAdmin } from "@/modules/projects/project.access";
import type { AuthContext } from "@/types/auth";

export type AccessibleMeetingProject = Awaited<ReturnType<typeof assertProjectReadAccess>>;

export function parseMeetLinkId(linkId: string): string {
  const parsed = uuidSchema.safeParse(linkId);
  if (!parsed.success) {
    throw badRequestError("Meet Link ID không đúng định dạng UUID.", [
      { field: "linkId", message: "Meet Link ID không hợp lệ." },
    ]);
  }
  return parsed.data;
}

export function parseMeetingId(meetingId: string): string {
  const parsed = uuidSchema.safeParse(meetingId);
  if (!parsed.success) {
    throw badRequestError("Meeting ID không đúng định dạng UUID.", [
      { field: "meetingId", message: "Meeting ID không hợp lệ." },
    ]);
  }
  return parsed.data;
}

export function canActorManageProjectMeetings(
  actor: AuthContext,
  project: Pick<AccessibleMeetingProject, "status" | "leaderId" | "members">
): boolean {
  if (project.status === ProjectStatus.ARCHIVED) {
    return false;
  }
  if (!hasPermission(actor, PERMISSIONS.MEETING_MANAGE)) {
    return false;
  }
  if (isWorkspaceAdmin(actor) || project.leaderId === actor.userId) {
    return true;
  }
  return project.members.some((m) => m.projectRole === ProjectMemberRole.LEADER);
}

export async function assertMeetingReadAccess(
  actor: AuthContext,
  projectId: string,
  tx: Prisma.TransactionClient = prisma
): Promise<AccessibleMeetingProject> {
  assertPermission(actor, PERMISSIONS.MEETING_READ);
  return assertProjectReadAccess(actor, projectId, tx);
}

export async function assertMeetingManageAccess(
  actor: AuthContext,
  projectId: string,
  tx: Prisma.TransactionClient = prisma
): Promise<AccessibleMeetingProject> {
  assertPermission(actor, PERMISSIONS.MEETING_MANAGE);
  const project = await assertProjectReadAccess(actor, projectId, tx);
  if (project.status === ProjectStatus.ARCHIVED) {
    throw conflictError(
      "PROJECT_ARCHIVED",
      "Project đang ở trạng thái ARCHIVED và bị khóa chỉnh sửa cuộc họp / link Meet."
    );
  }
  if (!canActorManageProjectMeetings(actor, project)) {
    throw forbiddenError(
      "Chỉ Project Leader hoặc Admin mới có quyền quản lý cuộc họp và link Meet."
    );
  }
  return project;
}
