import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ProjectTemplateListQueryInput } from "@/modules/project-templates/template.schema";

export interface ProjectTemplateDTO {
  id: string;
  name: string;
  description: string | null;
  configuration: Record<string, unknown> | null;
  isActive: boolean;
  projectCount: number;
  createdAt: string;
  updatedAt: string;
}

const templateInclude = {
  _count: {
    select: {
      projects: true,
    },
  },
} satisfies Prisma.ProjectTemplateInclude;

type TemplateRecord = Prisma.ProjectTemplateGetPayload<{ include: typeof templateInclude }>;

export function mapTemplateToDTO(record: TemplateRecord): ProjectTemplateDTO {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    configuration:
      record.configuration &&
      typeof record.configuration === "object" &&
      !Array.isArray(record.configuration)
        ? (record.configuration as Record<string, unknown>)
        : null,
    isActive: record.isActive,
    projectCount: record._count.projects,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export const projectTemplateRepository = {
  async findManyPaginated(query: ProjectTemplateListQueryInput) {
    const where: Prisma.ProjectTemplateWhereInput = {
      ...(query.activeOnly ? { isActive: true } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { description: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.projectTemplate.count({ where }),
      prisma.projectTemplate.findMany({
        where,
        include: templateInclude,
        orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      items: rows.map(mapTemplateToDTO),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  },

  async findActiveOptions() {
    const rows = await prisma.projectTemplate.findMany({
      where: { isActive: true },
      include: templateInclude,
      orderBy: { name: "asc" },
    });
    return rows.map(mapTemplateToDTO);
  },

  async findById(templateId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.projectTemplate.findUnique({
      where: { id: templateId },
      include: templateInclude,
    });
  },
};
