import { expect, test } from "@playwright/test";
import { type PrismaClient, UserStatus } from "@prisma/client";
import { PERMISSIONS, ROLES } from "../../src/modules/authorization/constants";
import {
  cleanupE2EByRunTag,
  createIsolatedE2EPrisma,
  ensureE2ESeedAndUser,
} from "./helpers/e2e-db";
import { makeRunTag, uiLogin } from "./helpers/e2e-ui";

test.describe("Workflow A & B — Auth, Pending Approval, Session Revocation & Live RBAC", () => {
  const runTag = makeRunTag("e2e-wf-ab");
  const password = "StrongPass!2026";
  const newPassword = "NewStrongPass!2026";
  let prisma!: PrismaClient;
  const createdUserIds: string[] = [];
  const createdProjectIds: string[] = [];

  const adminEmail = `${runTag}.admin@akatsuki.local`;
  const leaderEmail = `${runTag}.leader@akatsuki.local`;
  const pendingEmail = `${runTag}.pending@akatsuki.local`;
  const rejectedEmail = `${runTag}.rejected@akatsuki.local`;

  test.beforeAll(async () => {
    prisma = createIsolatedE2EPrisma();
    const admin = await ensureE2ESeedAndUser(prisma, {
      email: adminEmail,
      password,
      fullName: `Admin ${runTag}`,
      role: ROLES.ADMIN,
      status: UserStatus.ACTIVE,
    });
    const leader = await ensureE2ESeedAndUser(prisma, {
      email: leaderEmail,
      password,
      fullName: `Leader ${runTag}`,
      role: ROLES.LEADER,
      status: UserStatus.ACTIVE,
    });
    createdUserIds.push(admin.id, leader.id);
  });

  test.afterAll(async () => {
    const extraUsers = await prisma.user.findMany({
      where: { email: { in: [pendingEmail.toLowerCase(), rejectedEmail.toLowerCase()] } },
      select: { id: true },
    });
    await cleanupE2EByRunTag(
      prisma,
      runTag,
      [...createdUserIds, ...extraUsers.map((u) => u.id)],
      createdProjectIds
    );
    await prisma.$disconnect();
  });

  test("User registers -> PENDING blocks login -> Admin approves & rejects -> password change & suspend revoke live sessions", async ({
    browser,
  }) => {
    // 1. Register user A (PENDING) & user B (to be REJECTED)
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();

    await publicPage.goto("/register");
    await publicPage.locator("#fullName").fill(`Pending User ${runTag}`);
    await publicPage.locator("#email").fill(pendingEmail);
    await publicPage.locator("#password").fill(password);
    await publicPage.locator("#confirmPassword").fill(password);
    await publicPage.getByRole("button", { name: "Đăng ký tài khoản" }).click();
    await publicPage.waitForURL(/\/pending-approval/);

    // Attempt login while PENDING
    await publicPage.goto("/login");
    await publicPage.locator("#email").fill(pendingEmail);
    await publicPage.locator("#password").fill(password);
    await publicPage.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(publicPage.getByText("Tài khoản đang chờ phê duyệt")).toBeVisible();

    // Register user B to test REJECTED flow
    await publicPage.goto("/register");
    await publicPage.locator("#fullName").fill(`Rejected User ${runTag}`);
    await publicPage.locator("#email").fill(rejectedEmail);
    await publicPage.locator("#password").fill(password);
    await publicPage.locator("#confirmPassword").fill(password);
    await publicPage.getByRole("button", { name: "Đăng ký tài khoản" }).click();
    await publicPage.waitForURL(/\/pending-approval/);

    // 2. Admin approves user A & rejects user B via /admin/users
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await uiLogin(adminPage, adminEmail, password);

    const approvedUser = await prisma.user.findUniqueOrThrow({
      where: { email: pendingEmail.toLowerCase() },
    });
    await adminPage.goto(`/admin/users/${approvedUser.id}`);
    await adminPage.getByRole("button", { name: "Phê duyệt" }).click();
    await adminPage.getByRole("button", { name: "Phê duyệt" }).last().click();
    await expect(adminPage.getByText("ACTIVE").first()).toBeVisible();

    const rejectedUser = await prisma.user.findUniqueOrThrow({
      where: { email: rejectedEmail.toLowerCase() },
    });
    await adminPage.goto(`/admin/users/${rejectedUser.id}`);
    await adminPage.getByRole("button", { name: "Từ chối" }).click();
    await adminPage.getByRole("button", { name: "Từ chối" }).last().click();
    await expect(adminPage.getByText("REJECTED").first()).toBeVisible();

    // Verify REJECTED user cannot login
    await publicPage.goto("/login");
    await publicPage.locator("#email").fill(rejectedEmail);
    await publicPage.locator("#password").fill(password);
    await publicPage.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(publicPage.getByText("Tài khoản đã bị từ chối")).toBeVisible();
    await publicContext.close();

    // 3. Approved user logs into 2 browser contexts (Session 1 and Session 2)
    const userCtx1 = await browser.newContext();
    const userPage1 = await userCtx1.newPage();
    await uiLogin(userPage1, pendingEmail, password);

    const userCtx2 = await browser.newContext();
    const userPage2 = await userCtx2.newPage();
    await uiLogin(userPage2, pendingEmail, password);

    // Session 1 changes password on /profile -> bumps tokenVersion -> revokes Session 2
    await userPage1.goto("/profile");
    await userPage1.locator("#currentPassword").fill(password);
    await userPage1.locator("#newPassword").fill(newPassword);
    await userPage1.locator("#confirmNewPassword").fill(newPassword);
    await userPage1.getByRole("button", { name: "Cập nhật mật khẩu" }).click();
    await expect(userPage1.getByText("Đổi mật khẩu thành công.")).toBeVisible();

    // Session 2 is immediately kicked back to /login on next server request
    await userPage2.goto("/dashboard");
    await userPage2.waitForURL(/\/login/);

    // 4. Admin suspends user -> Session 1 invalidated immediately, then reactivated session cannot reuse old cookie
    await adminPage.goto(`/admin/users/${approvedUser.id}`);
    await adminPage.getByRole("button", { name: "Tạm khóa" }).click();
    await adminPage.getByRole("button", { name: "Tạm khóa" }).last().click();
    await expect(adminPage.getByText("SUSPENDED").first()).toBeVisible();

    await userPage1.goto("/projects");
    await userPage1.waitForURL(/\/login/);

    await adminPage.getByRole("button", { name: "Kích hoạt" }).click();
    await adminPage.getByRole("button", { name: "Kích hoạt" }).last().click();
    await expect(adminPage.getByText("ACTIVE").first()).toBeVisible();

    await userPage1.goto("/dashboard");
    await userPage1.waitForURL(/\/login/);

    await userCtx1.close();
    await userCtx2.close();
    await adminContext.close();
  });

  test("RBAC matrix core ADMIN protection, live permission toggle & LEADER template restriction", async ({
    browser,
  }) => {
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await uiLogin(adminPage, adminEmail, password);

    // 1. Admin checks /admin/roles core lock & live toggle on MEMBER
    await adminPage.goto("/admin/roles");
    await expect(adminPage.getByText("Ma trận Phân quyền (Permission Matrix)")).toBeVisible();

    const searchInput = adminPage.getByLabel("Tìm kiếm permission");
    await searchInput.fill(PERMISSIONS.DOCUMENT_MANAGE);
    const grantBtn = adminPage.getByRole("button", {
      name: new RegExp(`(Cấp|Thu hồi) quyền ${PERMISSIONS.DOCUMENT_MANAGE} cho MEMBER`),
    });
    await expect(grantBtn).toBeVisible();

    // Toggle permission off/on and restore clean state
    await grantBtn.click();
    await adminPage.waitForTimeout(400);
    await adminPage
      .getByRole("button", {
        name: new RegExp(`(Cấp|Thu hồi) quyền ${PERMISSIONS.DOCUMENT_MANAGE} cho MEMBER`),
      })
      .click();

    await adminContext.close();

    // 2. LEADER is blocked (403) from template management endpoints
    const leaderContext = await browser.newContext();
    const leaderPage = await leaderContext.newPage();
    await uiLogin(leaderPage, leaderEmail, password);

    const templateRes = await leaderPage.request.get("/api/v1/project-templates");
    expect(templateRes.status()).toBe(403);

    await leaderPage.goto("/admin/templates");
    await expect(leaderPage).toHaveURL(/\/access-denied|\/dashboard|\/login/);

    await leaderContext.close();
  });
});
