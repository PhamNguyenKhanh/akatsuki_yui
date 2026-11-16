import { expect, test } from "@playwright/test";
import { type PrismaClient, UserStatus } from "@prisma/client";
import { ROLES } from "../../src/modules/authorization/constants";
import {
  cleanupE2EByRunTag,
  createIsolatedE2EPrisma,
  ensureE2ESeedAndUser,
} from "./helpers/e2e-db";
import { assertNoHorizontalOverflow, makeRunTag, uiLogin } from "./helpers/e2e-ui";

test.describe("Security Headers, IDOR, Body Size Limits, Rate Limit & Responsive UX", () => {
  const runTag = makeRunTag("e2e-sec-ux");
  const password = "StrongPass!2026";
  let prisma!: PrismaClient;
  const createdUserIds: string[] = [];
  const createdProjectIds: string[] = [];

  const adminEmail = `${runTag}.admin@akatsuki.local`;
  const outsiderEmail = `${runTag}.outsider@akatsuki.local`;

  test.beforeAll(async () => {
    prisma = createIsolatedE2EPrisma();
    const admin = await ensureE2ESeedAndUser(prisma, {
      email: adminEmail,
      password,
      fullName: `Admin ${runTag}`,
      role: ROLES.ADMIN,
      status: UserStatus.ACTIVE,
    });
    const outsider = await ensureE2ESeedAndUser(prisma, {
      email: outsiderEmail,
      password,
      fullName: `Outsider ${runTag}`,
      role: ROLES.MEMBER,
      status: UserStatus.ACTIVE,
    });
    createdUserIds.push(admin.id, outsider.id);
    await prisma.rateLimitEvent.deleteMany({
      where: { scope: { in: ["auth:login:ip", "auth:login:fail"] } },
    });
  });

  test.afterAll(async () => {
    await prisma.rateLimitEvent.deleteMany({
      where: { scope: { in: ["auth:login:ip", "auth:login:fail"] } },
    });
    await cleanupE2EByRunTag(prisma, runTag, createdUserIds, createdProjectIds);
    await prisma.$disconnect();
  });

  test("Health endpoints, Security Headers/CSP, invalid callbackUrl sanitization & REST IDOR", async ({
    browser,
    request,
  }) => {
    const healthRes = await request.get("/api/health");
    expect(healthRes.status()).toBe(200);
    expect(healthRes.headers()["cache-control"]).toContain("no-store");
    const healthV1Res = await request.get("/api/v1/health");
    expect(healthV1Res.status()).toBe(200);

    // Check Security Headers on HTML response
    const loginRes = await request.get("/login?callbackUrl=https://evil.example/phish");
    const headers = loginRes.headers();
    expect(headers["x-powered-by"]).toBeUndefined();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["content-security-policy"]).toBeTruthy();
    expect(headers["content-security-policy"]).not.toContain("unsafe-eval");

    // Admin creates a project that outsider is NOT a member of
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await uiLogin(adminPage, adminEmail, password);

    const projectRes = await adminPage.request.post("/api/v1/projects", {
      data: {
        name: `${runTag} Private Project`,
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
      },
    });
    expect(projectRes.status()).toBe(201);
    const projectId = ((await projectRes.json()) as { data: { id: string } }).data.id;
    createdProjectIds.push(projectId);

    // Outsider logs in via UI with malicious callbackUrl -> safely lands on /dashboard
    const outsiderCtx = await browser.newContext();
    const outsiderPage = await outsiderCtx.newPage();
    await outsiderPage.goto("/login?callbackUrl=https://evil.example/phish");
    await outsiderPage.locator("#email").fill(outsiderEmail);
    await outsiderPage.locator("#password").fill(password);
    await outsiderPage.getByRole("button", { name: "Đăng nhập" }).click();
    await outsiderPage.waitForURL(/\/dashboard/);
    expect(outsiderPage.url()).not.toContain("evil.example");

    // REST IDOR check -> 403
    const idorProj = await outsiderPage.request.get(`/api/v1/projects/${projectId}`);
    expect(idorProj.status()).toBe(403);
    const idorDocs = await outsiderPage.request.get(`/api/v1/projects/${projectId}/documents`);
    expect(idorDocs.status()).toBe(403);

    // Oversized JSON body > 64 KB rejected with 413
    const hugeTitle = "X".repeat(70 * 1024);
    const largeRes = await outsiderPage.request.post("/api/v1/projects", {
      data: { name: hugeTitle },
    });
    expect(largeRes.status()).toBe(413);

    // Not-found boundary on non-existent project UUID
    await adminPage.goto("/projects/00000000-0000-4000-8000-000000000999");
    await expect(adminPage.locator("body")).toContainText(/Không tìm thấy|404/i);

    await outsiderCtx.close();
    await adminCtx.close();
  });

  test("Sliding-window brute-force login rate limit (429) & multi-viewport zero horizontal overflow", async ({
    browser,
    request,
  }) => {
    const rateEmail = `${runTag}.ratelimit@akatsuki.local`;
    const u = await ensureE2ESeedAndUser(prisma, {
      email: rateEmail,
      password,
      fullName: `RateUser ${runTag}`,
      role: ROLES.MEMBER,
      status: UserStatus.ACTIVE,
    });
    createdUserIds.push(u.id);

    // Trigger 5 failed attempts -> 6th hits 429 rate limit
    let saw429 = false;
    for (let i = 0; i < 6; i += 1) {
      const failRes = await request.post("/api/v1/auth/login", {
        data: { email: rateEmail, password: "WrongPassword!999" },
      });
      if (failRes.status() === 429) {
        saw429 = true;
        break;
      }
    }
    expect(saw429).toBe(true);

    // Responsive check across 375px, 768px, 1280px viewports
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await uiLogin(page, adminEmail, password);

    const viewports = [
      { name: "mobile-375", width: 375, height: 812 },
      { name: "tablet-768", width: 768, height: 1024 },
      { name: "desktop-1280", width: 1280, height: 800 },
    ] as const;

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const route of [
        "/dashboard",
        "/projects",
        "/documents",
        "/notifications",
        "/activity",
      ]) {
        const start = Date.now();
        await page.goto(route);
        const navMs = Date.now() - start;
        expect(navMs).toBeGreaterThanOrEqual(0);
        await assertNoHorizontalOverflow(page, vp.name);
      }
    }

    await ctx.close();
  });
});
