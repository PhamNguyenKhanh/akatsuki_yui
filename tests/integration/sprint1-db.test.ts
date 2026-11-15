import { randomUUID } from "node:crypto";
import { UserStatus } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { authenticateCredentials, registerAccount } from "@/modules/auth/auth.service";
import { PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import { loadTrustedAuthContext } from "@/modules/authorization/policy.service";
import {
  assignUserRoleService,
  changeMyPasswordService,
  getMyProfileService,
  getUserDetailService,
  listUsersService,
  updateAccountStatusService,
  updateMyProfileService,
} from "@/modules/users/user.service";

const runTag = randomUUID().slice(0, 8);
const createdEmails: string[] = [];
const createdUserIds: string[] = [];

function testEmail(prefix: string) {
  const email = `${prefix}.${runTag}@test.akatsuki.local`;
  createdEmails.push(email);
  return email;
}

describe("Sprint 1 PostgreSQL Integration Tests", () => {
  afterAll(async () => {
    if (createdUserIds.length > 0 || createdEmails.length > 0) {
      await prisma.notification.deleteMany({
        where: {
          OR: [{ userId: { in: createdUserIds } }, { actorId: { in: createdUserIds } }],
        },
      });
      await prisma.auditLog.deleteMany({
        where: {
          OR: [{ entityId: { in: createdUserIds } }, { actorId: { in: createdUserIds } }],
        },
      });
      await prisma.activityLog.deleteMany({
        where: {
          OR: [{ entityId: { in: createdUserIds } }, { userId: { in: createdUserIds } }],
        },
      });
      await prisma.user.deleteMany({
        where: {
          OR: [{ id: { in: createdUserIds } }, { email: { in: createdEmails } }],
        },
      });
    }
    await prisma.$disconnect();
  });

  it("verifies seeded roles, 27 permissions, and seeded active Admin account", async () => {
    const [roleCount, permCount, seedAdmin] = await Promise.all([
      prisma.role.count(),
      prisma.permission.count(),
      prisma.user.findFirst({
        where: process.env.SEED_ADMIN_EMAIL?.trim()
          ? { email: process.env.SEED_ADMIN_EMAIL.trim().toLowerCase() }
          : {
              status: UserStatus.ACTIVE,
              userRoles: { some: { role: { name: ROLES.ADMIN } } },
            },
        include: { userRoles: { include: { role: true } } },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    expect(roleCount).toBe(4);
    expect(permCount).toBe(27);
    expect(seedAdmin).not.toBeNull();
    expect(seedAdmin?.status).toBe(UserStatus.ACTIVE);
    expect(seedAdmin?.userRoles.some((ur) => ur.role.name === ROLES.ADMIN)).toBe(true);
  });

  it("executes full Register -> Pending Login Block -> Approve -> Active Login -> Profile -> Password Change -> Suspend/Activate lifecycle", async () => {
    const seedAdmin = await prisma.user.findFirstOrThrow({
      where: {
        status: UserStatus.ACTIVE,
        userRoles: { some: { role: { name: ROLES.ADMIN } } },
      },
      select: { id: true },
    });
    const adminActor = await loadTrustedAuthContext(seedAdmin.id);

    // 1. Register new member -> PENDING + MEMBER + USER_REGISTERED ActivityLog
    const memberEmail = testEmail("member");
    const registered = await registerAccount({
      fullName: "Integration Member",
      email: memberEmail,
      password: "MemberPass@123",
      confirmPassword: "MemberPass@123",
    });
    createdUserIds.push(registered.id);

    expect(registered.status).toBe(UserStatus.PENDING);
    expect(registered.roles).toEqual([ROLES.MEMBER]);
    expect("passwordHash" in registered).toBe(false);

    // 2. Duplicate registration blocked
    await expect(
      registerAccount({
        fullName: "Duplicate Member",
        email: memberEmail,
        password: "MemberPass@123",
        confirmPassword: "MemberPass@123",
      })
    ).rejects.toMatchObject({ statusCode: 409, code: "EMAIL_ALREADY_EXISTS" });

    // 3. PENDING user blocked on login
    await expect(
      authenticateCredentials({ email: memberEmail, password: "MemberPass@123" })
    ).rejects.toMatchObject({ statusCode: 403, code: "ACCOUNT_PENDING" });

    // 4. Wrong password returns generic INVALID_CREDENTIALS (not status disclosure)
    await expect(
      authenticateCredentials({ email: memberEmail, password: "WrongPassword@999" })
    ).rejects.toMatchObject({ statusCode: 401, code: "INVALID_CREDENTIALS" });

    // 5. Admin lists users and filters PENDING
    const pendingList = await listUsersService(adminActor, {
      search: memberEmail,
      status: UserStatus.PENDING,
    });
    expect(pendingList.items.some((u) => u.id === registered.id)).toBe(true);

    // 6. Admin approves user -> ACTIVE + AuditLog
    const approved = await updateAccountStatusService(adminActor, registered.id, {
      action: "APPROVE",
    });
    expect(approved.status).toBe(UserStatus.ACTIVE);
    expect(approved.approvedBy?.id).toBe(adminActor.userId);

    // 7. Approved user logs in & loads AuthContext
    const loggedIn = await authenticateCredentials({
      email: memberEmail,
      password: "MemberPass@123",
    });
    expect(loggedIn.id).toBe(registered.id);
    const memberActor = await loadTrustedAuthContext(registered.id);
    expect(memberActor.roles).toEqual([ROLES.MEMBER]);

    // 8. Member cannot access Admin user list or approve others
    await expect(listUsersService(memberActor, {})).rejects.toMatchObject({ statusCode: 403 });
    await expect(getUserDetailService(memberActor, adminActor.userId)).rejects.toMatchObject({
      statusCode: 403,
    });
    const ownProfile = await getMyProfileService(memberActor);
    expect(ownProfile.email).toBe(memberEmail);

    // 9. DEC-018 Profile update (fullName only) + Password change
    const updatedProfile = await updateMyProfileService(memberActor, {
      fullName: "Updated Integration Member",
    });
    expect(updatedProfile.fullName).toBe("Updated Integration Member");
    await expect(
      updateMyProfileService(memberActor, { fullName: "Hack", role: ROLES.ADMIN })
    ).rejects.toThrow();

    await changeMyPasswordService(memberActor, {
      currentPassword: "MemberPass@123",
      newPassword: "MemberNew@456",
      confirmNewPassword: "MemberNew@456",
    });

    const loginWithNewPwd = await authenticateCredentials({
      email: memberEmail,
      password: "MemberNew@456",
    });
    expect(loginWithNewPwd.id).toBe(registered.id);

    // 10. Suspend revokes server AuthContext immediately & blocks login; Activate restores
    const suspended = await updateAccountStatusService(adminActor, registered.id, {
      action: "SUSPEND",
    });
    expect(suspended.status).toBe(UserStatus.SUSPENDED);
    await expect(loadTrustedAuthContext(registered.id)).rejects.toMatchObject({
      statusCode: 403,
      code: "ACCOUNT_NOT_ACTIVE",
    });
    await expect(
      authenticateCredentials({ email: memberEmail, password: "MemberNew@456" })
    ).rejects.toMatchObject({ statusCode: 403, code: "ACCOUNT_SUSPENDED" });

    const reactivated = await updateAccountStatusService(adminActor, registered.id, {
      action: "ACTIVATE",
    });
    expect(reactivated.status).toBe(UserStatus.ACTIVE);

    // 11. Role reassignment -> LEADER grants PROJECT_CREATE immediately on server (and still lacks ADMIN-only ACCOUNT_READ)
    const leaderUser = await assignUserRoleService(adminActor, registered.id, {
      roleName: ROLES.LEADER,
    });
    expect(leaderUser.roles).toEqual([ROLES.LEADER]);
    const refreshedLeaderCtx = await loadTrustedAuthContext(registered.id);
    expect(refreshedLeaderCtx.permissions).toContain(PERMISSIONS.PROJECT_CREATE);
    expect(refreshedLeaderCtx.permissions).not.toContain(PERMISSIONS.ACCOUNT_READ);
  });

  it("enforces Last Admin Protection and REJECT transition rules in real PostgreSQL", async () => {
    const activeAdmins = await prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        userRoles: { some: { role: { name: ROLES.ADMIN } } },
      },
      select: { id: true },
    });
    expect(activeAdmins.length).toBeGreaterThanOrEqual(1);

    const soleOrFirstAdminCtx = await loadTrustedAuthContext(activeAdmins[0].id);
    if (activeAdmins.length === 1) {
      await expect(
        updateAccountStatusService(soleOrFirstAdminCtx, activeAdmins[0].id, {
          action: "SUSPEND",
        })
      ).rejects.toMatchObject({ statusCode: 409, code: "LAST_ADMIN_PROTECTION" });

      await expect(
        assignUserRoleService(soleOrFirstAdminCtx, activeAdmins[0].id, {
          roleName: ROLES.MEMBER,
        })
      ).rejects.toMatchObject({ statusCode: 409, code: "LAST_ADMIN_PROTECTION" });
    }

    const rejectedEmail = testEmail("rejected");
    const pendingUser = await registerAccount({
      fullName: "Rejected Candidate",
      email: rejectedEmail,
      password: "Password@123",
      confirmPassword: "Password@123",
    });
    createdUserIds.push(pendingUser.id);

    const rejected = await updateAccountStatusService(soleOrFirstAdminCtx, pendingUser.id, {
      action: "REJECT",
    });
    expect(rejected.status).toBe(UserStatus.REJECTED);

    await expect(
      authenticateCredentials({ email: rejectedEmail, password: "Password@123" })
    ).rejects.toMatchObject({ statusCode: 403, code: "ACCOUNT_REJECTED" });

    // AuditLogs must exist for target actions
    const logs = await prisma.auditLog.findMany({
      where: { entityType: "User", entityId: pendingUser.id },
    });
    expect(logs.some((log) => log.action === "ACCOUNT_REJECT")).toBe(true);
  });
});
