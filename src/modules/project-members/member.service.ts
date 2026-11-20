import "server-only";
import { ProjectMemberRole, ProjectStatus } from "@prisma/client";
import { acquireProjectUpdateLock } from "@/lib/db-locks";
import { badRequestError, conflictError, notFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";
import { uuidSchema } from "@/lib/validations/common";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { assertPermission } from "@/modules/authorization/policy.service";
import { schedulePostCommitEmailDispatch } from "@/modules/notifications/notification-delivery.service";
import {
  recordProjectLeaderChangedNotifications,
  recordProjectMemberAddedNotification,
  recordProjectMemberRemovedNotification,
} from "@/modules/notifications/notification-domain-events";
import {
  addProjectMemberSchema,
  changeProjectLeaderSchema,
  projectMembersQuerySchema,
  type AddProjectMemberInput,
  type ChangeProjectLeaderInput,
} from "@/modules/project-members/member.schema";
import {
  mapProjectMemberToDTO,
  projectMemberRepository,
  type ProjectMemberDTO,
} from "@/modules/project-members/member.repository";
import { taskAssignmentGuard } from "@/modules/project-members/task-assignment-guard";
import {
  assertActiveUsersExist,
  assertProjectLeaderAccess,
  assertProjectReadAccess,
  parseProjectId,
} from "@/modules/projects/project.access";
import type { AuthContext } from "@/types/auth";

function parseTargetMemberUserId(userId: string): string {
  const parsed = uuidSchema.safeParse(userId);
  if (!parsed.success) {
    throw badRequestError("User ID thành viên không đúng định dạng UUID.", [
      { field: "userId", message: "User ID không hợp lệ." },
    ]);
  }
  return parsed.data;
}

export async function listProjectMembersService(
  actor: AuthContext,
  projectId: string,
  rawQuery: Record<string, unknown> = {}
): Promise<ProjectMemberDTO[]> {
  assertPermission(actor, PERMISSIONS.PROJECT_READ);
  const validProjectId = parseProjectId(projectId);
  const query = projectMembersQuerySchema.parse(rawQuery);

  await assertProjectReadAccess(actor, validProjectId);
  return projectMemberRepository.listByProject(validProjectId, {
    includeHistory: query.includeHistory,
  });
}

export async function addProjectMemberService(
  actor: AuthContext,
  projectId: string,
  rawInput: AddProjectMemberInput
): Promise<ProjectMemberDTO> {
  assertPermission(actor, PERMISSIONS.PROJECT_MEMBER_MANAGE);
  const validProjectId = parseProjectId(projectId);
  const input = addProjectMemberSchema.parse(rawInput);

  if (input.projectRole === ProjectMemberRole.LEADER) {
    throw badRequestError(
      "Mỗi Project chỉ có một Leader chính. Vui lòng sử dụng chức năng Đổi Leader để chuyển giao vai trò Leader.",
      [{ field: "projectRole", message: "Không thể thêm trực tiếp vai trò LEADER." }]
    );
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const project = await assertProjectLeaderAccess(actor, validProjectId, tx);
      await acquireProjectUpdateLock(tx, validProjectId);
      if (project.status === ProjectStatus.ARCHIVED) {
        throw conflictError(
          "PROJECT_ARCHIVED",
          "Không thể thêm thành viên vào Project đang ở trạng thái ARCHIVED."
        );
      }

      if (
        input.projectRole === ProjectMemberRole.INSTRUCTOR &&
        project.instructorId &&
        project.instructorId !== input.userId
      ) {
        throw conflictError(
          "CONFLICT",
          "Project hiện đã có Instructor. Vui lòng cập nhật Instructor trong phần chỉnh sửa Project."
        );
      }

      await assertActiveUsersExist(tx, [input.userId], "userId");

      const existingActive = await projectMemberRepository.findActiveMembership(
        project.id,
        input.userId,
        tx
      );
      if (existingActive) {
        throw conflictError("ALREADY_PROJECT_MEMBER", "Thành viên này hiện đã tham gia Project.");
      }

      const member = await tx.projectMember.create({
        data: {
          projectId: project.id,
          userId: input.userId,
          projectRole: input.projectRole,
        },
        select: {
          id: true,
          projectId: true,
          userId: true,
          projectRole: true,
          joinedAt: true,
          leftAt: true,
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              status: true,
              userRoles: {
                select: {
                  role: { select: { name: true } },
                },
              },
            },
          },
        },
      });

      if (input.projectRole === ProjectMemberRole.INSTRUCTOR && !project.instructorId) {
        await tx.project.update({
          where: { id: project.id },
          data: { instructorId: input.userId },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: "PROJECT_MEMBER_ADDED",
          entityType: "Project",
          entityId: project.id,
          newValue: {
            userId: input.userId,
            userEmail: member.user.email,
            projectRole: input.projectRole,
          },
        },
      });

      await tx.activityLog.create({
        data: {
          userId: actor.userId,
          projectId: project.id,
          action: "PROJECT_MEMBER_ADDED",
          entityType: "Project",
          entityId: project.id,
          description: `Thêm ${member.user.fullName} vào Project "${project.name}" với vai trò ${input.projectRole}.`,
          metadata: {
            memberId: member.id,
            targetUserId: input.userId,
            projectRole: input.projectRole,
          },
        },
      });

      const notificationHandles = await recordProjectMemberAddedNotification(tx, {
        actorId: actor.userId,
        projectId: project.id,
        projectName: project.name,
        memberUserId: input.userId,
        memberEmail: member.user.email,
        projectRole: input.projectRole,
      });

      return { member, notificationHandles };
    });

    await schedulePostCommitEmailDispatch(created.notificationHandles);

    logger.info("Project member added", {
      actorId: actor.userId,
      projectId: validProjectId,
      targetUserId: input.userId,
      projectRole: input.projectRole,
    });

    return mapProjectMemberToDTO(created.member);
  } catch (error) {
    if (isPrismaUniqueViolation(error, ["ProjectMember_active_project_user_idx"])) {
      throw conflictError("ALREADY_PROJECT_MEMBER", "Thành viên này hiện đã tham gia Project.");
    }
    throw error;
  }
}

