import "server-only";
import { Prisma, ProjectMemberRole, ProjectStatus } from "@prisma/client";
import { acquireProjectUpdateLock } from "@/lib/db-locks";
import { badRequestError, conflictError, forbiddenError, notFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { assertPermission, hasPermission } from "@/modules/authorization/policy.service";
import { schedulePostCommitEmailDispatch } from "@/modules/notifications/notification-delivery.service";
import { recordProjectMemberAddedNotification } from "@/modules/notifications/notification-domain-events";
import { taskAssignmentGuard } from "@/modules/project-members/task-assignment-guard";
import {
  assertActiveUsersExist,
  assertProjectLeaderAccess,
  assertProjectReadAccess,
  isWorkspaceAdmin,
  parseProjectId,
} from "@/modules/projects/project.access";
import {
  mapProjectToDTO,
  projectRepository,
  type ActiveProjectSummaryDTO,
  type ProjectCandidateUserDTO,
  type ProjectDTO,
} from "@/modules/projects/project.repository";
import {
  createProjectSchema,
  projectCandidateQuerySchema,
  projectListQuerySchema,
  restoreProjectSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type ProjectListQueryInput,
  type RestoreProjectInput,
  type UpdateProjectInput,
} from "@/modules/projects/project.schema";
import type { AuthContext } from "@/types/auth";

export async function getAccessibleActiveProjectSummaryService(
  actor: AuthContext
): Promise<ActiveProjectSummaryDTO | null> {
  if (!hasPermission(actor, PERMISSIONS.PROJECT_READ)) {
    return null;
  }

  return projectRepository.findAccessibleActiveProject({
    adminViewAll: isWorkspaceAdmin(actor),
    userId: actor.userId,
  });
}

export async function listProjectsService(
  actor: AuthContext,
  rawQuery: Partial<ProjectListQueryInput> = {}
) {
  assertPermission(actor, PERMISSIONS.PROJECT_READ);
  const query = projectListQuerySchema.parse(rawQuery);
  return projectRepository.findManyPaginated(query, {
    adminViewAll: isWorkspaceAdmin(actor),
    userId: actor.userId,
  });
}

export async function getProjectDetailService(
  actor: AuthContext,
  projectId: string
): Promise<ProjectDTO> {
  assertPermission(actor, PERMISSIONS.PROJECT_READ);
  const validProjectId = parseProjectId(projectId);
  await assertProjectReadAccess(actor, validProjectId);

  const project = await projectRepository.findById(validProjectId);
  if (!project) {
    throw notFoundError("Không tìm thấy Project yêu cầu.");
  }

  return mapProjectToDTO(project);
}

export async function createProjectService(
  actor: AuthContext,
  rawInput: CreateProjectInput
): Promise<ProjectDTO> {
  assertPermission(actor, PERMISSIONS.PROJECT_CREATE);
  const input = createProjectSchema.parse(rawInput);

  const effectiveLeaderId =
    isWorkspaceAdmin(actor) && input.leaderId ? input.leaderId : actor.userId;

  const { created, notificationHandles } = await prisma.$transaction(async (tx) => {
    if (input.templateId) {
      const template = await tx.projectTemplate.findUnique({
        where: { id: input.templateId },
        select: { id: true, isActive: true, name: true },
      });
      if (!template) {
        throw notFoundError("Không tìm thấy Project Template đã chọn.");
      }
      if (!template.isActive) {
        throw badRequestError(
          `Template "${template.name}" hiện đang tạm ngưng, không thể chọn cho Project mới.`,
          [{ field: "templateId", message: "Template hiện không hoạt động." }]
        );
      }
    }

    const usersToValidate = [
      effectiveLeaderId,
      ...(input.instructorId ? [input.instructorId] : []),
      ...input.memberIds,
    ];
    await assertActiveUsersExist(tx, usersToValidate);

    const project = await tx.project.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        objectives: input.objectives ?? null,
        scope: input.scope ?? null,
        startDate: input.startDate,
        endDate: input.endDate,
        status: ProjectStatus.CREATED,
        repositoryUrl: input.repositoryUrl ?? null,
        technologies:
          input.technologies.length > 0
            ? (input.technologies as Prisma.InputJsonValue)
            : Prisma.DbNull,
        templateId: input.templateId ?? null,
        leaderId: effectiveLeaderId,
        instructorId: input.instructorId ?? null,
        createdById: actor.userId,
      },
      select: { id: true, name: true },
    });

    const memberRows: Prisma.ProjectMemberCreateManyInput[] = [
      {
        projectId: project.id,
        userId: effectiveLeaderId,
        projectRole: ProjectMemberRole.LEADER,
      },
    ];

    const seenUserIds = new Set<string>([effectiveLeaderId]);

    if (input.instructorId && !seenUserIds.has(input.instructorId)) {
      seenUserIds.add(input.instructorId);
      memberRows.push({
        projectId: project.id,
        userId: input.instructorId,
        projectRole: ProjectMemberRole.INSTRUCTOR,
      });
    }

    for (const memberId of input.memberIds) {
      if (!seenUserIds.has(memberId)) {
        seenUserIds.add(memberId);
        memberRows.push({
          projectId: project.id,
          userId: memberId,
          projectRole: ProjectMemberRole.MEMBER,
        });
      }
    }

    await tx.projectMember.createMany({ data: memberRows });

    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: "PROJECT_CREATED",
        entityType: "Project",
        entityId: project.id,
        oldValue: Prisma.DbNull,
        newValue: {
          name: project.name,
          status: ProjectStatus.CREATED,
          leaderId: effectiveLeaderId,
          instructorId: input.instructorId ?? null,
          templateId: input.templateId ?? null,
        },
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.userId,
        projectId: project.id,
        action: "PROJECT_CREATED",
        entityType: "Project",
        entityId: project.id,
        description: `Tạo Project mới "${project.name}".`,
      },
    });

    const handles = [];
    for (const row of memberRows) {
      if (row.userId !== actor.userId) {
        const addedHandles = await recordProjectMemberAddedNotification(tx, {
          actorId: actor.userId,
          projectId: project.id,
          projectName: project.name,
          memberUserId: row.userId,
          projectRole: row.projectRole,
        });
        handles.push(...addedHandles);
      }
    }

    const found = await projectRepository.findById(project.id, tx);
    return { created: found, notificationHandles: handles };
  });

  await schedulePostCommitEmailDispatch(notificationHandles);

  if (!created) {
    throw notFoundError("Không tìm thấy Project sau khi khởi tạo.");
  }

  logger.info("Project created", {
    actorId: actor.userId,
    projectId: created.id,
    leaderId: effectiveLeaderId,
  });

  return mapProjectToDTO(created);
}

