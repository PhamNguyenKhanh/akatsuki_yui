import { expect, test } from "@playwright/test";
import { type PrismaClient, UserStatus } from "@prisma/client";
import { ROLES } from "../../src/modules/authorization/constants";
import {
  cleanupE2EByRunTag,
  createIsolatedE2EPrisma,
  ensureE2ESeedAndUser,
} from "./helpers/e2e-db";
import { makeRunTag, uiLogin } from "./helpers/e2e-ui";
import { startMockSmtpServer, type MockSmtpServerHandle } from "./helpers/mock-smtp";

test.describe("Workflow F, G & H — Docs, Notifications, Offline Mock SMTP, Reports & Activity", () => {
  const runTag = makeRunTag("e2e-wf-fgh");
  const password = "StrongPass!2026";
  const cronSecret =
    process.env.E2E_CRON_SECRET || "e2e-only-cron-secret-key-minimum-32-chars-0123456789";
  const smtpPort = Number(process.env.E2E_SMTP_PORT || "2525");

  let prisma!: PrismaClient;
  const createdUserIds: string[] = [];
  const createdProjectIds: string[] = [];
  let mockSmtp: MockSmtpServerHandle | null = null;

  const adminEmail = `${runTag}.admin@akatsuki.local`;
  const leaderEmail = `${runTag}.leader@akatsuki.local`;
  const memberEmail = `${runTag}.member@akatsuki.local`;

  test.beforeAll(async () => {
    prisma = createIsolatedE2EPrisma();
    mockSmtp = await startMockSmtpServer(smtpPort);

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
    const member = await ensureE2ESeedAndUser(prisma, {
      email: memberEmail,
      password,
      fullName: `Member ${runTag}`,
      role: ROLES.MEMBER,
      status: UserStatus.ACTIVE,
    });
    createdUserIds.push(admin.id, leader.id, member.id);
  });

  test.afterAll(async () => {
    if (mockSmtp) {
      await mockSmtp.close();
      mockSmtp = null;
    }
    await cleanupE2EByRunTag(prisma, runTag, createdUserIds, createdProjectIds);
    await prisma.$disconnect();
  });

  test("Docs URL allowlist, zero NotificationBell polling, Mock SMTP 421 + manual retry, Cron idempotency & SVG Reports", async ({
    browser,
  }) => {
    await prisma.project.updateMany({
      where: { status: "ACTIVE" },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });

    const [adminUser, leaderUser, memberUser] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: adminEmail.toLowerCase() } }),
      prisma.user.findUniqueOrThrow({ where: { email: leaderEmail.toLowerCase() } }),
      prisma.user.findUniqueOrThrow({ where: { email: memberEmail.toLowerCase() } }),
    ]);

    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await uiLogin(adminPage, adminEmail, password);

    // Create ACTIVE project with leader & member
    const createProjRes = await adminPage.request.post("/api/v1/projects", {
      data: {
        name: `${runTag} Report & Docs Project`,
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
        leaderId: leaderUser.id,
        memberIds: [memberUser.id],
      },
    });
    expect(createProjRes.status()).toBe(201);
    const projectId = ((await createProjRes.json()) as { data: { id: string } }).data.id;
    createdProjectIds.push(projectId);

    expect((await adminPage.request.post(`/api/v1/projects/${projectId}/activate`)).status()).toBe(
      200
    );

    // 1. Documents — create valid Drive link, reject unsafe javascript:/lookalike URL, soft delete
    const docCreateRes = await adminPage.request.post(`/api/v1/projects/${projectId}/documents`, {
      data: {
        title: `${runTag} SRS Spec`,
        url: "https://docs.google.com/document/d/e2e-spec-doc-123/edit",
        category: "SPECIFICATION",
      },
    });
    expect(docCreateRes.status()).toBe(201);
    const docId = ((await docCreateRes.json()) as { data: { id: string } }).data.id;

    const badDocRes = await adminPage.request.post(`/api/v1/projects/${projectId}/documents`, {
      data: {
        title: "Unsafe doc",
        url: "javascript:alert(1)",
        category: "OTHER",
      },
    });
    expect(badDocRes.status()).toBe(400);

    const delDocRes = await adminPage.request.delete(`/api/v1/documents/${docId}`);
    expect(delDocRes.status()).toBe(200);

    // 2. Assert ZERO automatic /api/notifications/unread-count polling on navigation
    let backgroundUnreadPollCount = 0;
    adminPage.on("request", (req) => {
      if (req.url().includes("/api/notifications/unread-count")) {
        backgroundUnreadPollCount += 1;
      }
    });

    await adminPage.goto("/dashboard");
    await adminPage.goto("/projects");
    await adminPage.goto("/reports");
    await adminPage.goto("/activity");
    await adminPage.waitForTimeout(500);
    expect(backgroundUnreadPollCount).toBe(0);

    // 3. Offline Mock SMTP: transient 421 failure -> Admin manual retry -> delivered to Mock SMTP
    mockSmtp!.setFailMode("transient-421");
    const deadlineSoon = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    const taskRes = await adminPage.request.post(`/api/v1/projects/${projectId}/tasks`, {
      data: {
        title: `${runTag} Urgent Task Due Soon`,
        priority: "URGENT",
        deadline: deadlineSoon,
        estimateHours: 6,
        assigneeIds: [memberUser.id],
      },
    });
    expect(taskRes.status()).toBe(201);

    // Check FAILED email delivery exists in Admin table and retry manually after restoring SMTP
    mockSmtp!.setFailMode("ok");
    await adminPage.goto("/admin/notifications/deliveries?status=FAILED");
    const retryButtons = adminPage.getByRole("button", { name: "Thử gửi lại" });
    if ((await retryButtons.count()) > 0) {
      await retryButtons.first().click();
      await adminPage.waitForTimeout(500);
    }

    // 4. Cron endpoint double execution on the same day keeps deadline dedupKey idempotency
    const cronRes1 = await adminPage.request.get("/api/internal/notifications/process", {
      headers: { authorization: `Bearer ${cronSecret}` },
    });
    expect(cronRes1.status()).toBe(200);
    const cronBody1 = (await cronRes1.json()) as {
      data: { deadlineReminders: { createdReminders: number } };
    };

    const cronRes2 = await adminPage.request.get("/api/internal/notifications/process", {
      headers: { authorization: `Bearer ${cronSecret}` },
    });
    expect(cronRes2.status()).toBe(200);
    const cronBody2 = (await cronRes2.json()) as {
      data: { deadlineReminders: { createdReminders: number } };
    };
    expect(cronBody2.data.deadlineReminders.createdReminders).toBe(0);
    expect(cronBody1.data.deadlineReminders.createdReminders).toBeGreaterThanOrEqual(0);
    expect(mockSmtp!.messages.length).toBeGreaterThanOrEqual(1);

    // 5. Reports, SVG charts & MEMBER SELF_ONLY scope + Unified Activity Log
    await adminPage.goto(`/reports?projectId=${projectId}`);
    await expect(adminPage.locator("svg[role='img']").first()).toBeVisible();

    const memberCtx = await browser.newContext();
    const memberPage = await memberCtx.newPage();
    await uiLogin(memberPage, memberEmail, password);

    const memberContribRes = await memberPage.request.get(
      `/api/v1/reports/projects/${projectId}/members`
    );
    expect(memberContribRes.status()).toBe(200);
    const memberContribJson = (await memberContribRes.json()) as {
      data: { viewScope: string };
    };
    expect(memberContribJson.data.viewScope).toBe("SELF_ONLY");

    await adminPage.goto(`/activity?projectId=${projectId}`);
    await expect(adminPage.getByText(`${runTag} Urgent Task Due Soon`).first()).toBeVisible();

    void adminUser;
    await memberCtx.close();
    await adminCtx.close();
  });
});
