import "server-only";
import { Prisma, ProjectStatus, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sanitizeExternalHttpUrl } from "@/lib/safe-url";
import { ROLES, type RoleName } from "@/modules/authorization/constants";
import type {
  ProjectCandidateKind,
  ProjectListQueryInput,
} from "@/modules/projects/project.schema";

export interface ProjectUserSummaryDTO {
  id: string;
  fullName: string;
  email: string;
  status: UserStatus;
}

export interface ProjectDTO {
  id: string;
  name: string;
  description: string | null;
  objectives: string | null;
  scope: string | null;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
  repositoryUrl: string | null;
  technologies: string[];
  templateId: string | null;
  template: {
    id: string;
    name: string;
    isActive: boolean;
  } | null;
  leaderId: string;
  leader: ProjectUserSummaryDTO;
  instructorId: string | null;
  instructor: ProjectUserSummaryDTO | null;
  createdById: string;
  createdBy: ProjectUserSummaryDTO;
  activeMemberCount: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectCandidateUserDTO {
  id: string;
  fullName: string;
}

const userSummarySelect = {
  id: true,
  fullName: true,
  email: true,
  status: true,
} satisfies Prisma.UserSelect;

export const projectDetailSelect = {
  id: true,
  name: true,
  description: true,
  objectives: true,
  scope: true,
  startDate: true,
  endDate: true,
  status: true,
  repositoryUrl: true,
  technologies: true,
  templateId: true,
  template: {
    select: {
      id: true,
      name: true,
      isActive: true,
    },
  },
  leaderId: true,
  leader: {
    select: userSummarySelect,
  },
  instructorId: true,
  instructor: {
    select: userSummarySelect,
  },
  createdById: true,
  createdBy: {
    select: userSummarySelect,
  },
  _count: {
    select: {
      members: {
        where: { leftAt: null },
      },
    },
  },
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProjectSelect;

type ProjectRecord = Prisma.ProjectGetPayload<{ select: typeof projectDetailSelect }>;

export function mapProjectToDTO(record: ProjectRecord): ProjectDTO {
  const technologies = Array.isArray(record.technologies)
    ? record.technologies.filter((item): item is string => typeof item === "string")
    : [];

  return {
    id: record.id,
    name: record.name,
    description: record.description,
    objectives: record.objectives,
    scope: record.scope,
    startDate: record.startDate.toISOString(),
    endDate: record.endDate.toISOString(),
    status: record.status,
    repositoryUrl: sanitizeExternalHttpUrl(record.repositoryUrl),
    technologies,
    templateId: record.templateId,
    template: record.template,
    leaderId: record.leaderId,
    leader: record.leader,
    instructorId: record.instructorId,
    instructor: record.instructor,
    createdById: record.createdById,
    createdBy: record.createdBy,
    activeMemberCount: record._count.members,
    archivedAt: record.archivedAt ? record.archivedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export const projectRepository = {
  async findManyPaginated(
    query: ProjectListQueryInput,
    scope: { adminViewAll: boolean; userId: string }
  ) {
    const scopeWhere: Prisma.ProjectWhereInput = scope.adminViewAll
      ? {}
      : {
          OR: [
            { leaderId: scope.userId },
            { instructorId: scope.userId },
            { members: { some: { userId: scope.userId, leftAt: null } } },
          ],
        };

    const filterWhere: Prisma.ProjectWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { description: { contains: query.search, mode: "insensitive" } },
              { objectives: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const where: Prisma.ProjectWhereInput = {
      AND: [scopeWhere, filterWhere],
    };

    const [total, rows] = await Promise.all([
      prisma.project.count({ where }),
      prisma.project.findMany({
        where,
        select: projectDetailSelect,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      items: rows.map(mapProjectToDTO),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  },

  async findById(projectId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.project.findUnique({
      where: { id: projectId },
      select: projectDetailSelect,
    });
  },

  async findOtherActiveProject(excludeProjectId?: string, tx: Prisma.TransactionClient = prisma) {
    return tx.project.findFirst({
      where: {
        status: ProjectStatus.ACTIVE,
        ...(excludeProjectId ? { id: { not: excludeProjectId } } : {}),
      },
      select: { id: true, name: true },
    });
  },

  async findProjectUserCandidates(params: {
    kind: ProjectCandidateKind;
    search?: string;
    excludeUserIds?: string[];
    take?: number;
  }): Promise<ProjectCandidateUserDTO[]> {
    const limit = Math.max(1, Math.min(50, params.take ?? 25));

    const roleFilter: Prisma.UserWhereInput =
      params.kind === "instructor"
        ? {
            userRoles: {
              some: {
                role: { name: ROLES.INSTRUCTOR },
              },
            },
          }
        : params.kind === "leader"
          ? {
              userRoles: {
                some: {
                  role: { name: { in: [ROLES.LEADER, ROLES.ADMIN] } },
                },
              },
            }
          : {};

    return prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        ...roleFilter,
        ...(params.excludeUserIds && params.excludeUserIds.length > 0
          ? { id: { notIn: params.excludeUserIds } }
          : {}),
        ...(params.search
          ? {
              fullName: {
                contains: params.search,
                mode: "insensitive",
              },
            }
          : {}),
      },
      select: {
        id: true,
        fullName: true,
      },
      orderBy: { fullName: "asc" },
      take: limit,
    });
  },

  async getDashboardProjectStats(scope: { adminViewAll: boolean; userId: string }) {
    const scopeWhere: Prisma.ProjectWhereInput = scope.adminViewAll
      ? {}
      : {
          OR: [
            { leaderId: scope.userId },
            { instructorId: scope.userId },
            { members: { some: { userId: scope.userId, leftAt: null } } },
          ],
        };

    const [total, createdCount, activeProject, archivedCount] = await Promise.all([
      prisma.project.count({ where: scopeWhere }),
      prisma.project.count({ where: { AND: [scopeWhere, { status: ProjectStatus.CREATED }] } }),
      prisma.project.findFirst({
        where: { AND: [scopeWhere, { status: ProjectStatus.ACTIVE }] },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          leader: { select: { fullName: true } },
          _count: { select: { members: { where: { leftAt: null } } } },
        },
      }),
      prisma.project.count({ where: { AND: [scopeWhere, { status: ProjectStatus.ARCHIVED }] } }),
    ]);

    return {
      total,
      createdCount,
      activeCount: activeProject ? 1 : 0,
      archivedCount,
      activeProject: activeProject
        ? {
            id: activeProject.id,
            name: activeProject.name,
            startDate: activeProject.startDate.toISOString(),
            endDate: activeProject.endDate.toISOString(),
            leaderName: activeProject.leader.fullName,
            activeMemberCount: activeProject._count.members,
          }
        : null,
    };
  },

  isAdminRole(roles: RoleName[]) {
    return roles.includes(ROLES.ADMIN);
  },
};
