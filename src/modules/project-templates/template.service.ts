import "server-only";
import { Prisma } from "@prisma/client";
import { badRequestError, conflictError, notFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";
import { uuidSchema } from "@/lib/validations/common";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { assertAnyPermission, assertPermission } from "@/modules/authorization/policy.service";
import {
  mapTemplateToDTO,
  projectTemplateRepository,
  type ProjectTemplateDTO,
} from "@/modules/project-templates/template.repository";
import {
  createProjectTemplateSchema,
  projectTemplateListQuerySchema,
  updateProjectTemplateSchema,
  type CreateProjectTemplateInput,
  type ProjectTemplateListQueryInput,
  type UpdateProjectTemplateInput,
} from "@/modules/project-templates/template.schema";
import type { AuthContext } from "@/types/auth";

function parseTemplateId(templateId: string): string {
  const parsed = uuidSchema.safeParse(templateId);
  if (!parsed.success) {
    throw badRequestError("Template ID không đúng định dạng UUID.", [
      { field: "templateId", message: "Template ID không hợp lệ." },
    ]);
  }
  return parsed.data;
}

function assertTemplateManagePermission(actor: AuthContext) {
  assertAnyPermission(actor, [PERMISSIONS.PROJECT_CREATE, PERMISSIONS.ROLE_MANAGE]);
}

export async function listProjectTemplatesService(
  actor: AuthContext,
  rawQuery: Partial<ProjectTemplateListQueryInput> = {}
) {
  assertPermission(actor, PERMISSIONS.PROJECT_READ);
  const query = projectTemplateListQuerySchema.parse(rawQuery);
  return projectTemplateRepository.findManyPaginated(query);
}

export async function getProjectTemplateDetailService(
  actor: AuthContext,
  templateId: string
): Promise<ProjectTemplateDTO> {
  assertPermission(actor, PERMISSIONS.PROJECT_READ);
  const validId = parseTemplateId(templateId);
  const template = await projectTemplateRepository.findById(validId);
  if (!template) {
    throw notFoundError("Không tìm thấy Project Template.");
  }
  return mapTemplateToDTO(template);
}

export async function createProjectTemplateService(
  actor: AuthContext,
  rawInput: CreateProjectTemplateInput
): Promise<ProjectTemplateDTO> {
  assertTemplateManagePermission(actor);
  const input = createProjectTemplateSchema.parse(rawInput);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const record = await tx.projectTemplate.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          configuration:
            input.configuration === null
              ? Prisma.DbNull
              : (input.configuration as Prisma.InputJsonValue),
          isActive: input.isActive,
        },
        include: {
          _count: {
            select: { projects: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: "PROJECT_TEMPLATE_CREATED",
          entityType: "ProjectTemplate",
          entityId: record.id,
          oldValue: Prisma.DbNull,
          newValue: {
            name: record.name,
            isActive: record.isActive,
          },
        },
      });

      await tx.activityLog.create({
        data: {
          userId: actor.userId,
          action: "PROJECT_TEMPLATE_CREATED",
          entityType: "ProjectTemplate",
          entityId: record.id,
          description: `Tạo Project Template "${record.name}".`,
        },
      });

      return record;
    });

    logger.info("Project template created", {
      actorId: actor.userId,
      templateId: created.id,
      name: created.name,
    });

    return mapTemplateToDTO(created);
  } catch (error) {
    if (isPrismaUniqueViolation(error, ["ProjectTemplate_name_key", "name"])) {
      throw conflictError("CONFLICT", "Tên Project Template đã tồn tại.");
    }
    throw error;
  }
}

export async function updateProjectTemplateService(
  actor: AuthContext,
  templateId: string,
  rawInput: UpdateProjectTemplateInput
): Promise<ProjectTemplateDTO> {
  assertTemplateManagePermission(actor);
  const validId = parseTemplateId(templateId);
  const input = updateProjectTemplateSchema.parse(rawInput);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const current = await projectTemplateRepository.findById(validId, tx);
      if (!current) {
        throw notFoundError("Không tìm thấy Project Template.");
      }

      const data: Prisma.ProjectTemplateUpdateInput = {};
      if (input.name !== undefined) {
        data.name = input.name;
      }
      if (input.description !== undefined) {
        data.description = input.description ?? null;
      }
      if (input.configuration !== undefined) {
        data.configuration =
          input.configuration === null
            ? Prisma.DbNull
            : (input.configuration as Prisma.InputJsonValue);
      }
      if (input.isActive !== undefined) {
        data.isActive = input.isActive;
      }

      const next = await tx.projectTemplate.update({
        where: { id: current.id },
        data,
        include: {
          _count: {
            select: { projects: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: "PROJECT_TEMPLATE_UPDATED",
          entityType: "ProjectTemplate",
          entityId: next.id,
          oldValue: {
            name: current.name,
            description: current.description,
            isActive: current.isActive,
          },
          newValue: {
            name: next.name,
            description: next.description,
            isActive: next.isActive,
          },
        },
      });

      await tx.activityLog.create({
        data: {
          userId: actor.userId,
          action: "PROJECT_TEMPLATE_UPDATED",
          entityType: "ProjectTemplate",
          entityId: next.id,
          description: `Cập nhật Project Template "${next.name}".`,
        },
      });

      return next;
    });

    logger.info("Project template updated", {
      actorId: actor.userId,
      templateId: updated.id,
    });

    return mapTemplateToDTO(updated);
  } catch (error) {
    if (isPrismaUniqueViolation(error, ["ProjectTemplate_name_key", "name"])) {
      throw conflictError("CONFLICT", "Tên Project Template đã tồn tại.");
    }
    throw error;
  }
}

export async function deleteProjectTemplateService(
  actor: AuthContext,
  templateId: string
): Promise<{ id: string; deleted: true }> {
  assertTemplateManagePermission(actor);
  const validId = parseTemplateId(templateId);

  await prisma.$transaction(async (tx) => {
    const current = await projectTemplateRepository.findById(validId, tx);
    if (!current) {
      throw notFoundError("Không tìm thấy Project Template.");
    }

    if (current._count.projects > 0) {
      throw conflictError(
        "TEMPLATE_IN_USE",
        "Không thể xóa Template đang được sử dụng bởi Project. Vui lòng chuyển sang trạng thái tạm ngưng (Inactive)."
      );
    }

    await tx.projectTemplate.delete({
      where: { id: current.id },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: "PROJECT_TEMPLATE_DELETED",
        entityType: "ProjectTemplate",
        entityId: current.id,
        oldValue: {
          name: current.name,
          isActive: current.isActive,
        },
        newValue: Prisma.DbNull,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.userId,
        action: "PROJECT_TEMPLATE_DELETED",
        entityType: "ProjectTemplate",
        entityId: current.id,
        description: `Xóa Project Template "${current.name}".`,
      },
    });
  });

  logger.info("Project template deleted", {
    actorId: actor.userId,
    templateId: validId,
  });

  return { id: validId, deleted: true };
}