export async function changeProjectLeaderService(
  actor: AuthContext,
  projectId: string,
  rawInput: ChangeProjectLeaderInput
): Promise<ProjectMemberDTO[]> {
  assertPermission(actor, PERMISSIONS.PROJECT_MEMBER_MANAGE);
  const validProjectId = parseProjectId(projectId);
  const { leaderId: nextLeaderId } = changeProjectLeaderSchema.parse(rawInput);

  const notificationHandles = await prisma.$transaction(async (tx) => {
    const project = await assertProjectLeaderAccess(actor, validProjectId, tx);
    await acquireProjectUpdateLock(tx, validProjectId);
    if (project.status === ProjectStatus.ARCHIVED) {
      throw conflictError(
        "PROJECT_ARCHIVED",
        "Không thể đổi Leader cho Project đang ở trạng thái ARCHIVED."
      );
    }

    await assertActiveUsersExist(tx, [nextLeaderId], "leaderId");

    if (project.leaderId === nextLeaderId) {
      return [];
    }

    const previousLeaderId = project.leaderId;

    await tx.projectMember.updateMany({
      where: {
        projectId: project.id,
        userId: previousLeaderId,
        projectRole: ProjectMemberRole.LEADER,
        leftAt: null,
      },
      data: {
        projectRole: ProjectMemberRole.MEMBER,
      },
    });

    const nextLeaderActiveMembership = await projectMemberRepository.findActiveMembership(
      project.id,
      nextLeaderId,
      tx
    );

    if (nextLeaderActiveMembership) {
      await tx.projectMember.update({
        where: { id: nextLeaderActiveMembership.id },
        data: { projectRole: ProjectMemberRole.LEADER },
      });
    } else {
      await tx.projectMember.create({
        data: {
          projectId: project.id,
          userId: nextLeaderId,
          projectRole: ProjectMemberRole.LEADER,
        },
      });
    }

    await tx.project.update({
      where: { id: project.id },
      data: {
        leaderId: nextLeaderId,
        ...(project.instructorId === nextLeaderId ? { instructorId: null } : {}),
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: "PROJECT_LEADER_CHANGED",
        entityType: "Project",
        entityId: project.id,
        oldValue: { leaderId: previousLeaderId },
        newValue: { leaderId: nextLeaderId },
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.userId,
        projectId: project.id,
        action: "PROJECT_LEADER_CHANGED",
        entityType: "Project",
        entityId: project.id,
        description: `Chuyển giao vai trò Leader của Project "${project.name}".`,
        metadata: { previousLeaderId, nextLeaderId },
      },
    });

    return recordProjectLeaderChangedNotifications(tx, {
      actorId: actor.userId,
      projectId: project.id,
      projectName: project.name,
      previousLeaderId,
      nextLeaderId,
    });
  });

  await schedulePostCommitEmailDispatch(notificationHandles);

  logger.info("Project leader changed", {
    actorId: actor.userId,
    projectId: validProjectId,
    nextLeaderId,
  });

  return projectMemberRepository.listByProject(validProjectId, { includeHistory: true });
}

