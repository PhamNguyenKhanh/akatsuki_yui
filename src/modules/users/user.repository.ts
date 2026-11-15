import "server-only";
import { Prisma, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RoleName } from "@/modules/authorization/constants";
import type { UserListQueryInput } from "@/modules/users/user.schema";
import type { SafeUserDTO } from "@/types/auth";

export const safeUserSelect = {
  id: true,
  email: true,
  fullName: true,
  avatarUrl: true,
  status: true,
  approvedAt: true,
  approvedBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  userRoles: {
    select: {
      role: {
        select: {
          name: true,
        },
      },
    },
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

type SafeUserRecord = Prisma.UserGetPayload<{ select: typeof safeUserSelect }>;

export function mapUserToSafeDTO(user: SafeUserRecord): SafeUserDTO {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    status: user.status,
    roles: user.userRoles.map((ur) => ur.role.name as RoleName),
    approvedAt: user.approvedAt ? user.approvedAt.toISOString() : null,
    approvedBy: user.approvedBy,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export const userRepository = {
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: safeUserSelect,
    });
  },

  async findAuthCredentialsByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: {
        id: true,
        email: true,
        fullName: true,
        passwordHash: true,
        status: true,
        tokenVersion: true,
        userRoles: {
          select: {
            role: {
              select: { name: true },
            },
          },
        },
      },
    });
  },

  async findPasswordHashById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
        status: true,
      },
    });
  },

  async findSafeById(userId: string): Promise<SafeUserDTO | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: safeUserSelect,
    });
    return user ? mapUserToSafeDTO(user) : null;
  },

  async findManyPaginated(query: UserListQueryInput) {
    const where: Prisma.UserWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.role
        ? {
            userRoles: {
              some: {
                role: { name: query.role },
              },
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.UserOrderByWithRelationInput = {
      [query.sortBy]: query.sortOrder,
    };

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: safeUserSelect,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      items: items.map(mapUserToSafeDTO),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  },

  async countOtherActiveAdmins(excludeUserId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.user.count({
      where: {
        id: { not: excludeUserId },
        status: UserStatus.ACTIVE,
        userRoles: {
          some: {
            role: { name: "ADMIN" },
          },
        },
      },
    });
  },
};
