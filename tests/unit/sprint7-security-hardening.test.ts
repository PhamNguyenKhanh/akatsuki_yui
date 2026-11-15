import { UserStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { findUniqueMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: findUniqueMock,
    },
  },
}));

import { logger } from "@/lib/logger";
import { parseJsonBody } from "@/lib/request";
import { getSafeCallbackUrl } from "@/lib/safe-redirect";
import { isSafeHttpUrl } from "@/lib/validations/common";
import { PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import { loadTrustedAuthContext } from "@/modules/authorization/policy.service";
import { createProjectTemplateSchema } from "@/modules/project-templates/template.schema";
import { createProjectTemplateService } from "@/modules/project-templates/template.service";
import { completeSprintSchema } from "@/modules/sprints/sprint.schema";
import type { AuthContext } from "@/types/auth";

describe("Sprint 7 Security Hardening Suite", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
  });

  it("revokes JWT sessions immediately when DB User.tokenVersion mismatches JWT tokenVersion", async () => {
    findUniqueMock.mockResolvedValue({
      id: "u-1",
      email: "member@akatsuki.local",
      fullName: "Member",
      status: UserStatus.ACTIVE,
      tokenVersion: 2,
      userRoles: [],
    });

    await expect(
      loadTrustedAuthContext("u-1", { expectedTokenVersion: 1 })
    ).rejects.toMatchObject({
      statusCode: 401,
      code: "AUTH_REQUIRED",
    });

    const valid = await loadTrustedAuthContext("u-1", { expectedTokenVersion: 2 });
    expect(valid.userId).toBe("u-1");
  });

  it("blocks open redirects via getSafeCallbackUrl including protocol-relative, backslash, external & CRLF URLs", () => {
    expect(getSafeCallbackUrl(undefined)).toBe("/dashboard");
    expect(getSafeCallbackUrl("https://evil.example/steal")).toBe("/dashboard");
    expect(getSafeCallbackUrl("//evil.example")).toBe("/dashboard");
    expect(getSafeCallbackUrl("/\\evil.example")).toBe("/dashboard");
    expect(getSafeCallbackUrl("/login")).toBe("/dashboard");
    expect(getSafeCallbackUrl("/dashboard\r\nSet-Cookie: a=b")).toBe("/dashboard");
    expect(getSafeCallbackUrl("/projects/abc/tasks?view=kanban#top")).toBe(
      "/projects/abc/tasks?view=kanban#top"
    );
  });

  it("rejects JSON payloads larger than 64 KB with 413 PAYLOAD_TOO_LARGE even without Content-Length", async () => {
    const oversizedPayload = JSON.stringify({ data: "a".repeat(70 * 1024) });
    const reqWithoutLength = new Request("http://localhost/api/test", {
      method: "POST",
      body: oversizedPayload,
    });

    await expect(parseJsonBody(reqWithoutLength)).rejects.toMatchObject({
      statusCode: 413,
      code: "PAYLOAD_TOO_LARGE",
    });
  });

  it("enforces PROJECT_TEMPLATE_MANAGE permission and rejects Leader lacking it (403 FORBIDDEN)", async () => {
    const leaderWithoutTemplatePerm: AuthContext = {
      userId: "leader-1",
      email: "leader@akatsuki.local",
      fullName: "Leader",
      status: UserStatus.ACTIVE,
      roles: [ROLES.LEADER],
      permissions: [PERMISSIONS.PROJECT_CREATE, PERMISSIONS.PROJECT_READ],
    };

    await expect(
      createProjectTemplateService(leaderWithoutTemplatePerm, { name: "Blocked Template" })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
  });

  it("rejects oversized template JSON configs (>16 KB), taskDispositions (>250), and embedded URL credentials", () => {
    const bigTemplate = createProjectTemplateSchema.safeParse({
      name: "Huge Template",
      configuration: { blob: "x".repeat(18 * 1024) },
    });
    expect(bigTemplate.success).toBe(false);

    const dispositions = Array.from({ length: 251 }, (_, idx) => ({
      taskId: `00000000-0000-4000-8000-${String(idx + 1).padStart(12, "0")}`,
      action: "MOVE_TO_BACKLOG" as const,
    }));
    const oversizedComplete = completeSprintSchema.safeParse({
      taskDispositions: dispositions,
    });
    expect(oversizedComplete.success).toBe(false);

    expect(isSafeHttpUrl("https://user:pass@github.com/org/repo")).toBe(false);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("https://github.com/org/repo")).toBe(true);
  });

  it("masks email PII and scrubs DB connection URLs from structured logs", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    try {
      logger.info("Test audit", {
        email: "nhat.secret@example.com",
        recipientEmail: "receiver@akatsuki.local",
        smtpPass: "super-secret",
        note: "failed connecting postgresql://user:pass@host:5432/prod_db",
      });
      const loggedLine = spy.mock.calls[0]?.[0] as string;
      expect(loggedLine).not.toContain("nhat.secret@example.com");
      expect(loggedLine).not.toContain("receiver@akatsuki.local");
      expect(loggedLine).not.toContain("super-secret");
      expect(loggedLine).not.toContain("postgresql://");
      expect(loggedLine).toContain("nh***@example.com");
      expect(loggedLine).toContain("[REDACTED_DB_URL]");
    } finally {
      spy.mockRestore();
    }
  });
});
