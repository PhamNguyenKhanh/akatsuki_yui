import { expect, test } from "@playwright/test";
import { type PrismaClient, UserStatus } from "@prisma/client";
import { ROLES } from "../../src/modules/authorization/constants";
import {
  cleanupE2EByRunTag,
  createIsolatedE2EPrisma,
  ensureE2ESeedAndUser,
} from "./helpers/e2e-db";
import { makeRunTag, uiLogin } from "./helpers/e2e-ui";

test.describe("Workflow C, D & E — Project Lifecycle, Multi-Assignee DAG Tasks & Dual Sprints", () => {
  const runTag = makeRunTag("e2e-wf-cde");
  const password = "StrongPass!2026";
  let prisma!: PrismaClient;
  const createdUserIds: string[] = [];
  const createdProjectIds: string[] = [];

  const adminEmail = `${runTag}.admin@akatsuki.local`;
  const leaderEmail = `${runTag}.leader@akatsuki.local`;
  const member1Email = `${runTag}.member1@akatsuki.local`;
  const member2Email = `${runTag}.member2@akatsuki.local`;

  let adminId = "";
  let leaderId = "";
  let member1Id = "";
  let member2Id = "";

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
    const m1 = await ensureE2ESeedAndUser(prisma, {
      email: member1Email,
      password,
      fullName: `Member1 ${runTag}`,
      role: ROLES.MEMBER,
      status: UserStatus.ACTIVE,
    });
    const m2 = await ensureE2ESeedAndUser(prisma, {
      email: member2Email,
      password,
      fullName: `Member2 ${runTag}`,
      role: ROLES.MEMBER,
      status: UserStatus.ACTIVE,
    });
    adminId = admin.id;
    leaderId = leader.id;
    member1Id = m1.id;
    member2Id = m2.id;
    createdUserIds.push(adminId, leaderId, member1Id, member2Id);
  });

  test.afterAll(async () => {
    await cleanupE2EByRunTag(prisma, runTag, createdUserIds, createdProjectIds);
    await prisma.$disconnect();
  });

  test("Project lifecycle (single active 409, archive lock, restore), DAG dependency 409, review reject/approve & dual sprints", async ({
    browser,
  }) => {
    // Archive any leftover active projects in isolated test DB so single-active starts clean
    await prisma.project.updateMany({
      where: { status: "ACTIVE" },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });

    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await uiLogin(adminPage, adminEmail, password);

    // 1. Create Project 1 & Project 2 via UI / API
    await adminPage.goto("/projects/new");
    await adminPage.locator("#project-name").fill(`${runTag} Primary Project`);
    await adminPage.getByRole("button", { name: /Tạo Project/i }).click();
    await adminPage.waitForURL(/\/projects\/[0-9a-f-]+$/);
    const project1Id = adminPage.url().split("/").pop()!;
    createdProjectIds.push(project1Id);

    const project2Res = await adminPage.request.post("/api/v1/projects", {
      data: {
        name: `${runTag} Secondary Project`,
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
        leaderId,
      },
    });
    expect(project2Res.status()).toBe(201);
    const project2Json = (await project2Res.json()) as { data: { id: string } };
    const project2Id = project2Json.data.id;
    createdProjectIds.push(project2Id);

    // Activate Project 1 -> ACTIVE
    await adminPage.getByRole("button", { name: "Kích hoạt Project" }).click();
    await adminPage.getByRole("button", { name: "Xác nhận kích hoạt" }).click();
    await expect(adminPage.getByText("ACTIVE").first()).toBeVisible();

    // Activate Project 2 while Project 1 is ACTIVE -> blocked 409 (BR-PROJ-004)
    const conflictActivate = await adminPage.request.post(
      `/api/v1/projects/${project2Id}/activate`
    );
    expect(conflictActivate.status()).toBe(409);

    // Add Leader & Members to Project 1
    for (const memberPayload of [
      { userId: leaderId, role: "MEMBER" },
      { userId: member1Id, role: "MEMBER" },
      { userId: member2Id, role: "MEMBER" },
    ]) {
      await adminPage.request.post(`/api/v1/projects/${project1Id}/members`, {
        data: memberPayload,
      });
    }

    // Transfer Project 1 leader to leaderId
    const leaderRes = await adminPage.request.patch(`/api/v1/projects/${project1Id}/leader`, {
      data: { leaderId },
    });
    expect(leaderRes.status()).toBe(200);

    // Test Project 2 archive read-only & restore lifecycle
    await adminPage.request.post(`/api/v1/projects/${project2Id}/archive`);
    const archivedPatch = await adminPage.request.patch(`/api/v1/projects/${project2Id}`, {
      data: { name: "Should fail archived" },
    });
    expect(archivedPatch.status()).toBeGreaterThanOrEqual(400);

    const restoreRes = await adminPage.request.post(`/api/v1/projects/${project2Id}/restore`, {
      data: { targetStatus: "CREATED" },
    });
    expect(restoreRes.status()).toBe(200);

    // 2. Multi-assignee Task A & Task B + DAG dependency cycle detection (409)
    const leaderCtx = await browser.newContext();
    const leaderPage = await leaderCtx.newPage();
    await uiLogin(leaderPage, leaderEmail, password);

    const deadlineIso = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const taskARes = await leaderPage.request.post(`/api/v1/projects/${project1Id}/tasks`, {
      data: {
        title: `${runTag} Task A`,
        priority: "HIGH",
        deadline: deadlineIso,
        estimateHours: 8,
        assigneeIds: [member1Id, member2Id],
      },
    });
    expect(taskARes.status()).toBe(201);
    const taskA = ((await taskARes.json()) as { data: { id: string } }).data;

    const taskBRes = await leaderPage.request.post(`/api/v1/projects/${project1Id}/tasks`, {
      data: {
        title: `${runTag} Task B`,
        priority: "MEDIUM",
        deadline: deadlineIso,
        estimateHours: 4,
        assigneeIds: [member1Id],
      },
    });
    expect(taskBRes.status()).toBe(201);
    const taskB = ((await taskBRes.json()) as { data: { id: string } }).data;

    // A depends on B (valid)
    const depAB = await leaderPage.request.post(`/api/v1/tasks/${taskA.id}/dependencies`, {
      data: { dependsOnTaskId: taskB.id },
    });
    expect(depAB.status()).toBe(201);

    // B depends on A (cyclic -> 409)
    const depCycle = await leaderPage.request.post(`/api/v1/tasks/${taskB.id}/dependencies`, {
      data: { dependsOnTaskId: taskA.id },
    });
    expect(depCycle.status()).toBe(409);

    // Task A starts blocked by Task B until Task B completes! Verify Member workflow on Task B
    const m1Ctx = await browser.newContext();
    const m1Page = await m1Ctx.newPage();
    await uiLogin(m1Page, member1Email, password);

    await m1Page.goto(`/projects/${project1Id}/tasks/${taskB.id}`);
    await m1Page.getByRole("button", { name: "Bắt đầu thực hiện" }).click();
    await m1Page.getByRole("button", { name: "Gửi Review" }).click();
    await m1Page.locator("#review-modal-textarea").fill("Ready for leader review");
    await m1Page
      .getByRole("button", { name: /Gửi Review/i })
      .last()
      .click();

    // Leader rejects first with reason -> IN_PROGRESS
    await leaderPage.goto(`/projects/${project1Id}/tasks/${taskB.id}`);
    await leaderPage.getByRole("button", { name: "Từ chối (Reject)" }).click();
    await leaderPage.locator("#review-modal-textarea").fill("Need unit test coverage");
    await leaderPage
      .getByRole("button", { name: /Từ chối/i })
      .last()
      .click();
    await expect(leaderPage.getByText("IN_PROGRESS").first()).toBeVisible();

    // Resubmit & approve -> DONE
    await m1Page.reload();
    await m1Page.getByRole("button", { name: "Gửi Review" }).click();
    await m1Page.locator("#review-modal-textarea").fill("Added tests");
    await m1Page
      .getByRole("button", { name: /Gửi Review/i })
      .last()
      .click();

    await leaderPage.reload();
    await leaderPage.getByRole("button", { name: "Duyệt (Approve)" }).click();
    await leaderPage.getByRole("button", { name: /Duyệt/i }).last().click();
    await expect(leaderPage.getByText("DONE").first()).toBeVisible();

    // 3. Create Sprint 1 & Sprint 2, verify Dual Concurrent ACTIVE Sprints (DEC-006) & Backlog <= 50 pageSize
    const todayYmd = new Date().toISOString().slice(0, 10);
    const nextWeekYmd = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

    const s1Res = await leaderPage.request.post(`/api/v1/projects/${project1Id}/sprints`, {
      data: { name: `${runTag} Sprint 1`, startDate: todayYmd, endDate: nextWeekYmd },
    });
    const s2Res = await leaderPage.request.post(`/api/v1/projects/${project1Id}/sprints`, {
      data: { name: `${runTag} Sprint 2`, startDate: todayYmd, endDate: nextWeekYmd },
    });
    expect(s1Res.status()).toBe(201);
    expect(s2Res.status()).toBe(201);
    const sprint1Id = ((await s1Res.json()) as { data: { id: string } }).data.id;
    const sprint2Id = ((await s2Res.json()) as { data: { id: string } }).data.id;

    // Sprint Detail Page & Backlog API both work cleanly (regression for BUG-601 pageSize<=50)
    await leaderPage.goto(`/projects/${project1Id}/sprints/${sprint1Id}`);
    await expect(leaderPage.getByText(`${runTag} Sprint 1`)).toBeVisible();

    const backlogRes = await leaderPage.request.get(
      `/api/v1/projects/${project1Id}/backlog?pageSize=50`
    );
    expect(backlogRes.status()).toBe(200);

    // Assign Task A to Sprint 1 and activate BOTH Sprint 1 and Sprint 2 concurrently
    const assignRes = await leaderPage.request.post(`/api/v1/sprints/${sprint1Id}/tasks`, {
      data: { taskIds: [taskA.id] },
    });
    expect(assignRes.status()).toBe(200);

    const act1 = await leaderPage.request.post(`/api/v1/sprints/${sprint1Id}/activate`);
    const act2 = await leaderPage.request.post(`/api/v1/sprints/${sprint2Id}/activate`);
    expect(act1.status()).toBe(200);
    expect(act2.status()).toBe(200);

    // Complete Sprint 1 and roll Task A over to Sprint 2
    const completeRes = await leaderPage.request.post(`/api/v1/sprints/${sprint1Id}/complete`, {
      data: {
        note: "Sprint 1 complete rollover",
        taskDispositions: [
          {
            taskId: taskA.id,
            action: "MOVE_TO_SPRINT",
            targetSprintId: sprint2Id,
          },
        ],
      },
    });
    expect(completeRes.status()).toBe(200);

    // Edit Task A estimateHours AFTER Sprint 1 COMPLETED, then check Sprint 1 Burndown stays immutable (DEC-058)
    const burndownBeforeRes = await leaderPage.request.get(`/api/v1/sprints/${sprint1Id}/burndown`);
    expect(burndownBeforeRes.status()).toBe(200);
    const burndownBefore = (await burndownBeforeRes.json()) as {
      data: { burndown: { baselineHours: number; closureScopeHours?: number } };
    };

    await leaderPage.request.patch(`/api/v1/tasks/${taskA.id}`, {
      data: { estimateHours: 40 },
    });

    const burndownAfterRes = await leaderPage.request.get(`/api/v1/sprints/${sprint1Id}/burndown`);
    expect(burndownAfterRes.status()).toBe(200);
    const burndownAfter = (await burndownAfterRes.json()) as {
      data: { burndown: { baselineHours: number; closureScopeHours?: number } };
    };
    expect(burndownAfter.data.burndown.baselineHours).toEqual(
      burndownBefore.data.burndown.baselineHours
    );
    expect(burndownAfter.data.burndown.closureScopeHours).toEqual(
      burndownBefore.data.burndown.closureScopeHours
    );

    await m1Ctx.close();
    await leaderCtx.close();
    await adminCtx.close();
  });
});
