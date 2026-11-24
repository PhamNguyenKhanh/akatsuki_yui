import "server-only";
import { Prisma, ProjectMemberRole, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RoleName } from "@/modules/authorization/constants";

export interface ProjectMemberDTO {
  id: string;
  projectId: string;
  userId: string;
  projectRole: ProjectMemberRole;
  joinedAt: string;
  leftAt: string | null;
  user: {
    id: string;
    fullName: string;
    email: string;
    status: UserStatus;
    workspaceRoles: RoleName[];
  };
}

export const projectMemberSelect = {
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
          role: {
            select: { name: true },
          },
        },
      },
    },
  },
} satisfies Prisma.ProjectMemberSelect;

type ProjectMemberRecord = Prisma.ProjectMemberGetPayload<{ select: typeof projectMemberSelect }>;

export function mapProjectMemberToDTO(record: ProjectMemberRecord): ProjectMemberDTO {
  return {
    id: record.id,
    projectId: record.projectId,
    userId: record.userId,
    projectRole: record.projectRole,
    joinedAt: record.joinedAt.toISOString(),
    leftAt: record.leftAt ? record.leftAt.toISOString() : null,
    user: {
      id: record.user.id,
      fullName: record.user.fullName,
      email: record.user.email,
      status: record.user.status,
      workspaceRoles: record.user.userRoles.map((ur) => ur.role.name as RoleName),
    },
  };
}

const ROLE_WEIGHT: Record<ProjectMemberRole, number> = {
  LEADER: 0,
  INSTRUCTOR: 1,
  REVIEWER: 2,
  MEMBER: 3,
};

export const projectMemberRepository = {
  async listByProject(
    projectId: string,
    options: { includeHistory?: boolean } = {},
    tx: Prisma.TransactionClient = prisma
  ): Promise<ProjectMemberDTO[]> {
    const rows = await tx.projectMember.findMany({
      where: {
        projectId,
        ...(options.includeHistory ? {} : { leftAt: null }),
      },
      select: projectMemberSelect,
      orderBy: [{ leftAt: "asc" }, { joinedAt: "asc" }],
    });

    const mapped = rows.map(mapProjectMemberToDTO);
    mapped.sort((a, b) => {
      if ((a.leftAt === null) !== (b.leftAt === null)) {
        return a.leftAt === null ? -1 : 1;
      }
      const roleDiff = ROLE_WEIGHT[a.projectRole] - ROLE_WEIGHT[b.projectRole];
      if (roleDiff !== 0) return roleDiff;
      return a.user.fullName.localeCompare(b.user.fullName, "vi");
    });

    return mapped;
  },

  async findActiveMembership(
    projectId: string,
    userId: string,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.projectMember.findFirst({
      where: {
        projectId,
        userId,
        leftAt: null,
      },
      select: projectMemberSelect,
    });
  },
};