export async function updateProjectService(
  actor: AuthContext,
  projectId: string,
  rawInput: UpdateProjectInput
): Promise<ProjectDTO> {
  assertPermission(actor, PERMISSIONS.PROJECT_UPDATE);
  const validProjectId = parseProjectId(projectId);
  const input = updateProjectSchema.parse(rawInput);

  const updated = await prisma.$transaction(async (tx) => {
    await assertProjectLeaderAccess(actor, validProjectId, tx);
    await acquireProjectUpdateLock(tx, validProjectId);

    const current = await projectRepository.findById(validProjectId, tx);
    if (!current) {
      throw notFoundError("Không tìm thấy Project yêu cầu.");
    }

    if (current.status === ProjectStatus.ARCHIVED) {
      throw conflictError(
        "PROJECT_ARCHIVED",
        "Project đang ở trạng thái ARCHIVED và bị khóa chỉnh sửa thông tin."
      );
    }

    const nextStartDate = input.startDate ?? current.startDate;
    const nextEndDate = input.endDate ?? current.endDate;
    if (nextEndDate.getTime() < nextStartDate.getTime()) {
      throw badRequestError("Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.", [
        { field: "endDate", message: "Ngày kết thúc phải >= ngày bắt đầu." },
      ]);
    }

    if (input.templateId !== undefined && input.templateId !== null) {
      const template = await tx.projectTemplate.findUnique({
        where: { id: input.templateId },
        select: { id: true, isActive: true, name: true },
      });
      if (!template) {
        throw notFoundError("Không tìm thấy Project Template đã chọn.");
      }
      if (!template.isActive && input.templateId !== current.templateId) {
        throw badRequestError(`Template "${template.name}" hiện đang tạm ngưng.`);
      }
    }

    if (input.instructorId !== undefined && input.instructorId !== null) {
      if (input.instructorId === current.leaderId) {
        throw conflictError(
          "CONFLICT",
          "Project Leader hiện tại không thể đồng thời giữ vai trò Instructor của Project."
        );
      }
      await assertActiveUsersExist(tx, [input.instructorId], "instructorId");
    }

    const isInstructorChanging =
      input.instructorId !== undefined && input.instructorId !== current.instructorId;
    let existingNewInstructorMembership: { id: string; projectRole: ProjectMemberRole } | null =
      null;

    if (isInstructorChanging) {
      if (current.instructorId) {
        await taskAssignmentGuard.assertNoActiveProjectTasks(tx, current.id, current.instructorId);
      }
      if (input.instructorId) {
        existingNewInstructorMembership = await tx.projectMember.findFirst({
          where: {
            projectId: current.id,
            userId: input.instructorId,
            leftAt: null,
          },
          select: { id: true, projectRole: true },
        });
        if (
          existingNewInstructorMembership &&
          existingNewInstructorMembership.projectRole !== ProjectMemberRole.INSTRUCTOR
        ) {
          await taskAssignmentGuard.assertNoActiveProjectTasks(tx, current.id, input.instructorId);
        }
      }
    }

    const updateData: Prisma.ProjectUpdateInput = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description ?? null } : {}),
      ...(input.objectives !== undefined ? { objectives: input.objectives ?? null } : {}),
      ...(input.scope !== undefined ? { scope: input.scope ?? null } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
      ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
      ...(input.repositoryUrl !== undefined ? { repositoryUrl: input.repositoryUrl ?? null } : {}),
      ...(input.technologies !== undefined
        ? {
            technologies:
              input.technologies.length > 0
                ? (input.technologies as Prisma.InputJsonValue)
                : Prisma.DbNull,
          }
        : {}),
      ...(input.templateId !== undefined
        ? input.templateId
          ? { template: { connect: { id: input.templateId } } }
          : { template: { disconnect: true } }
        : {}),
      ...(input.instructorId !== undefined
        ? input.instructorId
          ? { instructor: { connect: { id: input.instructorId } } }
          : { instructor: { disconnect: true } }
        : {}),
    };

    const next = await tx.project.update({
      where: { id: current.id },
      data: updateData,
      select: projectDetailSelectSafe(),
    });

    if (isInstructorChanging) {
      const now = new Date();
      if (current.instructorId) {
        await tx.projectMember.updateMany({
          where: {
            projectId: current.id,
            userId: current.instructorId,
            projectRole: ProjectMemberRole.INSTRUCTOR,
            leftAt: null,
          },
          data: { leftAt: now },
        });
      }

      if (input.instructorId) {
        if (existingNewInstructorMembership) {
          if (existingNewInstructorMembership.projectRole !== ProjectMemberRole.INSTRUCTOR) {
            await tx.projectMember.update({
              where: { id: existingNewInstructorMembership.id },
              data: { projectRole: ProjectMemberRole.INSTRUCTOR },
            });
          }
        } else {
          await tx.projectMember.create({
            data: {
              projectId: current.id,
              userId: input.instructorId,
              projectRole: ProjectMemberRole.INSTRUCTOR,
            },
          });
        }
      }
    }

    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: "PROJECT_UPDATED",
        entityType: "Project",
        entityId: current.id,
        oldValue: {
          name: current.name,
          startDate: current.startDate.toISOString(),
          endDate: current.endDate.toISOString(),
          instructorId: current.instructorId,
          templateId: current.templateId,
        },
        newValue: {
          name: next.name,
          startDate: next.startDate.toISOString(),
          endDate: next.endDate.toISOString(),
          instructorId: next.instructorId,
          templateId: next.templateId,
        },
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.userId,
        projectId: current.id,
        action: "PROJECT_UPDATED",
        entityType: "Project",
        entityId: current.id,
        description: `Cập nhật thông tin Project "${next.name}".`,
      },
    });

    return projectRepository.findById(current.id, tx);
  });

  if (!updated) {
    throw notFoundError("Không tìm thấy Project sau khi cập nhật.");
  }

  logger.info("Project updated", { actorId: actor.userId, projectId: updated.id });
  return mapProjectToDTO(updated);
}

