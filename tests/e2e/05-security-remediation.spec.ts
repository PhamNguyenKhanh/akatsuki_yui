import { expect, test } from "@playwright/test";
import { TaskStatus } from "@prisma/client";
import { ROLES } from "@/modules/authorization/constants";
import { createIsolatedE2EPrisma, ensureE2ESeedAndUser } from "./helpers/e2e-db";
import { makeRunTag, uiLogin } from "./helpers/e2e-ui";

test.describe("E2E 05 — Security Remediation Verification (SEC-01..SEC-10)", () => {
  const prisma = createIsolatedE2EPrisma();
  const runTag = makeRunTag("e2e-sec");
  const password = "E2eSecPass@123";

  const leaderEmail = `${runTag}.leader@akatsuki.local`;
  const memberEmail = `${runTag}.member@akatsuki.local`;
  const instructorEmail = `${runTag}.instructor@akatsuki.local`;

  const createdUserIds: string[] = [];
  const createdProjectIds: string[] = [];

  let leaderId = "";
  let memberId = "";
  let instructorId = "";

  test.beforeAll(async () => {
    const [leader, member, instructor] = await Promise.all([
      ensureE2ESeedAndUser(prisma, {
        email: leaderEmail,
        password,
        fullName: `Sec E2E Leader ${runTag}`,
        role: ROLES.LEADER,
      }),
      ensureE2ESeedAndUser(prisma, {
        email: memberEmail,
        password,
        fullName: `Sec E2E Member ${runTag}`,
        role: ROLES.MEMBER,
      }),
      ensureE2ESeedAndUser(prisma, {
        email: instructorEmail,
        password,
        fullName: `Sec E2E Instructor ${runTag}`,
        role: ROLES.INSTRUCTOR,
      }),
    ]);

    leaderId = leader.id;
    memberId = member.id;
    instructorId = instructor.id;
    createdUserIds.push(leaderId, memberId, instructorId);
  });

  test.afterAll(async () => {
    try {
      if (createdProjectIds.length > 0) {
        await prisma.document.deleteMany({ where: { projectId: { in: createdProjectIds } } });
        await prisma.notification.deleteMany({ where: { projectId: { in: createdProjectIds } } });
        await prisma.activityLog.deleteMany({ where: { projectId: { in: createdProjectIds } } });
        await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
      }
      if (createdUserIds.length > 0) {
        await prisma.notification.deleteMany({
          where: { OR: [{ userId: { in: createdUserIds } }, { actorId: { in: createdUserIds } }] },
        });
        await prisma.auditLog.deleteMany({
          where: { OR: [{ actorId: { in: createdUserIds } }, { entityId: { in: createdUserIds } }] },
        });
        await prisma.activityLog.deleteMany({
          where: { OR: [{ userId: { in: createdUserIds } }, { entityId: { in: createdUserIds } }] },
        });
        await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  test("SEC-07 & SEC-01 & SEC-04 & SEC-08 & SEC-09: Nonce CSP + Zero Console Errors + Logout Revokes Stale JWT Replay + DONE UI/API Read-Only + Candidates Projection", async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const cspOrPageErrors: string[] = [];
    page.on("pageerror", (err) => cspOrPageErrors.push(`pageerror: ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error" && msg.text().toLowerCase().includes("content security policy")) {
        cspOrPageErrors.push(`console.error: ${msg.text()}`);
      }
    });

    // 1. Inspect SEC-07 security headers on /login in production build
    const loginResp = await page.goto("/login");
    expect(loginResp).not.toBeNull();
    const loginHeaders = loginResp!.headers();
    const cspHeader = loginHeaders["content-security-policy"] ?? "";
    expect(cspHeader).toContain("script-src 'self' 'nonce-");
    expect(cspHeader).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(cspHeader).not.toContain("'unsafe-eval'");
    expect(cspHeader).toContain("frame-ancestors 'none'");
    expect(loginHeaders["x-content-type-options"]).toBe("nosniff");
    expect(loginHeaders["x-frame-options"]).toBe("DENY");
    // Local production HTTP run must NOT emit HSTS without VERCEL_ENV=production
    expect(loginHeaders["strict-transport-security"]).toBeUndefined();

    // Sign in as Leader
    await uiLogin(page, leaderEmail, password);

    const dashResp = await page.goto("/dashboard");
    expect(dashResp).not.toBeNull();
    expect(dashResp!.headers()["content-security-policy"]).toContain("script-src 'self' 'nonce-");

    // Verify /api/v1/auth/session carries Cache-Control: no-store (SEC-10)
    const sessionCheckRes = await page.request.get("/api/v1/auth/session");
    expect(sessionCheckRes.status()).toBe(200);
    expect(sessionCheckRes.headers()["cache-control"]).toContain("no-store");

    // 2. SEC-09: Project Candidates picker exposes strictly { id, fullName }, never emails or roles
    await page.goto("/projects/new");
    const newProjectHtml = await page.content();
    expect(newProjectHtml).not.toContain(memberEmail);

    const candRes = await page.request.get("/api/v1/projects/candidates?kind=instructor&limit=25");
    expect(candRes.status()).toBe(200);
    expect(candRes.headers()["cache-control"]).toContain("no-store");
    const candJson = (await candRes.json()) as { data: Array<Record<string, unknown>> };
    const matchedInstructor = candJson.data.find((u) => u.id === instructorId);
    expect(matchedInstructor).toBeDefined();
    expect(Object.keys(matchedInstructor!).sort()).toEqual(["fullName", "id"]);

    // Non-admin leader cannot query leader picker on project creation
    const forbiddenLeaderCand = await page.request.get("/api/v1/projects/candidates?kind=leader");
    expect(forbiddenLeaderCand.status()).toBe(403);

    // Create project & task via API
    const createProjRes = await page.request.post("/api/v1/projects", {
      data: {
        name: `Sec E2E Proj ${runTag}`,
        startDate: "2026-11-01",
        endDate: "2026-12-30",
        memberIds: [memberId],
      },
    });
    expect(createProjRes.status()).toBe(201);
    const createdProj = ((await createProjRes.json()) as { data: { id: string } }).data;
    createdProjectIds.push(createdProj.id);

    // 3. SEC-04: Oversized >64KB JSON body rejected cleanly with 413 on optional-JSON route
    const taskRes = await page.request.post(`/api/v1/projects/${createdProj.id}/tasks`, {
      data: {
        title: `Sec E2E Task ${runTag}`,
        deadline: "2026-12-20T00:00:00.000Z",
        priority: "HIGH",
        assigneeIds: [memberId],
      },
    });
    expect(taskRes.status()).toBe(201);
    const task = ((await taskRes.json()) as { data: { id: string } }).data;

    await page.request.patch(`/api/v1/tasks/${task.id}`, {
      data: { status: TaskStatus.IN_PROGRESS },
    });

    const hugeReviewBody = JSON.stringify({ note: "x".repeat(70_000) });
    const hugeRes = await page.request.post(`/api/v1/tasks/${task.id}/submit-review`, {
      headers: { "content-type": "application/json" },
      data: hugeReviewBody,
    });
    expect(hugeRes.status()).toBe(413);

    // Move task to REVIEW and approve -> DONE
    const submitOk = await page.request.post(`/api/v1/tasks/${task.id}/submit-review`, {
      data: { note: "Ready" },
    });
    expect(submitOk.status()).toBe(200);
    const approveOk = await page.request.post(`/api/v1/tasks/${task.id}/approve`, {
      data: { reason: "Approved for E2E SEC-08" },
    });
    expect(approveOk.status()).toBe(200);

    // 4. SEC-08: DONE task UI hides editing controls and shows read-only notice; direct API mutates reject 409 TASK_ALREADY_COMPLETED
    await page.goto(`/projects/${createdProj.id}/tasks/${task.id}`);
    await expect(page.getByText(/DONE.*Chỉ xem/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "Chỉnh sửa" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Lưu tiến độ" })).toHaveCount(0);

    const postDonePatch = await page.request.patch(`/api/v1/tasks/${task.id}`, {
      data: { progressNotes: "Bypass attempt" },
    });
    expect(postDonePatch.status()).toBe(409);
    const postDonePatchJson = (await postDonePatch.json()) as { error: { code: string } };
    expect(postDonePatchJson.error.code).toBe("TASK_ALREADY_COMPLETED");

    // 5. SEC-01: Capture authenticated cookies, trigger Logout, and verify stale JWT replay is rejected!
    const preLogoutCookies = await context.cookies(baseURL);
    const cookieHeader = preLogoutCookies.map((c) => `${c.name}=${c.value}`).join("; ");
    expect(cookieHeader.length).toBeGreaterThan(10);

    const logoutRes = await page.request.post("/api/v1/auth/logout");
    expect(logoutRes.status()).toBe(200);

    // Replay captured pre-logout session cookie against authenticated API + protected page in a fresh context
    const replayContext = await browser.newContext();
    await replayContext.addCookies(preLogoutCookies);

    const replayApiRes = await replayContext.request.get("/api/v1/auth/session");
    expect(replayApiRes.status()).toBe(401);
    const replayJson = (await replayApiRes.json()) as { error: { code: string } };
    expect(replayJson.error.code).toBe("AUTH_REQUIRED");

    const replayPage = await replayContext.newPage();
    await replayPage.goto("/dashboard");
    await expect(replayPage).toHaveURL(/\/login/);

    await replayContext.close();
    await context.close();

    expect(cspOrPageErrors).toEqual([]);
  });
});
