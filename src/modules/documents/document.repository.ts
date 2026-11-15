import "server-only";
import { type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DocumentDTO, DocumentListResponseDTO } from "@/modules/documents/document.types";
import type { ParsedDocumentListQuery } from "@/modules/documents/document.validation";

export const documentSelect = {
  id: true,
  projectId: true,
  sprintId: true,
  uploadedById: true,
  title: true,
  url: true,
  category: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  project: {
    select: {
      id: true,
      name: true,
      status: true,
      leaderId: true,
    },
  },
  sprint: {
    select: {
      id: true,
      name: true,
      status: true,
    },
  },
  uploadedBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
      avatarUrl: true,
    },
  },
} satisfies Prisma.DocumentSelect;

export type DocumentRecord = Prisma.DocumentGetPayload<{
  select: typeof documentSelect;
}>;

export function mapDocumentToDTO(record: DocumentRecord): DocumentDTO {
  return {
    id: record.id,
    projectId: record.projectId,
    sprintId: record.sprintId,
    uploadedById: record.uploadedById,
    title: record.title,
    url: record.url,
    category: record.category,
    description: record.description,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deletedAt: record.deletedAt ? record.deletedAt.toISOString() : null,
    project: {
      id: record.project.id,
      name: record.project.name,
      status: record.project.status,
      leaderId: record.project.leaderId,
    },
    sprint: record.sprint
      ? {
          id: record.sprint.id,
          name: record.sprint.name,
          status: record.sprint.status,
        }
      : null,
    uploadedBy: {
      id: record.uploadedBy.id,
      fullName: record.uploadedBy.fullName,
      email: record.uploadedBy.email,
      avatarUrl: record.uploadedBy.avatarUrl,
    },
  };
}

export const documentRepository = {
  async findByIdActive(
    documentId: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<DocumentRecord | null> {
    return tx.document.findFirst({
      where: {
        id: documentId,
        deletedAt: null,
      },
      select: documentSelect,
    });
  },

  async findManyPaginated(
    query: ParsedDocumentListQuery,
    scope: {
      adminViewAll: boolean;
      userId: string;
      fixedProjectId?: string;
    },
    tx: Prisma.TransactionClient = prisma
  ): Promise<DocumentListResponseDTO> {
    const andConditions: Prisma.DocumentWhereInput[] = [
      {
        deletedAt: null,
      },
    ];

    const effectiveProjectId = scope.fixedProjectId ?? query.projectId;
    if (effectiveProjectId) {
      andConditions.push({ projectId: effectiveProjectId });
    } else if (!scope.adminViewAll) {
      andConditions.push({
        project: {
          OR: [
            { leaderId: scope.userId },
            { instructorId: scope.userId },
            {
              members: {
                some: {
                  userId: scope.userId,
                  leftAt: null,
                },
              },
            },
          ],
        },
      });
    }

    if (query.category) {
      andConditions.push({ category: query.category });
    }

    if (query.sprintId === "NONE") {
      andConditions.push({ sprintId: null });
    } else if (query.sprintId) {
      andConditions.push({ sprintId: query.sprintId });
    }

    if (query.search) {
      andConditions.push({
        OR: [
          { title: { contains: query.search, mode: "insensitive" } },
          { description: { contains: query.search, mode: "insensitive" } },
          { url: { contains: query.search, mode: "insensitive" } },
        ],
      });
    }

    const where: Prisma.DocumentWhereInput = { AND: andConditions };
    const skip = (query.page - 1) * query.pageSize;

    const [records, totalItems] = await Promise.all([
      tx.document.findMany({
        where,
        select: documentSelect,
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: query.pageSize,
      }),
      tx.document.count({ where }),
    ]);

    return {
      items: records.map(mapDocumentToDTO),
      totalItems,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(totalItems / query.pageSize)),
    };
  },
};
