import "server-only";
import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { assertPermission } from "@/modules/authorization/policy.service";
import {
  assertDocumentManageAccess,
  assertDocumentReadAccess,
  assertProjectDocumentManageAccess,
  assertSprintBelongsToDocumentProject,
  canActorManageProjectDocuments,
  lockProjectRowForDocumentMutation,
  parseDocumentId,
  parseDocumentInput,
} from "@/modules/documents/document.access";
import {
  documentRepository,
  documentSelect,
  mapDocumentToDTO,
} from "@/modules/documents/document.repository";
import type {
  AccessibleProjectOptionDTO,
  DocumentDTO,
  DocumentListResponseDTO,
} from "@/modules/documents/document.types";
import {
  createDocumentSchema,
  documentListQuerySchema,
  updateDocumentSchema,
  type CreateDocumentInput,
  type DocumentListQueryInput,
  type UpdateDocumentInput,
} from "@/modules/documents/document.validation";
import {
  assertProjectReadAccess,
  isWorkspaceAdmin,
  parseProjectId,
} from "@/modules/projects/project.access";
import type { AuthContext } from "@/types/auth";

export async function listProjectDocumentsService(
  actor: AuthContext,
  projectId: string,
  rawQuery: Partial<DocumentListQueryInput> = {}
): Promise<DocumentListResponseDTO> {
  assertPermission(actor, PERMISSIONS.DOCUMENT_READ);
  const validProjectId = parseProjectId(projectId);
  await assertProjectReadAccess(actor, validProjectId);

  const query = parseDocumentInput(
    documentListQuerySchema,
    rawQuery,
    "Tham số truy vấn danh sách tài liệu không hợp lệ."
  );

  return documentRepository.findManyPaginated(query, {
    adminViewAll: isWorkspaceAdmin(actor),
    userId: actor.userId,
    fixedProjectId: validProjectId,
  });
}

export async function listPinnedProjectDocumentsService(
  actor: AuthContext,
  projectId: string
): Promise<DocumentDTO[]> {
  assertPermission(actor, PERMISSIONS.DOCUMENT_READ);
  const validProjectId = parseProjectId(projectId);
  await assertProjectReadAccess(actor, validProjectId);
  return documentRepository.listPinnedByProject(validProjectId, 10);
}

export async function listGlobalDocumentsService(
  actor: AuthContext,
  rawQuery: Partial<DocumentListQueryInput> = {}
): Promise<DocumentListResponseDTO> {
  assertPermission(actor, PERMISSIONS.DOCUMENT_READ);
  const query = parseDocumentInput(
    documentListQuerySchema,
    rawQuery,
    "Tham số truy vấn danh sách tài liệu không hợp lệ."
  );

  if (query.projectId) {
    await assertProjectReadAccess(actor, query.projectId);
  }

  return documentRepository.findManyPaginated(query, {
    adminViewAll: isWorkspaceAdmin(actor),
    userId: actor.userId,
  });
}

export async function listAccessibleProjectsForDocumentsService(
  actor: AuthContext
): Promise<AccessibleProjectOptionDTO[]> {
  assertPermission(actor, PERMISSIONS.DOCUMENT_READ);
  const adminViewAll = isWorkspaceAdmin(actor);

  const projects = await prisma.project.findMany({
    where: adminViewAll
      ? {}
      : {
          OR: [
            { leaderId: actor.userId },
            { instructorId: actor.userId },
            {
              members: {
                some: {
                  userId: actor.userId,
                  leftAt: null,
                },
              },
            },
          ],
        },
    select: {
      id: true,
      name: true,
      status: true,
      leaderId: true,
      members: {
        where: {
          userId: actor.userId,
          leftAt: null,
        },
        select: {
          projectRole: true,
        },
      },
      sprints: {
        select: {
          id: true,
          name: true,
          status: true,
        },
        orderBy: [{ startDate: "desc" }],
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    status: project.status,
    canManageDocuments: canActorManageProjectDocuments(actor, project),
    sprints: project.sprints,
  }));
}

export async function getDocumentDetailService(
  actor: AuthContext,
  documentId: string
): Promise<DocumentDTO> {
  const validDocumentId = parseDocumentId(documentId);
  await assertDocumentReadAccess(actor, validDocumentId);

  const record = await documentRepository.findByIdActive(validDocumentId);
  if (!record) {
    throw new AppError({
      statusCode: 404,
      code: "DOCUMENT_NOT_FOUND",
      message: "Không tìm thấy tài liệu yêu cầu.",
    });
  }

  return mapDocumentToDTO(record);
}

export async function createDocumentService(
  actor: AuthContext,
  projectId: string,
  rawInput: CreateDocumentInput | unknown
): Promise<DocumentDTO> {
  const validProjectId = parseProjectId(projectId);
  const input = parseDocumentInput(
    createDocumentSchema,
    rawInput,
    "Dữ liệu tạo tài liệu không hợp lệ."
  );

  const created = await prisma.$transaction(async (tx) => {
    await assertProjectDocumentManageAccess(actor, validProjectId, tx);
    await lockProjectRowForDocumentMutation(validProjectId, tx);
    await assertSprintBelongsToDocumentProject(validProjectId, input.sprintId, tx);

    const record = await tx.document.create({
      data: {
        projectId: validProjectId,
        sprintId: input.sprintId ?? null,
        uploadedById: actor.userId,
        title: input.title,
        url: input.url,
        category: input.category,
        description: input.description ?? null,
        isPinned: input.isPinned ?? false,
      },
      select: documentSelect,
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: "DOCUMENT_CREATED",
        entityType: "Document",
        entityId: record.id,
        oldValue: Prisma.DbNull,
        newValue: {
          projectId: record.projectId,
          sprintId: record.sprintId,
          title: record.title,
          url: record.url,
          category: record.category,
        },
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.userId,
        projectId: record.projectId,
        action: "DOCUMENT_CREATED",
        entityType: "Document",
        entityId: record.id,
        description: `Đã thêm tài liệu "${record.title}" vào Project "${record.project.name}".`,
        metadata: {
          projectId: record.projectId,
          sprintId: record.sprintId,
          category: record.category,
        },
      },
    });

    return record;
  });

  return mapDocumentToDTO(created);
}