function projectDetailSelectSafe() {
  return {
    id: true,
    name: true,
    startDate: true,
    endDate: true,
    instructorId: true,
    templateId: true,
  } as const;
}

export async function activateProjectService(
  actor: AuthContext,
  projectId: string
): Promise<ProjectDTO> {
  assertPermission(actor, PERMISSIONS.PROJECT_ACTIVATE);
  const validProjectId = parseProjectId(projectId);

  try {
    const activated = await prisma.$transaction(async (tx) => {
      await assertProjectLeaderAccess(actor, validProjectId, tx);

      const current = await projectRepository.findById(validProjectId, tx);
      if (!current) {
        throw notFoundError("Không tìm thấy Project yêu cầu.");
      }

      if (current.status !== ProjectStatus.CREATED) {
        throw conflictError(
          "INVALID_STATUS_TRANSITION",
          current.status === ProjectStatus.ACTIVE
            ? "Project hiện đang ở trạng thái ACTIVE."
            : "Không thể kích hoạt trực tiếp Project đã ARCHIVED. Vui lòng nhờ Admin Restore."
        );
      }

      const conflicting = await projectRepository.findOtherActiveProject(current.id, tx);
      if (conflicting) {
        throw conflictError(
          "PROJECT_ALREADY_ACTIVE",
          `Workspace đang có Project ACTIVE ("${conflicting.name}"). Chỉ được phép tối đa một Project ACTIVE tại một thời điểm.`
        );
      }

      await tx.project.update({
        where: { id: current.id },
        data: { status: ProjectStatus.ACTIVE },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: "PROJECT_ACTIVATED",
          entityType: "Project",
          entityId: current.id,
          oldValue: { status: current.status },
          newValue: { status: ProjectStatus.ACTIVE },
        },
      });

      await tx.activityLog.create({
        data: {
          userId: actor.userId,
          projectId: current.id,
          action: "PROJECT_ACTIVATED",
          entityType: "Project",
          entityId: current.id,
          description: `Kích hoạt Project "${current.name}" sang trạng thái ACTIVE.`,
        },
      });

      return projectRepository.findById(current.id, tx);
    });

    if (!activated) {
      throw notFoundError("Không tìm thấy Project sau khi kích hoạt.");
    }

    logger.info("Project activated", { actorId: actor.userId, projectId: activated.id });
    return mapProjectToDTO(activated);
  } catch (error) {
    if (isPrismaUniqueViolation(error, ["Project_single_active_idx", "status"])) {
      throw conflictError(
        "PROJECT_ALREADY_ACTIVE",
        "Workspace đã có Project đang ACTIVE. Chỉ được phép tối đa một Project ACTIVE."
      );
    }
    throw error;
  }
}

