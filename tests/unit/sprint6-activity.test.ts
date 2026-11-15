import { ProjectStatus, TaskHistoryAction } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { forbiddenError, unauthorizedError } from "@/lib/errors";
import { PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import type { AuthContext } from "@/types/auth";

const { prismaMock, requireActiveUserMock } = vi.hoisted(() => {
  const txMock = {
    project: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    activityLog: {
      findMany: vi.fn(),
    },
    taskHistory: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  };
  return {
    prismaMock: txMock,
    requireActiveUserMock: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/modules/authorization/require-auth", () => ({
  requireActiveUser: requireActiveUserMock,
}));

import { NextRequest } from "next/server";
import { GET as getActivityRoute } from "@/app/api/v1/activity/route";
import { decodeActivityCursor, encodeActivityCursor } from "@/modules/activity/activity.schema";
import {
  activityRepository,
  compareActivityEntriesDesc,
} from "@/modules/activity/activity.repository";
import { listUnifiedActivityService } from "@/modules/activity/activity.service";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const LEADER_ID = "22222222-2222-4222-8222-222222222222";
const MEMBER_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_ID = "44444444-4444-4444-8444-444444444444";
const PROJ_A_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TASK_1_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function makeActor(
  id: string,
  role: (typeof ROLES)[keyof typeof ROLES],
  perms: string[]
): AuthContext {
  return {
    userId: id,
    email: `${role.toLowerCase()}@example.com`,
    fullName: `${role} User`,
    status: "ACTIVE",
    roles: [role],
    permissions: perms as AuthContext["permissions"],
  };
}

describe("Sprint 6 Package 2 — Unified Activity History & Cursor Pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("encodes, validates, and rejects malformed Base64url activity cursors (400)", () => {
    const timestamp = new Date("2026-11-15T10:00:00.123Z");
    const token = encodeActivityCursor({
      createdAt: timestamp,
      source: "WORKSPACE",
      id: ADMIN_ID,
    });

    const decoded = decodeActivityCursor(token);
    expect(decoded.createdAt.toISOString()).toBe("2026-11-15T10:00:00.123Z");
    expect(decoded.source).toBe("WORKSPACE");
    expect(decoded.id).toBe(ADMIN_ID);

    expect(() => decodeActivityCursor("not-valid-base64-json!!!")).toThrow(/Cursor/);
    const badSourceToken = Buffer.from(
      JSON.stringify({ createdAt: timestamp.toISOString(), source: "UNKNOWN", id: ADMIN_ID }),
      "utf8"
    ).toString("base64url");
    expect(() => decodeActivityCursor(badSourceToken)).toThrow(/Cursor/);

    const badDateToken = Buffer.from(
      JSON.stringify({ createdAt: "not-a-date", source: "TASK", id: ADMIN_ID }),
      "utf8"
    ).toString("base64url");
    expect(() => decodeActivityCursor(badDateToken)).toThrow(/Cursor/);
  });

  it("enforces deterministic ordering (createdAt DESC, source DESC, id DESC) and emits nextCursor from items[limit - 1]", async () => {
    const sameTs = new Date("2026-11-15T12:00:00.000Z");
    const olderTs = new Date("2026-11-15T11:59:00.000Z");

    expect(
      compareActivityEntriesDesc(
        { createdAt: sameTs, source: "WORKSPACE", id: "11111111-1111-4111-8111-111111111111" },
        { createdAt: sameTs, source: "TASK", id: "ffffffff-ffff-4fff-8fff-ffffffffffff" }
      )
    ).toBeLessThan(0); // WORKSPACE precedes TASK at same timestamp

    const admin = makeActor(ADMIN_ID, ROLES.ADMIN, [PERMISSIONS.ACTIVITY_READ]);

    // Simulate 2 items from WORKSPACE arm and 2 items from TASK arm -> total 4, limit = 2 -> nextCursor MUST come from index 1!
    prismaMock.activityLog.findMany.mockResolvedValue([
      {
        id: "aaaaaaaa-0000-4000-8000-000000000002",
        action: "PROJECT_ACTIVATED",
        entityType: "Project",
        entityId: PROJ_A_ID,
        projectId: PROJ_A_ID,
        description: "Activated project",
        createdAt: sameTs,
        user: { id: ADMIN_ID, fullName: "Admin", email: "admin@example.com" },
        project: { id: PROJ_A_ID, name: "Alpha", status: ProjectStatus.ACTIVE },
      },
      {
        id: "aaaaaaaa-0000-4000-8000-000000000001",
        action: "PROJECT_CREATED",
        entityType: "Project",
        entityId: PROJ_A_ID,
        projectId: PROJ_A_ID,
        description: "Created project",
        createdAt: olderTs,
        user: { id: ADMIN_ID, fullName: "Admin", email: "admin@example.com" },
        project: { id: PROJ_A_ID, name: "Alpha", status: ProjectStatus.ACTIVE },
      },
    ]);

    prismaMock.taskHistory.findMany.mockResolvedValue([
      {
        id: "bbbbbbbb-0000-4000-8000-000000000002",
        taskId: TASK_1_ID,
        action: TaskHistoryAction.REVIEW_APPROVED,
        fromStatus: "REVIEW",
        toStatus: "DONE",
        reason: "OK",
        createdAt: sameTs,
        actor: { id: LEADER_ID, fullName: "Leader", email: "leader@example.com" },
        task: {
          id: TASK_1_ID,
          title: "Design Schema",
          projectId: PROJ_A_ID,
          project: { id: PROJ_A_ID, name: "Alpha", status: ProjectStatus.ACTIVE },
        },
      },
      {
        id: "bbbbbbbb-0000-4000-8000-000000000001",
        taskId: TASK_1_ID,
        action: TaskHistoryAction.CREATED,
        fromStatus: null,
        toStatus: "TODO",
        reason: null,
        createdAt: olderTs,
        actor: { id: LEADER_ID, fullName: "Leader", email: "leader@example.com" },
        task: {
          id: TASK_1_ID,
          title: "Design Schema",
          projectId: PROJ_A_ID,
          project: { id: PROJ_A_ID, name: "Alpha", status: ProjectStatus.ACTIVE },
        },
      },
    ]);

    const feed = await listUnifiedActivityService(admin, { limit: "2" });

    expect(feed.items).toHaveLength(2);
    expect(feed.items[0].id).toBe("aaaaaaaa-0000-4000-8000-000000000002"); // WORKSPACE @ sameTs
    expect(feed.items[1].id).toBe("bbbbbbbb-0000-4000-8000-000000000002"); // TASK @ sameTs
    expect(feed.pageInfo.hasNextPage).toBe(true);
    expect(feed.pageInfo.nextCursor).not.toBeNull();

    const decodedNext = decodeActivityCursor(feed.pageInfo.nextCursor!);
    // Must point to items[1] (items[limit - 1]), NOT probe item at olderTs!
    expect(decodedNext.id).toBe("bbbbbbbb-0000-4000-8000-000000000002");
    expect(decodedNext.source).toBe("TASK");
    expect(decodedNext.createdAt.toISOString()).toBe(sameTs.toISOString());
  });

  it("isolates MEMBER visibility to self actions + assigned tasks only and blocks system logs (DEC-052)", async () => {
    const member = makeActor(MEMBER_ID, ROLES.MEMBER, [PERMISSIONS.ACTIVITY_READ]);

    prismaMock.project.findMany.mockResolvedValue([
      {
        id: PROJ_A_ID,
        leaderId: LEADER_ID,
        instructorId: null,
        members: [{ projectRole: "MEMBER" }],
      },
    ]);
    prismaMock.activityLog.findMany.mockResolvedValue([]);
    prismaMock.taskHistory.findMany.mockResolvedValue([]);

    const scope = await activityRepository.resolveVisibilityScope(member);
    expect(scope.adminViewAll).toBe(false);
    expect(scope.allowWorkspaceNullProject).toBe(false);
    expect(scope.fullProjectIds).toEqual([]);
    expect(scope.memberRestrictedProjectIds).toEqual([PROJ_A_ID]);

    await listUnifiedActivityService(member, {});

    const activityWhere = prismaMock.activityLog.findMany.mock.calls[0]?.[0]?.where;
    expect(JSON.stringify(activityWhere)).toContain(MEMBER_ID);
    expect(JSON.stringify(activityWhere)).not.toContain(`"projectId":null`);

    const taskHistoryWhere = prismaMock.taskHistory.findMany.mock.calls[0]?.[0]?.where;
    expect(JSON.stringify(taskHistoryWhere)).toContain(`"actorId":"${MEMBER_ID}"`);
    expect(JSON.stringify(taskHistoryWhere)).toContain(
      `"assignees":{"some":{"userId":"${MEMBER_ID}"}}`
    );
  });

  it("returns 400 on reversed date range (to < from) and skips TaskHistory arm cleanly on WORKSPACE-only action", async () => {
    const admin = makeActor(ADMIN_ID, ROLES.ADMIN, [PERMISSIONS.ACTIVITY_READ]);

    await expect(
      listUnifiedActivityService(admin, { from: "2026-11-15", to: "2026-11-10" })
    ).rejects.toThrow(/to/);

    prismaMock.activityLog.findMany.mockResolvedValue([]);
    await listUnifiedActivityService(admin, { action: "PROJECT_CREATED" });

    expect(prismaMock.activityLog.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.taskHistory.findMany).not.toHaveBeenCalled();
  });

  it("handles GET /api/v1/activity HTTP contracts (401, 403, 400, 200)", async () => {
    requireActiveUserMock.mockRejectedValueOnce(unauthorizedError());
    const res401 = await getActivityRoute(new NextRequest("http://localhost:3000/api/v1/activity"));
    expect(res401.status).toBe(401);

    requireActiveUserMock.mockResolvedValueOnce(makeActor(OTHER_ID, ROLES.MEMBER, []));
    const res403 = await getActivityRoute(new NextRequest("http://localhost:3000/api/v1/activity"));
    expect(res403.status).toBe(403);

    const admin = makeActor(ADMIN_ID, ROLES.ADMIN, [PERMISSIONS.ACTIVITY_READ]);
    requireActiveUserMock.mockResolvedValueOnce(admin);
    const res400 = await getActivityRoute(
      new NextRequest("http://localhost:3000/api/v1/activity?cursor=broken-token")
    );
    expect(res400.status).toBe(400);

    requireActiveUserMock.mockResolvedValueOnce(admin);
    prismaMock.activityLog.findMany.mockResolvedValue([]);
    prismaMock.taskHistory.findMany.mockResolvedValue([]);
    const res200 = await getActivityRoute(
      new NextRequest("http://localhost:3000/api/v1/activity?limit=10")
    );
    expect(res200.status).toBe(200);
    const body = await res200.json();
    expect(body.data.items).toEqual([]);
    expect(body.data.pageInfo.limit).toBe(10);

    // Explicitly verify assertProjectReadAccess denial bubbles as 403
    requireActiveUserMock.mockResolvedValueOnce(
      makeActor(MEMBER_ID, ROLES.MEMBER, [PERMISSIONS.ACTIVITY_READ])
    );
    prismaMock.project.findUnique.mockResolvedValueOnce({
      id: PROJ_A_ID,
      name: "Secret",
      status: ProjectStatus.ACTIVE,
      leaderId: LEADER_ID,
      instructorId: null,
      members: [],
    });
    const resProject403 = await getActivityRoute(
      new NextRequest(`http://localhost:3000/api/v1/activity?projectId=${PROJ_A_ID}`)
    );
    expect(resProject403.status).toBe(403);
    void forbiddenError;
  });
});