export async function removeProjectMemberService(
  actor: AuthContext,
  projectId: string,
  targetUserId: string
): Promise<ProjectMemberDTO> {
  assertPermission(actor, PERMISSIONS.PROJECT_MEMBER_MANAGE);
  const validProjectId = parseProjectId(projectId);
  const validUserId = parseTargetMemberUserId(targetUserId);

  const removed = await prisma.$transaction(async (tx) => {
    const project = await assertProjectLeaderAccess(actor, validProjectId, tx);
    await acquireProjectUpdateLock(tx, validProjectId);
    if (project.status === ProjectStatus.ARCHIVED) {
      throw conflictError(
        "PROJECT_ARCHIVED",
        "Không thể xóa thành viên khỏi Project đang ở trạng thái ARCHIVED."
      );
    }

    if (project.leaderId === validUserId) {
      throw conflictError(
        "CONFLICT",
        "Không thể xóa Leader hiện tại của Project. Hãy đổi Leader sang thành viên khác trước."
      );
    }

    const activeMembership = await projectMemberRepository.findActiveMembership(
      project.id,
      validUserId,
      tx
    );

    if (!activeMembership) {
      throw notFoundError("Thành viên này hiện không hoạt động trong Project.");
    }

    // DEC-009 / BR-MEM-005: Check unfinished Task assignments before removal.
    await taskAssignmentGuard.assertNoActiveProjectTasks(tx, project.id, validUserId);

    const updated = await tx.projectMember.update({
      where: { id: activeMembership.id },
      data: { leftAt: new Date() },
      select: {
        id: true,
        projectId: true,
        userId: true,
        projectRole: true,
        joinedAt: true,
        leftAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            status: true,
            userRoles: {
              select: {
                role: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (project.instructorId === validUserId) {
      await tx.project.update({
        where: { id: project.id },
        data: { instructorId: null },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: "PROJECT_MEMBER_REMOVED",
        entityType: "Project",
        entityId: project.id,
        oldValue: {
          userId: validUserId,
          userEmail: updated.user.email,
          projectRole: updated.projectRole,
        },
        newValue: {
          userId: validUserId,
          leftAt: updated.leftAt?.toISOString() ?? null,
        },
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.userId,
        projectId: project.id,
        action: "PROJECT_MEMBER_REMOVED",
        entityType: "Project",
        entityId: project.id,
        description: `Loại bỏ ${updated.user.fullName} khỏi Project "${project.name}" (giữ lại lịch sử tham gia).`,
        metadata: {
          memberId: updated.id,
          targetUserId: validUserId,
          previousProjectRole: updated.projectRole,
        },
      },
    });

    const notificationHandles = await recordProjectMemberRemovedNotification(tx, {
      actorId: actor.userId,
      projectId: project.id,
      projectName: project.name,
      memberUserId: validUserId,
      memberEmail: updated.user.email,
      previousRole: updated.projectRole,
    });

    return { updated, notificationHandles };
  });

  await schedulePostCommitEmailDispatch(removed.notificationHandles);

  logger.info("Project member removed (soft-leave)", {
    actorId: actor.userId,
    projectId: validProjectId,
    targetUserId: validUserId,
  });

  return mapProjectMemberToDTO(removed.updated);
}