export async function archiveProjectService(
  actor: AuthContext,
  projectId: string
): Promise<ProjectDTO> {
  assertPermission(actor, PERMISSIONS.PROJECT_ARCHIVE);
  const validProjectId = parseProjectId(projectId);

  const archived = await prisma.$transaction(async (tx) => {
    await assertProjectLeaderAccess(actor, validProjectId, tx);

    if (typeof (tx as { $queryRaw?: unknown }).$queryRaw === "function") {
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${validProjectId}::uuid FOR UPDATE`;
    }

    const current = await projectRepository.findById(validProjectId, tx);
    if (!current) {
      throw notFoundError("Không tìm thấy Project yêu cầu.");
    }

    if (current.status === ProjectStatus.ARCHIVED) {
      throw conflictError("INVALID_STATUS_TRANSITION", "Project đã ở trạng thái ARCHIVED.");
    }

    await tx.project.update({
      where: { id: current.id },
      data: {
        status: ProjectStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: "PROJECT_ARCHIVED",
        entityType: "Project",
        entityId: current.id,
        oldValue: { status: current.status, archivedAt: null },
        newValue: { status: ProjectStatus.ARCHIVED },
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.userId,
        projectId: current.id,
        action: "PROJECT_ARCHIVED",
        entityType: "Project",
        entityId: current.id,
        description: `Lưu trữ (Archive) Project "${current.name}".`,
      },
    });

    return projectRepository.findById(current.id, tx);
  });

  if (!archived) {
    throw notFoundError("Không tìm thấy Project sau khi lưu trữ.");
  }

  logger.info("Project archived", { actorId: actor.userId, projectId: archived.id });
  return mapProjectToDTO(archived);
}

export async function restoreProjectService(
  actor: AuthContext,
  projectId: string,
  rawInput: RestoreProjectInput
): Promise<ProjectDTO> {
  assertPermission(actor, PERMISSIONS.PROJECT_RESTORE);
  if (!isWorkspaceAdmin(actor)) {
    throw forbiddenError("Chỉ Admin mới có quyền khôi phục Project đã Archive (DEC-008).");
  }

  const validProjectId = parseProjectId(projectId);
  const { targetStatus } = restoreProjectSchema.parse(rawInput);

  try {
    const restored = await prisma.$transaction(async (tx) => {
      const current = await projectRepository.findById(validProjectId, tx);
      if (!current) {
        throw notFoundError("Không tìm thấy Project yêu cầu.");
      }

      if (current.status !== ProjectStatus.ARCHIVED) {
        throw conflictError(
          "PROJECT_NOT_ARCHIVED",
          "Chỉ có thể khôi phục Project đang ở trạng thái ARCHIVED."
        );
      }

      if (targetStatus === ProjectStatus.ACTIVE) {
        const conflicting = await projectRepository.findOtherActiveProject(current.id, tx);
        if (conflicting) {
          throw conflictError(
            "PROJECT_ALREADY_ACTIVE",
            `Không thể khôi phục sang ACTIVE vì Workspace đang có Project ACTIVE ("${conflicting.name}").`
          );
        }
      }

      await tx.project.update({
        where: { id: current.id },
        data: {
          status: targetStatus,
          archivedAt: null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: "PROJECT_RESTORED",
          entityType: "Project",
          entityId: current.id,
          oldValue: {
            status: ProjectStatus.ARCHIVED,
            archivedAt: current.archivedAt?.toISOString() ?? null,
          },
          newValue: {
            status: targetStatus,
            archivedAt: null,
          },
        },
      });

      await tx.activityLog.create({
        data: {
          userId: actor.userId,
          projectId: current.id,
          action: "PROJECT_RESTORED",
          entityType: "Project",
          entityId: current.id,
          description: `Khôi phục Project "${current.name}" về trạng thái ${targetStatus}.`,
        },
      });

      return projectRepository.findById(current.id, tx);
    });

    if (!restored) {
      throw notFoundError("Không tìm thấy Project sau khi khôi phục.");
    }

    logger.info("Project restored", {
      actorId: actor.userId,
      projectId: restored.id,
      targetStatus,
    });
    return mapProjectToDTO(restored);
  } catch (error) {
    if (isPrismaUniqueViolation(error, ["Project_single_active_idx", "status"])) {
      throw conflictError(
        "PROJECT_ALREADY_ACTIVE",
        "Không thể khôi phục sang ACTIVE vì Workspace đã có Project đang ACTIVE."
      );
    }
    throw error;
  }
}

export async function listProjectUserCandidatesService(
  actor: AuthContext,
  rawQuery: Record<string, unknown> = {}
): Promise<ProjectCandidateUserDTO[]> {
  const query = projectCandidateQuerySchema.parse(rawQuery);
  let excludeUserIds: string[] = [];

  if (query.projectId) {
    const canManageThisProject =
      hasPermission(actor, PERMISSIONS.PROJECT_UPDATE) ||
      hasPermission(actor, PERMISSIONS.PROJECT_MEMBER_MANAGE);
    if (!canManageThisProject) {
      throw forbiddenError("Bạn không có quyền truy cập danh sách ứng viên của Project.");
    }

    const project = await assertProjectLeaderAccess(actor, query.projectId);

    if (query.kind === "instructor") {
      assertPermission(actor, PERMISSIONS.PROJECT_UPDATE);
      excludeUserIds = [project.leaderId];
    } else if (query.kind === "leader") {
      assertPermission(actor, PERMISSIONS.PROJECT_MEMBER_MANAGE);
      excludeUserIds = [project.leaderId];
    } else {
      assertPermission(actor, PERMISSIONS.PROJECT_MEMBER_MANAGE);
      if (query.excludeCurrentMembers) {
        const activeMembers = await prisma.projectMember.findMany({
          where: { projectId: project.id, leftAt: null },
          select: { userId: true },
        });
        excludeUserIds = Array.from(
          new Set([project.leaderId, ...activeMembers.map((item) => item.userId)])
        );
      } else {
        excludeUserIds = [project.leaderId];
      }
    }
  } else {
    assertPermission(actor, PERMISSIONS.PROJECT_CREATE);
    if (query.kind === "leader" && !isWorkspaceAdmin(actor)) {
      throw forbiddenError("Chỉ Admin mới có quyền chọn Project Leader khác.");
    }
    if (query.kind === "member") {
      excludeUserIds = [actor.userId];
    }
  }

  return projectRepository.findProjectUserCandidates({
    kind: query.kind,
    search: query.q,
    excludeUserIds,
    take: query.limit,
  });
}
