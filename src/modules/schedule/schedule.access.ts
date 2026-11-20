import "server-only";
import { ProjectMemberRole, ProjectStatus, type Prisma } from "@prisma/client";
import { badRequestError, conflictError, forbiddenError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { uuidSchema } from "@/lib/validations/common";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { assertPermission, hasPermission } from "@/modules/authorization/policy.service";
import { assertProjectReadAccess, isWorkspaceAdmin } from "@/modules/projects/project.access";
import type { AuthContext } from "@/types/auth";

export type AccessibleScheduleProject = Awaited<ReturnType<typeof assertProjectReadAccess>>;

export function parseScheduleEntryId(entryId: string): string {
  const parsed = uuidSchema.safeParse(entryId);
  if (!parsed.success) {
    throw badRequestError("Schedule Entry ID không đúng định dạng UUID.", [
      { field: "entryId", message: "Schedule Entry ID không hợp lệ." },
    ]);
  }
  return parsed.data;
}

export function isProjectLeaderOrAdmin(
  actor: AuthContext,
  project: Pick<AccessibleScheduleProject, "leaderId" | "members">
): boolean {
  if (isWorkspaceAdmin(actor)) return true;
  if (project.leaderId === actor.userId) return true;
  return project.members.some((m) => m.projectRole === ProjectMemberRole.LEADER);
}

/**
 * Checks whether the actor may create/edit their OWN schedule entries in this Project.
 * INSTRUCTOR role without SCHEDULE_MANAGE (or instructor-only participation) stays read-only.
 */
export function canActorManageOwnSchedule(
  actor: AuthContext,
  project: Pick<AccessibleScheduleProject, "status" | "leaderId" | "members">
): boolean {
  if (project.status === ProjectStatus.ARCHIVED) {
    return false;
  }
  if (!hasPermission(actor, PERMISSIONS.SCHEDULE_MANAGE)) {
    return false;
  }
  if (isWorkspaceAdmin(actor) || project.leaderId === actor.userId) {
    return true;
  }
  return project.members.some((m) => m.projectRole !== ProjectMemberRole.INSTRUCTOR);
}

export async function assertScheduleReadAccess(
  actor: AuthContext,
  projectId: string,
  tx: Prisma.TransactionClient = prisma
): Promise<AccessibleScheduleProject> {
  assertPermission(actor, PERMISSIONS.SCHEDULE_READ);
  return assertProjectReadAccess(actor, projectId, tx);
}

export function assertCanCreateOwnSchedule(
  actor: AuthContext,
  project: AccessibleScheduleProject
): void {
  assertPermission(actor, PERMISSIONS.SCHEDULE_MANAGE);
  if (project.status === ProjectStatus.ARCHIVED) {
    throw conflictError(
      "PROJECT_ARCHIVED",
      "Project đang ở trạng thái ARCHIVED và bị khóa chỉnh sửa lịch bận."
    );
  }
  if (!canActorManageOwnSchedule(actor, project)) {
    throw forbiddenError("Bạn không có quyền ghi chú lịch bận trong Project này.");
  }
}

export function assertCanUpdateScheduleEntry(
  actor: AuthContext,
  project: AccessibleScheduleProject,
  entryOwnerId: string
): void {
  assertPermission(actor, PERMISSIONS.SCHEDULE_MANAGE);
  if (project.status === ProjectStatus.ARCHIVED) {
    throw conflictError(
      "PROJECT_ARCHIVED",
      "Project đang ở trạng thái ARCHIVED và bị khóa chỉnh sửa lịch bận."
    );
  }
  if (entryOwnerId !== actor.userId) {
    throw forbiddenError("Bạn chỉ có thể chỉnh sửa khung giờ bận của chính mình.");
  }
  if (!canActorManageOwnSchedule(actor, project)) {
    throw forbiddenError("Bạn không có quyền chỉnh sửa lịch bận trong Project này.");
  }
}

export function assertCanDeleteScheduleEntry(
  actor: AuthContext,
  project: AccessibleScheduleProject,
  entryOwnerId: string
): void {
  if (project.status === ProjectStatus.ARCHIVED) {
    throw conflictError(
      "PROJECT_ARCHIVED",
      "Project đang ở trạng thái ARCHIVED và bị khóa xóa lịch bận."
    );
  }

  const isOwner = entryOwnerId === actor.userId;
  if (isOwner) {
    assertPermission(actor, PERMISSIONS.SCHEDULE_MANAGE);
    if (!canActorManageOwnSchedule(actor, project)) {
      throw forbiddenError("Bạn không có quyền xóa lịch bận trong Project này.");
    }
    return;
  }

  if (!isProjectLeaderOrAdmin(actor, project)) {
    throw forbiddenError(
      "Chỉ chính chủ, Project Leader hoặc Admin mới có quyền xóa khung giờ bận này."
    );
  }
}
