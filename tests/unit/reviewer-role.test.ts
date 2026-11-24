import { ProjectMemberRole, UserStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { PERMISSIONS, ROLE_DEFINITIONS, ROLES } from "@/modules/authorization/constants";
import {
  addProjectMemberSchema,
  isAssignableProjectRole,
} from "@/modules/project-members/member.schema";
import { isProjectReviewerOrLeaderOrAdmin } from "@/modules/tasks/task.access";
import type { AuthContext } from "@/types/auth";

function makeActor(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "00000000-0000-4000-8000-000000000010",
    email: "reviewer@example.com",
    fullName: "Reviewer User",
    status: UserStatus.ACTIVE,
    roles: [ROLES.REVIEWER],
    permissions: [...ROLE_DEFINITIONS.REVIEWER.permissions],
    ...overrides,
  };
}

describe("REVIEWER role", () => {
  it("grants read + review permissions and excludes task/sprint/member write permissions", () => {
    const perms = ROLE_DEFINITIONS.REVIEWER.permissions;

    expect(perms).toContain(PERMISSIONS.TASK_REVIEW);
    expect(perms).toContain(PERMISSIONS.TASK_READ);
    expect(perms).toContain(PERMISSIONS.TASK_HISTORY_READ);
    expect(perms).toContain(PERMISSIONS.PROJECT_READ);
    expect(perms).toContain(PERMISSIONS.SPRINT_READ);
    expect(perms).toContain(PERMISSIONS.DOCUMENT_READ);

    expect(perms).not.toContain(PERMISSIONS.TASK_CREATE);
    expect(perms).not.toContain(PERMISSIONS.TASK_UPDATE);
    expect(perms).not.toContain(PERMISSIONS.TASK_ASSIGN);
    expect(perms).not.toContain(PERMISSIONS.SPRINT_MANAGE);
    expect(perms).not.toContain(PERMISSIONS.PROJECT_MEMBER_MANAGE);
  });

  it("allows REVIEWER in addProjectMemberSchema and excludes REVIEWER & INSTRUCTOR from task assignment", () => {
    const parsed = addProjectMemberSchema.safeParse({
      userId: "00000000-0000-4000-8000-000000000020",
      projectRole: ProjectMemberRole.REVIEWER,
    });
    expect(parsed.success).toBe(true);

    expect(isAssignableProjectRole(ProjectMemberRole.LEADER)).toBe(true);
    expect(isAssignableProjectRole(ProjectMemberRole.MEMBER)).toBe(true);
    expect(isAssignableProjectRole(ProjectMemberRole.REVIEWER)).toBe(false);
    expect(isAssignableProjectRole(ProjectMemberRole.INSTRUCTOR)).toBe(false);
  });

  it("grants project review access to LEADER, ADMIN, and REVIEWER members, but not MEMBER or INSTRUCTOR", () => {
    const actor = makeActor();
    const leaderId = "00000000-0000-4000-8000-000000000001";

    expect(
      isProjectReviewerOrLeaderOrAdmin(actor, {
        leaderId,
        members: [{ projectRole: ProjectMemberRole.REVIEWER }],
      })
    ).toBe(true);

    expect(
      isProjectReviewerOrLeaderOrAdmin(actor, {
        leaderId,
        members: [{ projectRole: ProjectMemberRole.MEMBER }],
      })
    ).toBe(false);

    expect(
      isProjectReviewerOrLeaderOrAdmin(actor, {
        leaderId,
        members: [{ projectRole: ProjectMemberRole.INSTRUCTOR }],
      })
    ).toBe(false);
  });
});
