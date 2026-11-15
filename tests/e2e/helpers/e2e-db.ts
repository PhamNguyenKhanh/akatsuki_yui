import { config as loadDotenv } from "dotenv";
import { PrismaClient, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { validateTestDatabaseIsolation } from "../../lib/test-db-isolation";
import { ROLES, type RoleName } from "../../../src/modules/authorization/constants";
import { runSafeSeed } from "../../../prisma/seed-helpers";

loadDotenv({ quiet: true });

export function createIsolatedE2EPrisma(): PrismaClient {
  const testDbUrl = validateTestDatabaseIsolation(process.env);
  return new PrismaClient({
    datasources: {
      db: {
        url: testDbUrl,
      },
    },
  });
}

export async function ensureE2ESeedAndUser(
  prisma: PrismaClient,
  options: {
    email: string;
    password: string;
    fullName: string;
    role: RoleName;
    status?: UserStatus;
  }
) {
  await runSafeSeed(prisma, {});
  const role = await prisma.role.findUniqueOrThrow({ where: { name: options.role } });
  const normalizedEmail = options.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(options.password, 8);
  const status = options.status ?? UserStatus.ACTIVE;

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      passwordHash,
      fullName: options.fullName,
      status,
      ...(status === UserStatus.ACTIVE ? { approvedAt: new Date() } : {}),
    },
    create: {
      email: normalizedEmail,
      passwordHash,
      fullName: options.fullName,
      status,
      ...(status === UserStatus.ACTIVE ? { approvedAt: new Date() } : {}),
    },
  });

  await prisma.userRole.deleteMany({ where: { userId: user.id } });
  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: role.id,
    },
  });

  return user;
}

export async function cleanupE2EByRunTag(
  prisma: PrismaClient,
  runTag: string,
  userIds: string[],
  projectIds: string[]
) {
  if (projectIds.length > 0) {
    await prisma.notification.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.activityLog.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  }
  await prisma.rateLimitEvent.deleteMany({
    where: { scope: { contains: runTag } },
  });
  if (userIds.length > 0) {
    await prisma.notification.deleteMany({
      where: { OR: [{ userId: { in: userIds } }, { actorId: { in: userIds } }] },
    });
    await prisma.auditLog.deleteMany({
      where: { OR: [{ actorId: { in: userIds } }, { entityId: { in: userIds } }] },
    });
    await prisma.activityLog.deleteMany({
      where: { OR: [{ userId: { in: userIds } }, { entityId: { in: userIds } }] },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  void ROLES;
}
