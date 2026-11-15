import "server-only";
import { ProjectMemberRole, UserStatus, type Prisma } from "@prisma/client";
import { badRequestError, conflictError, forbiddenError, notFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { uuidSchema } from "@/lib/validations/common";
import { ROLES } from "@/modules/authorization/constants";
import type { AuthContext } from "@/types/auth";

export function parseProjectId(projectId: string): string {
  const parsed = uuidSchema.safeParse(projectId);
  if (!parsed.success) {
    throw badRequestError("Project ID không đúng định dạng UUID.", [
      { field: "projectId", message: "Project ID không hợp lệ." },
    ]);
  }
  return parsed.data;
}

export function isWorkspaceAdmin(actor: AuthContext): boolean {
  return actor.roles.includes(ROLES.ADMIN);
}

/**
 * Builds a Prisma Project filter scoped to Projects readable by the actor (`assertProjectReadAccess` parity).
 */
export function buildAccessibleProjectsWhere(actor: AuthContext): Prisma.ProjectWhereInput {
  if (isWorkspaceAdmin(actor)) {
    return {};
  }

  return {
    OR: [
      { leaderId: actor.userId },
      { instructorId: actor.userId },
      { members: { some: { userId: actor.userId, leftAt: null } } },
    ],
  };
}

/**
 * Verifies whether the authenticated actor can view the specified Project.
 * Workspace Admins have full visibility; non-Admin roles require an active
 * Leader, Instructor, or Member association with the Project.
 */
export async function assertProjectReadAccess(
  actor: AuthContext,
  projectId: string,
  tx: Prisma.TransactionClient = prisma
) {
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      status: true,
      leaderId: true,
      instructorId: true,
      members: {
        where: {
          userId: actor.userId,
          leftAt: null,
        },
        select: {
          id: true,
          projectRole: true,
        },
      },
    },
  });

  if (!project) {
    throw notFoundError("Không tìm thấy Project yêu cầu.");
  }

  if (isWorkspaceAdmin(actor)) {
    return project;
  }

  const hasParticipation =
    project.leaderId === actor.userId ||
    project.instructorId === actor.userId ||
    project.members.length > 0;

  if (!hasParticipation) {
    throw forbiddenError("Bạn không có quyền truy cập Project này.");
  }

  return project;
}

/**
 * Verifies project-scoped Leader ownership for mutating operations.
 * Workspace Admins may manage any Project; Leaders may manage only Projects
 * where they are the active Leader.
 */
export async function assertProjectLeaderAccess(
  actor: AuthContext,
  projectId: string,
  tx: Prisma.TransactionClient = prisma
) {
  const project = await assertProjectReadAccess(actor, projectId, tx);

  if (isWorkspaceAdmin(actor)) {
    return project;
  }

  const isActiveLeader =
    project.leaderId === actor.userId ||
    project.members.some((m) => m.projectRole === ProjectMemberRole.LEADER);

  if (!isActiveLeader) {
    throw forbiddenError("Chỉ Leader của Project hoặc Admin mới có quyền thực hiện thao tác này.");
  }

  return project;
}

export async function assertActiveUsersExist(
  tx: Prisma.TransactionClient,
  userIds: string[],
  errorField?: string
) {
  if (userIds.length === 0) return;

  const uniqueIds = Array.from(new Set(userIds));
  const users = await tx.user.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, status: true, fullName: true },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));
  for (const id of uniqueIds) {
    const found = userMap.get(id);
    if (!found) {
      throw notFoundError("Không tìm thấy tài khoản thành viên được chọn.");
    }
    if (found.status !== UserStatus.ACTIVE) {
      throw conflictError(
        "ACCOUNT_NOT_ACTIVE",
        `Tài khoản "${found.fullName}" chưa ở trạng thái ACTIVE.`,
        errorField ? [{ field: errorField, message: "Tài khoản phải đang ACTIVE." }] : undefined
      );
    }
  }
}