export async function updateDocumentService(
  actor: AuthContext,
  documentId: string,
  rawInput: UpdateDocumentInput | unknown
): Promise<DocumentDTO> {
  const validDocumentId = parseDocumentId(documentId);
  const input = parseDocumentInput(
    updateDocumentSchema,
    rawInput,
    "Dữ liệu cập nhật tài liệu không hợp lệ."
  );

  const updated = await prisma.$transaction(async (tx) => {
    const { document } = await assertDocumentManageAccess(actor, validDocumentId, tx);
    await lockProjectRowForDocumentMutation(document.projectId, tx);

    if (input.sprintId !== undefined) {
      await assertSprintBelongsToDocumentProject(document.projectId, input.sprintId, tx);
    }

    const record = await tx.document.update({
      where: { id: document.id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.url !== undefined ? { url: input.url } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.sprintId !== undefined ? { sprintId: input.sprintId } : {}),
        ...(input.isPinned !== undefined ? { isPinned: input.isPinned } : {}),
      },
      select: documentSelect,
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: "DOCUMENT_UPDATED",
        entityType: "Document",
        entityId: record.id,
        oldValue: {
          title: document.title,
          url: document.url,
          category: document.category,
          description: document.description,
          sprintId: document.sprintId,
        },
        newValue: {
          title: record.title,
          url: record.url,
          category: record.category,
          description: record.description,
          sprintId: record.sprintId,
        },
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.userId,
        projectId: record.projectId,
        action: "DOCUMENT_UPDATED",
        entityType: "Document",
        entityId: record.id,
        description: `Đã cập nhật tài liệu "${record.title}".`,
        metadata: {
          projectId: record.projectId,
          sprintId: record.sprintId,
          category: record.category,
        },
      },
    });

    return record;
  });

  return mapDocumentToDTO(updated);
}

export async function deleteDocumentService(
  actor: AuthContext,
  documentId: string
): Promise<{ id: string; projectId: string; deletedAt: string }> {
  const validDocumentId = parseDocumentId(documentId);

  return prisma.$transaction(async (tx) => {
    const { document } = await assertDocumentManageAccess(actor, validDocumentId, tx);
    await lockProjectRowForDocumentMutation(document.projectId, tx);

    const now = new Date();
    await tx.document.update({
      where: { id: document.id },
      data: {
        deletedAt: now,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: "DOCUMENT_SOFT_DELETED",
        entityType: "Document",
        entityId: document.id,
        oldValue: {
          title: document.title,
          url: document.url,
          category: document.category,
          deletedAt: null,
        },
        newValue: {
          deletedAt: now.toISOString(),
        },
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.userId,
        projectId: document.projectId,
        action: "DOCUMENT_SOFT_DELETED",
        entityType: "Document",
        entityId: document.id,
        description: `Đã xóa mềm tài liệu "${document.title}".`,
        metadata: {
          projectId: document.projectId,
          sprintId: document.sprintId,
          category: document.category,
        },
      },
    });

    return {
      id: document.id,
      projectId: document.projectId,
      deletedAt: now.toISOString(),
    };
  });
}
