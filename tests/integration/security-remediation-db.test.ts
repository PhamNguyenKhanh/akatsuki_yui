import { randomUUID } from "node:crypto";
import {
  ProjectMemberRole,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
  UserStatus,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import {
  RATE_LIMIT_SCOPES,
  consumeRateLimit,
  extractClientIpFromHeaders,
} from "@/lib/rate-limit";
import {
  authenticateCredentials,
  revokeUserSessionOnLogout,
} from "@/modules/auth/auth.service";
import { ROLES } from "@/modules/authorization/constants";
import { loadTrustedAuthContext } from "@/modules/authorization/policy.service";
import { addProjectMemberService } from "@/modules/project-members/member.service";
import {
  archiveProjectService,
  createProjectService,
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
import { createTaskService, updateTaskService } from "@/modules/tasks/task.service";
import {
  approveTaskReviewService,
  rejectTaskReviewService,
  submitTaskForReviewService,
  updateTaskStatusService,
} from "@/modules/tasks/task-workflow.service";
import { changeMyPasswordService } from "@/modules/users/user.service";
import type { AuthContext } from "@/types/auth";

const runTag = randomUUID().slice(0, 8);
const createdUserIds: string[] = [];
const createdProjectIds: string[] = [];
const displacedProjectIds: string[] = [];

async function createTestUser(
  prefix: string,
  roleName: (typeof ROLES)[keyof typeof ROLES],
  rawPassword = "SecTestPass@123"
) {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
  const passwordHash = await hashPassword(rawPassword);
  const user = await prisma.user.create({
    data: {
      email: `${prefix}.${runTag}@test.akatsuki.local`,
      fullName: `SecTest ${prefix} ${runTag}`,
      passwordHash,
      status: UserStatus.ACTIVE,
      approvedAt: new Date(),
      userRoles: {
        create: { roleId: role.id },
      },
    },
  });
  createdUserIds.push(user.id);
  return user;
}

describe("Security Remediation PostgreSQL Integration & Concurrency Tests", () => {
  let adminActor: AuthContext;
  let leaderActor: AuthContext;
  let memberActor: AuthContext;
  let member2Actor: AuthContext;
  let instructorUserId: string;

  beforeAll(async () => {
    const active = await prisma.project.findFirst({
      where: { status: ProjectStatus.ACTIVE },
      select: { id: true },
    });
    if (active) {
      displacedProjectIds.push(active.id);
      await prisma.project.update({
        where: { id: active.id },
        data: { status: ProjectStatus.CREATED },
      });
    }

    const [adminU, leaderU, memberU, member2U, instructorU] = await Promise.all([
      createTestUser("sec-admin", ROLES.ADMIN),
      createTestUser("sec-leader", ROLES.LEADER),
      createTestUser("sec-member1", ROLES.MEMBER),
      createTestUser("sec-member2", ROLES.MEMBER),
      createTestUser("sec-instructor", ROLES.INSTRUCTOR),
    ]);

    instructorUserId = instructorU.id;

    [adminActor, leaderActor, memberActor, member2Actor] = await Promise.all([
      loadTrustedAuthContext(adminU.id),
      loadTrustedAuthContext(leaderU.id),
      loadTrustedAuthContext(memberU.id),
      loadTrustedAuthContext(member2U.id),
    ]);
  });

  afterAll(async () => {
    await prisma.rateLimitEvent.deleteMany({
      where: {
        scope: {
          in: [
            RATE_LIMIT_SCOPES.AUTH_PASSWORD_CHANGE_USER,
            RATE_LIMIT_SCOPES.AUTH_LOGIN_IP,
            RATE_LIMIT_SCOPES.AUTH_LOGIN_FAIL,
          ],
        },
      },
    });
    await prisma.smtpQuotaAttempt.deleteMany({});

    if (createdProjectIds.length > 0) {
      await prisma.document.deleteMany({ where: { projectId: { in: createdProjectIds } } });
      await prisma.notification.deleteMany({ where: { projectId: { in: createdProjectIds } } });
      await prisma.activityLog.deleteMany({ where: { projectId: { in: createdProjectIds } } });
      await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
    }

    if (displacedProjectIds.length > 0) {
      await prisma.project.updateMany({
        where: { id: { in: displacedProjectIds } },
        data: { status: ProjectStatus.ACTIVE },
      });
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
  });

  it("SEC-01 + Race 1 & 7: revokes User.tokenVersion on logout, blocks stale JWT replay, and deduplicates concurrent logouts", async () => {
    const authUser = await createTestUser("logout-user", ROLES.MEMBER);
    const loggedIn = await authenticateCredentials({
      email: authUser.email,
      password: "SecTestPass@123",
    });
    expect(loggedIn.tokenVersion).toBe(0);

    // Pre-logout tokenVersion = 0 passes
    const ctxBefore = await loadTrustedAuthContext(authUser.id, { expectedTokenVersion: 0 });
    expect(ctxBefore.userId).toBe(authUser.id);

    // Race 7: Two concurrent logouts carrying expectedTokenVersion = 0 increment strictly once
    const logoutRace = await Promise.all([
      revokeUserSessionOnLogout({
        userId: authUser.id,
        email: authUser.email,
        expectedTokenVersion: 0,
      }),
      revokeUserSessionOnLogout({
        userId: authUser.id,
        email: authUser.email,
        expectedTokenVersion: 0,
      }),
    ]);

    expect(logoutRace.filter((r) => r.revoked)).toHaveLength(1);
    expect(logoutRace.filter((r) => !r.revoked)).toHaveLength(1);

    const dbAfterLogout = await prisma.user.findUniqueOrThrow({ where: { id: authUser.id } });
    expect(dbAfterLogout.tokenVersion).toBe(1);

    // Race 1 / Replay: stale tokenVersion = 0 is permanently rejected with 401 AUTH_REQUIRED
    await expect(
      loadTrustedAuthContext(authUser.id, { expectedTokenVersion: 0 })
    ).rejects.toMatchObject({
      statusCode: 401,
      code: "AUTH_REQUIRED",
    });

    // Fresh login gets updated tokenVersion = 1 and works cleanly
    const reLoggedIn = await authenticateCredentials({
      email: authUser.email,
      password: "SecTestPass@123",
    });
    expect(reLoggedIn.tokenVersion).toBe(1);
    const ctxAfterReLogin = await loadTrustedAuthContext(authUser.id, { expectedTokenVersion: 1 });
    expect(ctxAfterReLogin.userId).toBe(authUser.id);
  });

  it("SEC-02 + Race 2: serializes concurrent AUTH_PASSWORD_CHANGE_USER bursts regardless of spoofed IP headers", async () => {
    const pwdUser = await createTestUser("pwd-burst", ROLES.MEMBER, "OldPass@123");
    const pwdActor = await loadTrustedAuthContext(pwdUser.id);

    // Outside Vercel, spoofed headers resolve identically to "unknown"
    expect(
      extractClientIpFromHeaders(
        new Headers({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "5.6.7.8" })
      )
    ).toBe("unknown");

    // 7 parallel password-change calls (each with wrong currentPassword & distinct spoofed IP headers):
    // First 5 hit wrong currentPassword (400), calls 6-7 are rate-limited cleanly (429) by pg_advisory_xact_lock
    const attempts = await Promise.allSettled(
      Array.from({ length: 7 }, (_, i) =>
        changeMyPasswordService(
          pwdActor,
          {
            currentPassword: "WrongCurrent@123",
            newPassword: "NewStrongPass@123",
            confirmNewPassword: "NewStrongPass@123",
          },
          { headers: new Headers({ "x-forwarded-for": `198.51.100.${i + 1}` }) }
        )
      )
    );

    const errors = attempts
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => r.reason as AppError);
    expect(errors).toHaveLength(7);
    expect(errors.filter((e) => e.statusCode === 400)).toHaveLength(5);
    expect(errors.filter((e) => e.statusCode === 429 && e.code === "RATE_LIMIT_EXCEEDED")).toHaveLength(
      2
    );

    // Direct sliding window verification for custom limit stays bounded
    await expect(
      consumeRateLimit({
        scope: RATE_LIMIT_SCOPES.AUTH_PASSWORD_CHANGE_USER,
        identifier: pwdActor.userId,
      })
    ).rejects.toMatchObject({ statusCode: 429, code: "RATE_LIMIT_EXCEEDED" });
  });

  it("SEC-08 + Races 3, 4 & 5: enforces complete DONE immutability and serializes Approve vs Edit/Dep/Archive races", async () => {
    const project = await createProjectService(leaderActor, {
      name: `Sec08 Project ${runTag}`,
      startDate: new Date("2026-11-01T00:00:00Z"),
      endDate: new Date("2026-12-30T00:00:00Z"),
    });
    createdProjectIds.push(project.id);

    await addProjectMemberService(leaderActor, project.id, {
      userId: memberActor.userId,
      projectRole: ProjectMemberRole.MEMBER,
    });
    await addProjectMemberService(leaderActor, project.id, {
      userId: member2Actor.userId,
      projectRole: ProjectMemberRole.MEMBER,
    });

    const [doneTask, predTask, raceTask1, raceTask2, archiveRaceTask] = await Promise.all([
      createTaskService(leaderActor, project.id, {
        title: "Immutable Done Task",
        deadline: "2026-12-20T00:00:00.000Z",
        priority: TaskPriority.HIGH,
        assigneeIds: [memberActor.userId],
        progressNotes: "Final notes",
        referenceLinks: ["https://github.com/org/repo/pull/1"],
      }),
      createTaskService(leaderActor, project.id, {
        title: "Predecessor Task",
        deadline: "2026-12-20T00:00:00.000Z",
      }),
      createTaskService(leaderActor, project.id, {
        title: "Race Task Approve vs Edit",
        deadline: "2026-12-20T00:00:00.000Z",
        assigneeIds: [memberActor.userId],
      }),
      createTaskService(leaderActor, project.id, {
        title: "Race Task Approve vs Dep",
        deadline: "2026-12-20T00:00:00.000Z",
        assigneeIds: [memberActor.userId],
      }),
      createTaskService(leaderActor, project.id, {
        title: "Race Task Archive vs Assign",
        deadline: "2026-12-20T00:00:00.000Z",
      }),
    ]);

    // Move doneTask, raceTask1, raceTask2, predTask cleanly to REVIEW / DONE
    await updateTaskStatusService(memberActor, doneTask.id, TaskStatus.IN_PROGRESS);
    await submitTaskForReviewService(memberActor, doneTask.id, {});
    await approveTaskReviewService(leaderActor, doneTask.id, { reason: "Completed cleanly" });

    // Every direct mutation targeting DONE doneTask must fail 409 TASK_ALREADY_COMPLETED
    const rejectedMutations = await Promise.allSettled([
      updateTaskService(leaderActor, doneTask.id, { title: "Tampered Title" }),
      updateTaskService(leaderActor, doneTask.id, { progressNotes: "Tampered notes" }),
      updateTaskService(memberActor, doneTask.id, { referenceLinks: ["https://github.com/evil"] }),
      updateTaskStatusService(leaderActor, doneTask.id, TaskStatus.IN_PROGRESS),
      submitTaskForReviewService(memberActor, doneTask.id, {}),
      approveTaskReviewService(leaderActor, doneTask.id, { reason: "Reapprove" }),
      rejectTaskReviewService(leaderActor, doneTask.id, { reason: "Reopen" }),
      addTaskAssigneeService(leaderActor, doneTask.id, { userId: member2Actor.userId }),
      syncTaskAssigneesService(leaderActor, doneTask.id, { assigneeIds: [] }),
      removeTaskAssigneeService(leaderActor, doneTask.id, memberActor.userId),
      addTaskDependencyService(leaderActor, doneTask.id, { dependsOnTaskId: predTask.id }),
    ]);

    for (const res of rejectedMutations) {
      expect(res.status).toBe("rejected");
      if (res.status === "rejected") {
        expect((res.reason as AppError).statusCode).toBe(409);
        expect((res.reason as AppError).code).toBe("TASK_ALREADY_COMPLETED");
      }
    }

    // Even adding dependency on a non-existent edge to remove fails DONE check first
    await expect(
      removeTaskDependencyService(leaderActor, doneTask.id, predTask.id)
    ).rejects.toMatchObject({ statusCode: 409, code: "TASK_ALREADY_COMPLETED" });

    // Race 3: Concurrent approveTaskReviewService vs updateTaskService on REVIEW task
    await updateTaskStatusService(memberActor, raceTask1.id, TaskStatus.IN_PROGRESS);
    await submitTaskForReviewService(memberActor, raceTask1.id, {});

    const [approveRes3, updateRes3] = await Promise.allSettled([
      approveTaskReviewService(leaderActor, raceTask1.id, { reason: "Approve R3" }),
      updateTaskService(leaderActor, raceTask1.id, { progressNotes: "Concurrent update attempt" }),
    ]);
    expect(approveRes3.status).toBe("fulfilled");
    if (updateRes3.status === "rejected") {
      expect((updateRes3.reason as AppError).code).toBe("TASK_ALREADY_COMPLETED");
    } else {
      // If update committed BEFORE approve, subsequent DONE edit must still fail 409 TASK_ALREADY_COMPLETED
      await expect(
        updateTaskService(leaderActor, raceTask1.id, { progressNotes: "Post-DONE blocked" })
      ).rejects.toMatchObject({ statusCode: 409, code: "TASK_ALREADY_COMPLETED" });
    }

    // Race 4: Concurrent approveTaskReviewService vs addTaskDependencyService (incomplete predTask)
    await updateTaskStatusService(memberActor, raceTask2.id, TaskStatus.IN_PROGRESS);
    await submitTaskForReviewService(memberActor, raceTask2.id, {});

    const [approveRes4, depRes4] = await Promise.allSettled([
      approveTaskReviewService(leaderActor, raceTask2.id, { reason: "Approve R4" }),
      addTaskDependencyService(leaderActor, raceTask2.id, { dependsOnTaskId: predTask.id }),
    ]);
    const dbRaceTask2 = await prisma.task.findUniqueOrThrow({
      where: { id: raceTask2.id },
      include: { dependencies: true },
    });
    if (approveRes4.status === "fulfilled") {
      expect(dbRaceTask2.status).toBe(TaskStatus.DONE);
      // Either dep lost lock with TASK_ALREADY_COMPLETED (no dependency persisted) or ran BEFORE approve (meaning approve would fail TASK_DEPENDENCY_NOT_COMPLETED!)
      expect(dbRaceTask2.dependencies).toHaveLength(0);
      if (depRes4.status === "rejected") {
        expect((depRes4.reason as AppError).code).toBe("TASK_ALREADY_COMPLETED");
      }
    } else {
      expect((approveRes4.reason as AppError).code).toBe("TASK_DEPENDENCY_NOT_COMPLETED");
      expect(depRes4.status).toBe("fulfilled");
    }

    // Race 5: Concurrent archiveProjectService vs addTaskAssigneeService (no deadlock)
    const [archiveRes, assignRes] = await Promise.allSettled([
      archiveProjectService(leaderActor, project.id),
      addTaskAssigneeService(leaderActor, archiveRaceTask.id, { userId: memberActor.userId }),
    ]);
    expect(archiveRes.status).toBe("fulfilled");
    if (assignRes.status === "rejected") {
      expect((assignRes.reason as AppError).statusCode).toBe(409);
      expect((assignRes.reason as AppError).code).toBe("PROJECT_ARCHIVED");
    }
  });

  it("SEC-08 + Race 6 & SEC-09: guards instructor reassignment against active tasks and returns minimal Project candidates", async () => {
    const project = await createProjectService(leaderActor, {
      name: `Sec08-09 Project ${runTag}`,
      startDate: new Date("2026-11-01T00:00:00Z"),
      endDate: new Date("2026-12-30T00:00:00Z"),
    });
    createdProjectIds.push(project.id);

    await addProjectMemberService(leaderActor, project.id, {
      userId: memberActor.userId,
      projectRole: ProjectMemberRole.MEMBER,
    });

    // Reject assigning current Leader as Instructor
    await expect(
      updateProjectService(leaderActor, project.id, { instructorId: leaderActor.userId })
    ).rejects.toMatchObject({ statusCode: 409 });

    const task = await createTaskService(leaderActor, project.id, {
      title: "Member Active Task Blocking Instructor Promotion",
      deadline: "2026-12-20T00:00:00.000Z",
      assigneeIds: [memberActor.userId],
    });

    // Cannot promote active Task assignee to read-only INSTRUCTOR
    await expect(
      updateProjectService(leaderActor, project.id, { instructorId: memberActor.userId })
    ).rejects.toMatchObject({ statusCode: 409, code: "TASK_ASSIGNEE_REASSIGN_REQUIRED" });

    // Once task completes (DONE), promotion succeeds cleanly with 1 INSTRUCTOR membership and no duplicate rows
    await updateTaskStatusService(memberActor, task.id, TaskStatus.IN_PROGRESS);
    await submitTaskForReviewService(memberActor, task.id, {});
    await approveTaskReviewService(leaderActor, task.id, { reason: "Finish before instructor shift" });

    const updatedProj = await updateProjectService(leaderActor, project.id, {
      instructorId: memberActor.userId,
    });
    expect(updatedProj.instructorId).toBe(memberActor.userId);

    const activeMembershipsForPromoted = await prisma.projectMember.findMany({
      where: { projectId: project.id, userId: memberActor.userId, leftAt: null },
    });
    expect(activeMembershipsForPromoted).toHaveLength(1);
    expect(activeMembershipsForPromoted[0]!.projectRole).toBe(ProjectMemberRole.INSTRUCTOR);

    // Race 6: Concurrent updateProjectService (switch instructor to member2Actor) vs addTaskAssigneeService (assign member2Actor)
    const openTask = await createTaskService(leaderActor, project.id, {
      title: "Concurrent Instructor Promotion vs Task Assignment",
      deadline: "2026-12-20T00:00:00.000Z",
    });
    await addProjectMemberService(leaderActor, project.id, {
      userId: member2Actor.userId,
      projectRole: ProjectMemberRole.MEMBER,
    });

    const [promoteRaceRes, assignRaceRes] = await Promise.allSettled([
      updateProjectService(leaderActor, project.id, { instructorId: member2Actor.userId }),
      addTaskAssigneeService(leaderActor, openTask.id, { userId: member2Actor.userId }),
    ]);

    // Invariant: NEVER ends up with member2 both as INSTRUCTOR AND actively assigned to unfinished openTask!
    const finalProj = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
    const activeOpenAssignee = await prisma.taskAssignee.findFirst({
      where: { taskId: openTask.id, userId: member2Actor.userId, removedAt: null },
    });
    if (finalProj.instructorId === member2Actor.userId) {
      expect(promoteRaceRes.status).toBe("fulfilled");
      expect(activeOpenAssignee).toBeNull();
      expect(assignRaceRes.status).toBe("rejected");
    } else {
      expect(assignRaceRes.status).toBe("fulfilled");
      expect(activeOpenAssignee).not.toBeNull();
      expect(promoteRaceRes.status).toBe("rejected");
    }

    // SEC-09: Instructor candidate query returns strictly { id, fullName } without email or roles
    const instructorCandidates = await listProjectUserCandidatesService(adminActor, {
      kind: "instructor",
      limit: 50,
    });
    expect(instructorCandidates.some((c) => c.id === instructorUserId)).toBe(true);
    for (const candidate of instructorCandidates) {
      expect(Object.keys(candidate).sort()).toEqual(["fullName", "id"]);
    }

    // Non-leader project member cannot query project candidates
    await expect(
      listProjectUserCandidatesService(memberActor, {
        kind: "member",
        projectId: project.id,
      })
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
  });
});
