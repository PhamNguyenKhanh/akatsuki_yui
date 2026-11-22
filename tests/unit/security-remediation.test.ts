import { NextRequest } from "next/server";
import { ProjectStatus, TaskStatus, UserStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authMock,
  signOutMock,
  redirectMock,
  prismaMock,
  verifyPasswordSpy,
  headersMock,
  taskGuardMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  signOutMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    const err = new Error(`NEXT_REDIRECT:${url}`);
    (err as Error & { digest?: string }).digest = `NEXT_REDIRECT;push;${url};307;`;
    throw err;
  }),
  verifyPasswordSpy: vi.fn(),
  headersMock: vi.fn(async () => new Headers()),
  taskGuardMock: {
    assertNoActiveProjectTasks: vi.fn(),
  },
  prismaMock: {
    user: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
    task: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    taskDependency: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    taskAssignee: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    projectMember: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    rateLimitEvent: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  },
}));

vi.mock("next/headers", () => ({
  headers: headersMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("next-auth", () => ({
  default: vi.fn(),
  AuthError: class AuthError extends Error {},
  CredentialsSignin: class CredentialsSignin extends Error {},
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
  signOut: signOutMock,
}));

vi.mock("@/lib/password", async () => {
  const actual = await vi.importActual<typeof import("@/lib/password")>("@/lib/password");
  return {
    ...actual,
    verifyPassword: verifyPasswordSpy.mockImplementation(actual.verifyPassword),
  };
});

vi.mock("@/modules/project-members/task-assignment-guard", () => ({
  taskAssignmentGuard: taskGuardMock,
}));

import { apiError, apiSuccess } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import {
  RATE_LIMIT_SCOPES,
  consumeRateLimit,
  extractClientIpFromHeaders,
  runWithRateLimitContext,
} from "@/lib/rate-limit";
import { MAX_JSON_BODY_BYTES, parseJsonBody, parseOptionalJsonBody } from "@/lib/request";
import {
  resolveSafeNotificationTargetUrl,
  sanitizeExternalHttpUrl,
  sanitizeGoogleDriveReadUrl,
  sanitizeInternalTargetPath,
} from "@/lib/safe-url";
import { buildContentSecurityPolicy, buildSecurityHeaders, shouldEnableHsts } from "@/lib/security-headers";
import { emailSchema, isStrictSingleEmailAddress } from "@/lib/validations/common";
import { logoutAction } from "@/modules/auth/auth.actions";
import {
  authenticateCredentials,
  revokeUserSessionOnLogout,
} from "@/modules/auth/auth.service";
import { PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import { mapDocumentToDTO } from "@/modules/documents/document.repository";
import { mapNotificationToDTO } from "@/modules/notifications/notification.repository";
import { buildNotificationEmailContent } from "@/modules/notifications/notification-email.templates";
import { mapProjectToDTO } from "@/modules/projects/project.repository";
import {
  listProjectUserCandidatesService,
  updateProjectService,
} from "@/modules/projects/project.service";
import {
  addTaskAssigneeService,
  removeTaskAssigneeService,
  syncTaskAssigneesService,
} from "@/modules/tasks/task-assignment.service";
import {
  addTaskDependencyService,
  removeTaskDependencyService,
} from "@/modules/tasks/task-dependency.service";
import { mapReferenceLinks } from "@/modules/tasks/task.repository";
import { updateTaskService } from "@/modules/tasks/task.service";
import {
  approveTaskReviewService,
  rejectTaskReviewService,
  submitTaskForReviewService,
  updateTaskStatusService,
} from "@/modules/tasks/task-workflow.service";
import { changeMyPasswordService } from "@/modules/users/user.service";
import { sendEmailViaSmtp } from "@/server/integrations/email";
import { POST as logoutRoutePost } from "@/app/api/v1/auth/logout/route";
import { POST as submitReviewRoutePost } from "@/app/api/v1/tasks/[taskId]/submit-review/route";
import { PATCH as notificationReadRoutePatch } from "@/app/api/v1/notifications/[notificationId]/read/route";
import { POST as adminRetryRoutePost } from "@/app/api/v1/admin/notifications/deliveries/[deliveryId]/retry/route";
import { GET as projectCandidatesRouteGet } from "@/app/api/v1/projects/candidates/route";
import type { AuthContext } from "@/types/auth";

const LEADER_ID = "11111111-1111-4111-8111-111111111111";
const USER_2_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_ID = "33333333-3333-4333-8333-333333333333";
const TASK_ID = "44444444-4444-4444-8444-444444444444";
const TASK_B_ID = "55555555-5555-4555-8555-555555555555";

const leaderActor: AuthContext = {
  userId: LEADER_ID,
  email: "leader@akatsuki.local",
  fullName: "Leader Actor",
  status: UserStatus.ACTIVE,
  roles: [ROLES.LEADER],
  permissions: Object.values(PERMISSIONS),
};

describe("Security Remediation Unit Regression Suite (SEC-01 .. SEC-11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockReset();
    prismaMock.task.findUnique.mockReset();
    prismaMock.$queryRaw.mockReset().mockResolvedValue([{ cnt: 0, oldest: new Date() }]);
    prismaMock.$executeRaw.mockReset().mockResolvedValue(1);
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock)
    );
    delete process.env.VERCEL;
  });

  describe("SEC-01: JWT Session Revocation on Logout", () => {
    it("atomically increments User.tokenVersion and fails closed when DB update fails", async () => {
      prismaMock.user.updateMany.mockResolvedValueOnce({ count: 1 });
      prismaMock.activityLog.create.mockResolvedValueOnce({});

      const result = await revokeUserSessionOnLogout({
        userId: LEADER_ID,
        email: "leader@akatsuki.local",
        expectedTokenVersion: 2,
      });

      expect(result).toEqual({ revoked: true });
      expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
        where: { id: LEADER_ID, tokenVersion: 2 },
        data: { tokenVersion: { increment: 1 } },
      });
      expect(prismaMock.activityLog.create).toHaveBeenCalledTimes(1);

      // Fail-closed: DB failure must propagate before cookie clearing
      prismaMock.user.updateMany.mockRejectedValueOnce(new Error("DB offline"));
      authMock.mockResolvedValueOnce({
        user: { id: LEADER_ID, email: "leader@akatsuki.local", tokenVersion: 3 },
      });
      const res = await logoutRoutePost();
      expect(res.status).toBe(500);
      expect(signOutMock).not.toHaveBeenCalled();

      // logoutAction must also fail closed instead of calling signOut on DB error
      prismaMock.user.updateMany.mockRejectedValueOnce(new Error("DB offline"));
      authMock.mockResolvedValueOnce({
        user: { id: LEADER_ID, email: "leader@akatsuki.local", tokenVersion: 3 },
      });
      await expect(logoutAction()).rejects.toThrow("DB offline");
      expect(signOutMock).not.toHaveBeenCalled();
    });

    it("handles already-revoked double logout gracefully without double-incrementing", async () => {
      prismaMock.user.updateMany.mockResolvedValueOnce({ count: 0 });
      authMock.mockResolvedValueOnce({
        user: { id: LEADER_ID, email: "leader@akatsuki.local", tokenVersion: 0 },
      });

      const res = await logoutRoutePost();
      expect(res.status).toBe(200);
      expect(prismaMock.activityLog.create).not.toHaveBeenCalled();
      expect(signOutMock).toHaveBeenCalledWith({ redirect: false });
    });
  });

  describe("SEC-02: Trusted IP Extraction, Password Change Keying & Dedup Map", () => {
    it("ignores spoofable x-forwarded-for / x-real-ip headers outside Vercel and validates IP format on Vercel", () => {
      const spoofed = new Headers({
        "x-forwarded-for": "198.51.100.77",
        "x-real-ip": "203.0.113.5",
        "x-vercel-forwarded-for": "192.0.2.99",
      });
      expect(extractClientIpFromHeaders(spoofed)).toBe("unknown");

      process.env.VERCEL = "1";
      expect(
        extractClientIpFromHeaders(new Headers({ "x-forwarded-for": "198.51.100.77" }))
      ).toBe("unknown");
      expect(
        extractClientIpFromHeaders(
          new Headers({ "x-vercel-forwarded-for": "203.0.113.55:44321, 10.0.0.1" })
        )
      ).toBe("203.0.113.55");
      expect(
        extractClientIpFromHeaders(new Headers({ "x-vercel-forwarded-for": "[2001:db8::1]:8080" }))
      ).toBe("2001:db8::1");
      expect(
        extractClientIpFromHeaders(new Headers({ "x-vercel-forwarded-for": "not-an-ip-address" }))
      ).toBe("unknown");
    });

    it("keys password-change rate limiting solely by userId and caches real remaining count in AsyncLocalStorage Map", async () => {
      let currentCnt = 0;
      prismaMock.$queryRaw.mockImplementation(async () => [{ cnt: currentCnt, oldest: new Date() }]);
      prismaMock.$executeRaw.mockImplementation(async (strings: TemplateStringsArray) => {
        if (strings.join("").includes("INSERT INTO")) {
          currentCnt += 1;
        }
        return 1;
      });

      await runWithRateLimitContext(async () => {
        const r1 = await consumeRateLimit({
          scope: RATE_LIMIT_SCOPES.AUTH_LOGIN_FAIL,
          identifier: "dedup-check@akatsuki.local",
        });
        const r2 = await consumeRateLimit({
          scope: RATE_LIMIT_SCOPES.AUTH_LOGIN_FAIL,
          identifier: "dedup-check@akatsuki.local",
        });
        expect(r1.remaining).toBe(4);
        expect(r2.remaining).toBe(4);
      });

      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      await expect(
        changeMyPasswordService(
          leaderActor,
          {
            currentPassword: "WrongPassword@1",
            newPassword: "NewStrongPass@1",
            confirmNewPassword: "NewStrongPass@1",
          },
          { headers: new Headers({ "x-vercel-forwarded-for": "203.0.113.1" }) }
        )
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("SEC-03: Strict Single-Recipient Email Validation", () => {
    it("rejects display-name syntax, multi-recipient delimiters, control chars, and invalid domains", async () => {
      const dangerousEmails = [
        "Victim <victim@example.com>",
        "a@example.com, b@example.com",
        "a@example.com; b@example.com",
        "bad@example.com\r\nBcc:evil@attacker.local",
        "double@@example.com",
        "bad..dot@example.com",
        "nodomain",
        `${"a".repeat(250)}@example.com`,
      ];

      for (const candidate of dangerousEmails) {
        expect(isStrictSingleEmailAddress(candidate), candidate).toBe(false);
        expect(emailSchema.safeParse(candidate).success, candidate).toBe(false);

        const res = await sendEmailViaSmtp({
          to: candidate,
          subject: "Test",
          html: "<p>Test</p>",
          text: "Test",
          deliveryId: "deliv-1",
        });
        expect(res).toMatchObject({
          status: "FAILED",
          errorCode: "INVALID_SINGLE_RECIPIENT",
        });
      }

      expect(isStrictSingleEmailAddress("Member.User+dev@akatsuki.local")).toBe(true);
      expect(emailSchema.safeParse("  Member.User+dev@akatsuki.local ").success).toBe(true);
    });
  });

  describe("SEC-04: Bounded Streaming JSON Body Limits", () => {
    it("enforces 64KB cap even for chunked streams without Content-Length and on optional JSON routes", async () => {
      const hugeChunk = new TextEncoder().encode("x".repeat(MAX_JSON_BODY_BYTES + 64));
      const streamReq = new Request("http://localhost/api/test", {
        method: "POST",
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(hugeChunk.slice(0, 40_000));
            controller.enqueue(hugeChunk.slice(40_000));
            controller.close();
          },
        }),
        duplex: "half",
      } as RequestInit & { duplex: "half" });

      await expect(parseJsonBody(streamReq)).rejects.toMatchObject({
        statusCode: 413,
        code: "PAYLOAD_TOO_LARGE",
      });

      const emptyOptionalReq = new Request("http://localhost/api/test", { method: "POST" });
      await expect(parseOptionalJsonBody(emptyOptionalReq, { isRead: true })).resolves.toEqual({
        isRead: true,
      });

      prismaMock.user.findUnique.mockResolvedValue({
        id: LEADER_ID,
        email: leaderActor.email,
        fullName: leaderActor.fullName,
        status: UserStatus.ACTIVE,
        tokenVersion: 0,
        userRoles: [{ role: { name: ROLES.LEADER, rolePermissions: [] } }],
      });
      authMock.mockResolvedValue({
        user: { id: LEADER_ID, tokenVersion: 0 },
      });

      const oversizedPayload = JSON.stringify({ note: "a".repeat(MAX_JSON_BODY_BYTES + 100) });
      const reviewRes = await submitReviewRoutePost(
        new Request("http://localhost/api/v1/tasks/id/submit-review", {
          method: "POST",
          body: oversizedPayload,
        }),
        { params: Promise.resolve({ taskId: TASK_ID }) }
      );
      expect(reviewRes.status).toBe(413);

      const readRes = await notificationReadRoutePatch(
        new Request("http://localhost/api/v1/notifications/id/read", {
          method: "PATCH",
          body: oversizedPayload,
        }),
        { params: Promise.resolve({ notificationId: TASK_ID }) }
      );
      expect(readRes.status).toBe(413);

      const invalidJsonReadRes = await notificationReadRoutePatch(
        new Request("http://localhost/api/v1/notifications/id/read", {
          method: "PATCH",
          body: "{broken-json",
        }),
        { params: Promise.resolve({ notificationId: TASK_ID }) }
      );
      expect(invalidJsonReadRes.status).toBe(400);

      const retryRes = await adminRetryRoutePost(
        new Request("http://localhost/api/v1/admin/notifications/deliveries/id/retry", {
          method: "POST",
          body: oversizedPayload,
        }),
        { params: Promise.resolve({ deliveryId: TASK_ID }) }
      );
      expect(retryRes.status).toBe(413);
    });
  });

  describe("SEC-05: Safe URL Sanitization at Helper, Read-DTO & Email Layers", () => {
    it("sanitizes unsafe legacy URLs in Repositories, Helpers, and Notification Emails", () => {
      const dangerousUrls = [
        "javascript:alert(1)",
        "JAVASCRIPT:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "vbscript:msgbox(1)",
        "//evil.com/phish",
        "/\\evil.com",
        "https://user:pass@example.com/file",
      ];

      for (const bad of dangerousUrls) {
        expect(sanitizeExternalHttpUrl(bad)).toBeNull();
        expect(sanitizeGoogleDriveReadUrl(bad)).toBeNull();
        expect(sanitizeInternalTargetPath(bad)).toBeNull();
        expect(resolveSafeNotificationTargetUrl(bad, "https://app.akatsuki.dev")).toBeNull();
      }

      // Cross-origin absolute link rejected in notification email
      expect(
        resolveSafeNotificationTargetUrl("https://evil.example/steal", "https://app.akatsuki.dev")
      ).toBeNull();

      const emailRendered = buildNotificationEmailContent({
        type: "SYSTEM",
        recipientName: "User",
        title: "Notice",
        message: "Test",
        targetUrl: "javascript:alert(document.cookie)",
      });
      expect(emailRendered.html).not.toContain("javascript:");
      expect(emailRendered.html).not.toContain("<a ");
      expect(emailRendered.text).not.toContain("javascript:");

      // Repository DTO read-time sanitization
      expect(
        mapReferenceLinks(["https://github.com/org/repo/pull/1", "javascript:alert(1)"])
      ).toEqual(["https://github.com/org/repo/pull/1"]);

      const mappedDoc = mapDocumentToDTO({
        id: "doc-1",
        projectId: PROJECT_ID,
        sprintId: null,
        uploadedById: LEADER_ID,
        title: "Unsafe Doc",
        url: "http://drive.google.com.evil.com/doc/1",
        category: "OTHER",
        description: null,
        isPinned: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        project: { id: PROJECT_ID, name: "P", status: ProjectStatus.ACTIVE, leaderId: LEADER_ID },
        sprint: null,
        uploadedBy: { id: LEADER_ID, fullName: "L", email: "l@akatsuki.local", avatarUrl: null },
      });
      expect(mappedDoc.url).toBeNull();

      const mappedProject = mapProjectToDTO({
        id: PROJECT_ID,
        name: "P",
        description: null,
        objectives: null,
        scope: null,
        startDate: new Date(),
        endDate: new Date(),
        status: ProjectStatus.ACTIVE,
        repositoryUrl: "javascript:alert(1)",
        technologies: [],
        templateId: null,
        template: null,
        leaderId: LEADER_ID,
        leader: { id: LEADER_ID, fullName: "L", email: "l@a.local", status: UserStatus.ACTIVE },
        instructorId: null,
        instructor: null,
        createdById: LEADER_ID,
        createdBy: { id: LEADER_ID, fullName: "L", email: "l@a.local", status: UserStatus.ACTIVE },
        _count: { members: 1 },
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(mappedProject.repositoryUrl).toBeNull();

      const mappedNotif = mapNotificationToDTO({
        id: "n-1",
        userId: LEADER_ID,
        actorId: null,
        projectId: PROJECT_ID,
        type: "SYSTEM",
        title: "T",
        message: "M",
        targetUrl: "//evil.com/phish",
        entityType: "System",
        entityId: "1",
        metadata: null,
        dedupKey: null,
        isRead: false,
        readAt: null,
        createdAt: new Date(),
        actor: null,
        project: null,
      });
      expect(mappedNotif.targetUrl).toBeNull();
    });
  });

  describe("SEC-06: Constant-Time-Aligned Dummy Bcrypt Check for Unknown Emails", () => {
    it("invokes verifyPassword even when email does not exist and returns identical INVALID_CREDENTIALS", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        authenticateCredentials({
          email: "unknown.account@akatsuki.local",
          password: "SomePassword@123",
        })
      ).rejects.toMatchObject({
        statusCode: 401,
        code: "INVALID_CREDENTIALS",
      });

      expect(verifyPasswordSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("SEC-07: CSP Nonce & HSTS Production Policy", () => {
    it("enforces strict script-src without unsafe-inline/unsafe-eval in prod and scopes HSTS strictly to Vercel production", () => {
      const devCsp = buildContentSecurityPolicy({ isProd: false, nonce: "abc123" });
      expect(devCsp).toContain("'unsafe-eval'");

      const prodCsp = buildContentSecurityPolicy({ isProd: true, nonce: "nonceB64==" });
      expect(prodCsp).toContain("script-src 'self' 'nonce-nonceB64=='");
      expect(prodCsp).not.toContain("script-src 'self' 'unsafe-inline'");
      expect(prodCsp).not.toContain("'unsafe-eval'");
      expect(prodCsp).toContain("style-src 'self' 'unsafe-inline'");
      expect(prodCsp).toContain("object-src 'none'");
      expect(prodCsp).toContain("frame-ancestors 'none'");

      // Local next start (NODE_ENV=production without VERCEL_ENV=production) must NOT emit HSTS
      expect(shouldEnableHsts({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "https://example.com" })).toBe(
        false
      );
      expect(
        shouldEnableHsts({ NODE_ENV: "production", VERCEL_ENV: "preview" })
      ).toBe(false);
      expect(
        shouldEnableHsts({ NODE_ENV: "production", VERCEL_ENV: "production" })
      ).toBe(true);

      const prodHeaders = buildSecurityHeaders({
        isProd: true,
        nonce: "n1",
        env: { NODE_ENV: "production", VERCEL_ENV: "production" },
      });
      const hsts = prodHeaders.find((h) => h.key === "Strict-Transport-Security");
      expect(hsts?.value).toBe("max-age=63072000");
    });
  });

  describe("SEC-08: DONE Task Read-Only Across All Mutations & Instructor Guard", () => {
    const doneTaskRow = {
      id: TASK_ID,
      projectId: PROJECT_ID,
      createdById: LEADER_ID,
      title: "Completed Task",
      description: "Done",
      priority: "HIGH",
      status: TaskStatus.DONE,
      startDate: null,
      deadline: new Date("2026-12-30T00:00:00Z"),
      estimateHours: 8,
      referenceLinks: [],
      progressNotes: "Initial",
      completedAt: new Date("2026-11-10T00:00:00Z"),
      updatedAt: new Date("2026-11-10T00:00:00Z"),
    };

    const activeProjectRow = {
      id: PROJECT_ID,
      status: ProjectStatus.ACTIVE,
      leaderId: LEADER_ID,
      instructorId: null,
      members: [],
    };

    it("rejects EVERY mutation targeting a DONE task with 409 TASK_ALREADY_COMPLETED", async () => {
      prismaMock.task.findUnique.mockResolvedValue(doneTaskRow);
      prismaMock.project.findUnique.mockResolvedValue(activeProjectRow);

      await expect(updateTaskService(leaderActor, TASK_ID, { title: "Edit" })).rejects.toMatchObject({
        statusCode: 409,
        code: "TASK_ALREADY_COMPLETED",
      });
      await expect(
        updateTaskService(leaderActor, TASK_ID, { progressNotes: "Post-done" })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "TASK_ALREADY_COMPLETED",
      });
      await expect(
        updateTaskService(leaderActor, TASK_ID, { referenceLinks: ["https://example.com"] })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "TASK_ALREADY_COMPLETED",
      });
      await expect(
        updateTaskStatusService(leaderActor, TASK_ID, TaskStatus.IN_PROGRESS)
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "TASK_ALREADY_COMPLETED",
      });
      await expect(submitTaskForReviewService(leaderActor, TASK_ID, {})).rejects.toMatchObject({
        statusCode: 409,
        code: "TASK_ALREADY_COMPLETED",
      });
      await expect(
        approveTaskReviewService(leaderActor, TASK_ID, { reason: "reapprove" })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "TASK_ALREADY_COMPLETED",
      });
      await expect(
        rejectTaskReviewService(leaderActor, TASK_ID, { reason: "reopen" })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "TASK_ALREADY_COMPLETED",
      });
      await expect(
        syncTaskAssigneesService(leaderActor, TASK_ID, { assigneeIds: [] })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "TASK_ALREADY_COMPLETED",
      });
      await expect(
        addTaskAssigneeService(leaderActor, TASK_ID, { userId: USER_2_ID })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "TASK_ALREADY_COMPLETED",
      });
      await expect(
        removeTaskAssigneeService(leaderActor, TASK_ID, USER_2_ID)
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "TASK_ALREADY_COMPLETED",
      });
      await expect(
        removeTaskDependencyService(leaderActor, TASK_ID, TASK_B_ID)
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "TASK_ALREADY_COMPLETED",
      });

      prismaMock.task.findUnique
        .mockResolvedValueOnce({ projectId: PROJECT_ID })
        .mockResolvedValueOnce(doneTaskRow)
        .mockResolvedValueOnce({ id: TASK_ID, status: TaskStatus.DONE })
        .mockResolvedValueOnce({
          id: TASK_B_ID,
          projectId: PROJECT_ID,
          title: "Done Pred",
          status: TaskStatus.DONE,
        });
      await expect(
        addTaskDependencyService(leaderActor, TASK_ID, { dependsOnTaskId: TASK_B_ID })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "TASK_ALREADY_COMPLETED",
      });
    });

    it("rejects setting instructorId === leaderId and invokes taskAssignmentGuard before promoting active Member to Instructor", async () => {
      prismaMock.project.findUnique.mockResolvedValue({
        id: PROJECT_ID,
        name: "Proj",
        description: null,
        objectives: null,
        scope: null,
        startDate: new Date("2026-11-01"),
        endDate: new Date("2026-12-30"),
        status: ProjectStatus.ACTIVE,
        repositoryUrl: null,
        technologies: [],
        templateId: null,
        template: null,
        leaderId: LEADER_ID,
        leader: { id: LEADER_ID, fullName: "L", email: "l@a.local", status: UserStatus.ACTIVE },
        instructorId: null,
        instructor: null,
        createdById: LEADER_ID,
        createdBy: { id: LEADER_ID, fullName: "L", email: "l@a.local", status: UserStatus.ACTIVE },
        _count: { members: 1 },
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        members: [],
      });

      await expect(
        updateProjectService(leaderActor, PROJECT_ID, { instructorId: LEADER_ID })
      ).rejects.toMatchObject({ statusCode: 409 });

      prismaMock.user.findMany.mockResolvedValueOnce([{ id: USER_2_ID, status: UserStatus.ACTIVE }]);
      prismaMock.projectMember.findFirst.mockResolvedValueOnce({
        id: "pm-2",
        projectRole: "MEMBER",
      });
      taskGuardMock.assertNoActiveProjectTasks.mockRejectedValueOnce(
        new Error("TASK_ASSIGNEE_REASSIGN_REQUIRED")
      );

      await expect(
        updateProjectService(leaderActor, PROJECT_ID, { instructorId: USER_2_ID })
      ).rejects.toThrow("TASK_ASSIGNEE_REASSIGN_REQUIRED");
      expect(taskGuardMock.assertNoActiveProjectTasks).toHaveBeenCalledWith(
        prismaMock,
        PROJECT_ID,
        USER_2_ID
      );
      expect(prismaMock.project.update).not.toHaveBeenCalled();
    });
  });

  describe("SEC-09: Project Candidates Minimal DTO & RBAC Filtering", () => {
    it("returns strictly { id, fullName } capped <= 50 and blocks unauthorized access", async () => {
      prismaMock.user.findMany.mockResolvedValueOnce([
        { id: USER_2_ID, fullName: "Instructor Candidate" },
      ]);

      // Reject excessive limit > 50 via Zod validation
      await expect(
        listProjectUserCandidatesService(leaderActor, {
          kind: "instructor",
          limit: "100",
        })
      ).rejects.toThrow();

      const result = await listProjectUserCandidatesService(leaderActor, {
        kind: "instructor",
        limit: "50",
      });
      expect(result).toEqual([{ id: USER_2_ID, fullName: "Instructor Candidate" }]);
      expect("email" in result[0]!).toBe(false);
      expect("roles" in result[0]!).toBe(false);
      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          select: { id: true, fullName: true },
        })
      );

      // Non-admin creator cannot enumerate Admin Leader options
      await expect(
        listProjectUserCandidatesService(leaderActor, { kind: "leader" })
      ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });

      // HTTP Route rejects unauthorized member query cleanly with no-store header
      prismaMock.user.findUnique.mockResolvedValue({
        id: USER_2_ID,
        email: "member@akatsuki.local",
        fullName: "Member",
        status: UserStatus.ACTIVE,
        tokenVersion: 0,
        userRoles: [{ role: { name: ROLES.MEMBER, rolePermissions: [] } }],
      });
      authMock.mockResolvedValue({ user: { id: USER_2_ID, tokenVersion: 0 } });
      const res = await projectCandidatesRouteGet(
        new NextRequest(`http://localhost/api/v1/projects/candidates?kind=member&projectId=${PROJECT_ID}`)
      );
      expect(res.status).toBe(403);
      expect(res.headers.get("cache-control")).toContain("no-store");
    });
  });

  describe("SEC-10 & SEC-11: API Cache-Control & Log Token/Cookie Redaction", () => {
    it("sets Cache-Control: no-store on apiSuccess / apiError and redacts Bearer/Cookie/Tokens in logger", async () => {
      const okRes = apiSuccess({ hello: "world" });
      expect(okRes.headers.get("cache-control")).toBe("no-store, max-age=0");

      const errRes = apiError(new Error("boom"));
      expect(errRes.headers.get("cache-control")).toBe("no-store, max-age=0");

      const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      logger.warn("Auth failure", {
        tokenVersion: 3,
        accessToken: "eyJabc.def.ghi",
        cookie: "authjs.session-token=secret123",
        note: "Header Bearer eyJsuper.secret.jwt leaked",
      });
      const serialized = String(spy.mock.calls[0]?.[0] ?? "");
      spy.mockRestore();

      expect(serialized).toContain('"tokenVersion":3');
      expect(serialized).toContain('"accessToken":"[REDACTED]"');
      expect(serialized).toContain('"cookie":"[REDACTED]"');
      expect(serialized).toContain("Bearer [REDACTED]");
      expect(serialized).not.toContain("secret123");
      expect(serialized).not.toContain("eyJsuper");
    });
  });
});
