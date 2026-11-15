import "server-only";
import {
  ProjectMemberRole,
  TaskHistoryAction,
  type Prisma,
  type ProjectStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseHcmDateBounds } from "@/lib/timezone";
import { buildAccessibleProjectsWhere, isWorkspaceAdmin } from "@/modules/projects/project.access";
import {
  TASK_HISTORY_ACTION_SET,
  encodeActivityCursor,
  type ActivityRecordSource,
  type DecodedActivityCursor,
  type ParsedActivityQuery,
} from "@/modules/activity/activity.schema";
import type { AuthContext } from "@/types/auth";

export interface ActivityActorDTO {
  id: string;
  fullName: string;
  email: string;
}

export interface ActivityEntryDTO {
  id: string;
  cursorKey: string;
  source: ActivityRecordSource;
  entityType: string;
  entityId: string | null;
  projectId: string | null;
  projectName: string | null;
  projectStatus: ProjectStatus | null;
  action: string;
  actor: ActivityActorDTO | null;
  summary: string;
  targetUrl: string | null;
  createdAt: string;
}

export interface ActivityVisibilityScope {
  adminViewAll: boolean;
  allowWorkspaceNullProject: boolean;
  fullProjectIds: string[] | null; // null means unrestricted across all projects (Admin)
  memberRestrictedProjectIds: string[];
}

interface InternalSortableActivityEntry extends ActivityEntryDTO {
  _createdAtDate: Date;
}

function formatTaskHistorySummary(row: {
  action: TaskHistoryAction;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  task: { title: string };
}): string {
  const title = row.task.title;
  switch (row.action) {
    case TaskHistoryAction.CREATED:
      return `Tạo Task "${title}"`;
    case TaskHistoryAction.STATUS_CHANGED:
      return `Đổi trạng thái Task "${title}" (${row.fromStatus ?? "?"} → ${row.toStatus ?? "?"})`;
    case TaskHistoryAction.INFO_UPDATED:
      return `Cập nhật thông tin Task "${title}"`;
    case TaskHistoryAction.PROGRESS_UPDATED:
      return `Cập nhật tiến độ / tài liệu tham khảo cho Task "${title}"`;
    case TaskHistoryAction.ASSIGNEE_ADDED:
      return `Thêm người thực hiện vào Task "${title}"`;
    case TaskHistoryAction.ASSIGNEE_REMOVED:
      return `Gỡ người thực hiện khỏi Task "${title}"`;
    case TaskHistoryAction.REVIEW_SUBMITTED:
      return `Gửi Task "${title}" chờ Review`;
    case TaskHistoryAction.REVIEW_APPROVED:
      return row.reason
        ? `Phê duyệt Review Task "${title}": ${row.reason}`
        : `Phê duyệt Review Task "${title}"`;
    case TaskHistoryAction.REVIEW_REJECTED:
      return row.reason
        ? `Từ chối Review Task "${title}": ${row.reason}`
        : `Từ chối Review Task "${title}"`;
    case TaskHistoryAction.DEPENDENCY_ADDED:
      return `Thêm phụ thuộc công việc cho Task "${title}"`;
    case TaskHistoryAction.DEPENDENCY_REMOVED:
      return `Gỡ phụ thuộc công việc khỏi Task "${title}"`;
    case TaskHistoryAction.SPRINT_ASSIGNED:
      return `Đưa Task "${title}" vào Sprint`;
    case TaskHistoryAction.SPRINT_REMOVED:
      return `Đưa Task "${title}" ra khỏi Sprint`;
    case TaskHistoryAction.SPRINT_MOVED:
      return `Chuyển Task "${title}" sang Sprint khác`;
    default:
      return `Cập nhật Task "${title}" (${row.action})`;
  }
}

export function buildActivityTargetUrl(params: {
  entityType: string;
  entityId: string | null;
  projectId: string | null;
  taskId?: string | null;
}): string | null {
  const { entityType, entityId, projectId, taskId } = params;
  if (entityType === "Task" && projectId && (taskId ?? entityId)) {
    return `/projects/${projectId}/tasks/${taskId ?? entityId}`;
  }
  if (entityType === "Sprint" && projectId && entityId) {
    return `/projects/${projectId}/sprints/${entityId}`;
  }
  if (entityType === "Document" && projectId) {
    return `/projects/${projectId}/documents`;
  }
  if (entityType === "Project" && (projectId ?? entityId)) {
    return `/projects/${projectId ?? entityId}`;
  }
  if (entityType === "ProjectMember" && projectId) {
    return `/projects/${projectId}`;
  }
  if (entityType === "User") {
    return "/admin/users";
  }
  if (entityType === "Role") {
    return "/admin/roles";
  }
  if (entityType === "ProjectTemplate") {
    return "/admin/templates";
  }
  return null;
}

export function compareActivityEntriesDesc(
  a: { createdAt: Date | string; source: ActivityRecordSource; id: string },
  b: { createdAt: Date | string; source: ActivityRecordSource; id: string }
): number {
  const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : Date.parse(a.createdAt);
  const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : Date.parse(b.createdAt);
  if (timeB !== timeA) {
    return timeB - timeA;
  }

  if (a.source !== b.source) {
    // "WORKSPACE" > "TASK" lexicographically; DESC places "WORKSPACE" before "TASK"
    return b.source > a.source ? 1 : -1;
  }

  if (a.id === b.id) {
    return 0;
  }
  return b.id > a.id ? 1 : -1;
}

export const activityRepository = {
  async resolveVisibilityScope(
    actor: AuthContext,
    requestedProjectId?: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<ActivityVisibilityScope> {
    if (isWorkspaceAdmin(actor)) {
      return {
        adminViewAll: true,
        allowWorkspaceNullProject: !requestedProjectId,
        fullProjectIds: requestedProjectId ? [requestedProjectId] : null,
        memberRestrictedProjectIds: [],
      };
    }

    const accessibleProjects = await tx.project.findMany({
      where: {
        ...buildAccessibleProjectsWhere(actor),
        ...(requestedProjectId ? { id: requestedProjectId } : {}),
      },
      select: {
        id: true,
        leaderId: true,
        instructorId: true,
        members: {
          where: {
            userId: actor.userId,
            leftAt: null,
          },
          select: {
            projectRole: true,
          },
        },
      },
    });

    const fullProjectIds: string[] = [];
    const memberRestrictedProjectIds: string[] = [];

    for (const proj of accessibleProjects) {
      const hasFullRole =
        proj.leaderId === actor.userId ||
        proj.instructorId === actor.userId ||
        proj.members.some(
          (m) =>
            m.projectRole === ProjectMemberRole.LEADER ||
            m.projectRole === ProjectMemberRole.INSTRUCTOR
        );

      if (hasFullRole) {
        fullProjectIds.push(proj.id);
      } else {
        memberRestrictedProjectIds.push(proj.id);
      }
    }

    return {
      adminViewAll: false,
      allowWorkspaceNullProject: false,
      fullProjectIds,
      memberRestrictedProjectIds,
    };
  },

  async findAccessibleProjectsForFilter(
    actor: AuthContext,
    tx: Prisma.TransactionClient = prisma
  ): Promise<Array<{ id: string; name: string; status: ProjectStatus }>> {
    return tx.project.findMany({
      where: buildAccessibleProjectsWhere(actor),
      select: {
        id: true,
        name: true,
        status: true,
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    });
  },

  async findActorOptionsForFilter(
    actor: AuthContext,
    scope: ActivityVisibilityScope,
    tx: Prisma.TransactionClient = prisma
  ): Promise<Array<{ id: string; fullName: string; email: string }>> {
    if (scope.adminViewAll) {
      return tx.user.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, fullName: true, email: true },
        orderBy: { fullName: "asc" },
      });
    }

    const fullIds = scope.fullProjectIds ?? [];
    const restrictedIds = scope.memberRestrictedProjectIds;
    if (fullIds.length === 0) {
      // Pure MEMBER visibility: expose self plus actors on Tasks assigned to self inside
      // restricted Projects without enumerating unrelated peers (DEC-052).
      return tx.user.findMany({
        where: {
          OR: [
            { id: actor.userId },
            ...(restrictedIds.length > 0
              ? [
                  {
                    taskHistoryEntries: {
                      some: {
                        task: {
                          projectId: { in: restrictedIds },
                          assignees: { some: { userId: actor.userId } },
                        },
                      },
                    },
                  },
                ]
              : []),
          ],
        },
        select: { id: true, fullName: true, email: true },
        orderBy: { fullName: "asc" },
      });
    }

    return tx.user.findMany({
      where: {
        OR: [
          { id: actor.userId },
          { projectMemberships: { some: { projectId: { in: fullIds } } } },
          { ledProjects: { some: { id: { in: fullIds } } } },
          { instructedProjects: { some: { id: { in: fullIds } } } },
          ...(restrictedIds.length > 0
            ? [
                {
                  taskHistoryEntries: {
                    some: {
                      task: {
                        projectId: { in: restrictedIds },
                        assignees: { some: { userId: actor.userId } },
                      },
                    },
                  },
                },
              ]
            : []),
        ],
      },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: "asc" },
    });
  },

  async queryUnifiedFeed(
    actor: AuthContext,
    scope: ActivityVisibilityScope,
    query: ParsedActivityQuery,
    cursor?: DecodedActivityCursor,
    tx: Prisma.TransactionClient = prisma
  ): Promise<{
    items: ActivityEntryDTO[];
    pageInfo: {
      nextCursor: string | null;
      hasNextPage: boolean;
      limit: number;
    };
  }> {
    const hasNoAccessibleScope =
      !scope.adminViewAll &&
      (scope.fullProjectIds?.length ?? 0) === 0 &&
      scope.memberRestrictedProjectIds.length === 0;

    if (hasNoAccessibleScope) {
      return {
        items: [],
        pageInfo: {
          nextCursor: null,
          hasNextPage: false,
          limit: query.limit,
        },
      };
    }

    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (query.from) {
      createdAtFilter.gte = parseHcmDateBounds(query.from, query.from).fromUtc;
    }
    if (query.to) {
      createdAtFilter.lte = parseHcmDateBounds(query.to, query.to).toUtc;
    }
    const hasCreatedAtFilter = query.from !== undefined || query.to !== undefined;

    const shouldQueryWorkspaceArm = query.source !== "TASK" && query.entityType !== "Task";
    const shouldQueryTaskArm =
      query.source !== "WORKSPACE" &&
      (query.entityType === undefined || query.entityType === "Task") &&
      (!query.action || TASK_HISTORY_ACTION_SET.has(query.action));

    const takeCount = query.limit + 1;

    const workspacePromise = shouldQueryWorkspaceArm
      ? this.queryWorkspaceArm(
          actor,
          scope,
          query,
          createdAtFilter,
          hasCreatedAtFilter,
          cursor,
          takeCount,
          tx
        )
      : Promise.resolve([] as InternalSortableActivityEntry[]);

    const taskPromise = shouldQueryTaskArm
      ? this.queryTaskArm(
          actor,
          scope,
          query,
          createdAtFilter,
          hasCreatedAtFilter,
          cursor,
          takeCount,
          tx
        )
      : Promise.resolve([] as InternalSortableActivityEntry[]);

    const [workspaceRows, taskRows] = await Promise.all([workspacePromise, taskPromise]);

    const merged = [...workspaceRows, ...taskRows].sort((a, b) =>
      compareActivityEntriesDesc(
        { createdAt: a._createdAtDate, source: a.source, id: a.id },
        { createdAt: b._createdAtDate, source: b.source, id: b.id }
      )
    );

    const hasNextPage = merged.length > query.limit;
    const sliced = merged.slice(0, query.limit);
    const items: ActivityEntryDTO[] = sliced.map(({ _createdAtDate: _ignored, ...dto }) => dto);

    const lastReturned = sliced[sliced.length - 1];
    const nextCursor =
      hasNextPage && lastReturned
        ? encodeActivityCursor({
            createdAt: lastReturned._createdAtDate,
            source: lastReturned.source,
            id: lastReturned.id,
          })
        : null;

    return {
      items,
      pageInfo: {
        nextCursor,
        hasNextPage,
        limit: query.limit,
      },
    };
  },

  async queryWorkspaceArm(
    actor: AuthContext,
    scope: ActivityVisibilityScope,
    query: ParsedActivityQuery,
    createdAtFilter: Prisma.DateTimeFilter,
    hasCreatedAtFilter: boolean,
    cursor: DecodedActivityCursor | undefined,
    takeCount: number,
    tx: Prisma.TransactionClient
  ): Promise<InternalSortableActivityEntry[]> {
    const scopeOrBranches: Prisma.ActivityLogWhereInput[] = [];

    if (scope.fullProjectIds === null) {
      // Workspace Admin unrestricted project visibility
      if (query.projectId) {
        scopeOrBranches.push({ projectId: query.projectId });
      } else {
        scopeOrBranches.push({ projectId: { not: null } });
      }
    } else if (scope.fullProjectIds.length > 0) {
      scopeOrBranches.push({ projectId: { in: scope.fullProjectIds } });
    }

    if (scope.memberRestrictedProjectIds.length > 0) {
      scopeOrBranches.push({
        projectId: { in: scope.memberRestrictedProjectIds },
        userId: actor.userId,
      });
    }

    if (scope.allowWorkspaceNullProject && !query.projectId) {
      scopeOrBranches.push({ projectId: null });
    }

    if (scopeOrBranches.length === 0) {
      return [];
    }

    const andConditions: Prisma.ActivityLogWhereInput[] = [{ OR: scopeOrBranches }];

    if (query.projectId) {
      andConditions.push({ projectId: query.projectId });
    }
    if (query.entityType) {
      andConditions.push({ entityType: query.entityType });
    }
    if (query.userId) {
      andConditions.push({ userId: query.userId });
    }
    if (query.action) {
      andConditions.push({ action: query.action });
    }
    if (hasCreatedAtFilter) {
      andConditions.push({ createdAt: createdAtFilter });
    }
    if (query.search) {
      andConditions.push({
        OR: [
          { description: { contains: query.search, mode: "insensitive" } },
          { action: { contains: query.search, mode: "insensitive" } },
        ],
      });
    }
    if (cursor) {
      if (cursor.source === "WORKSPACE") {
        andConditions.push({
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { AND: [{ createdAt: cursor.createdAt }, { id: { lt: cursor.id } }] },
          ],
        });
      } else {
        // Since "WORKSPACE" > "TASK", rows at exact cursor.createdAt on WORKSPACE already preceded TASK cursor
        andConditions.push({ createdAt: { lt: cursor.createdAt } });
      }
    }

    const rows = await tx.activityLog.findMany({
      where: { AND: andConditions },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: takeCount,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        projectId: true,
        description: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      cursorKey: encodeActivityCursor({
        createdAt: row.createdAt,
        source: "WORKSPACE",
        id: row.id,
      }),
      source: "WORKSPACE",
      entityType: row.entityType,
      entityId: row.entityId,
      projectId: row.projectId,
      projectName: row.project?.name ?? null,
      projectStatus: row.project?.status ?? null,
      action: row.action,
      actor: row.user,
      summary: row.description ?? `${row.action} (${row.entityType})`,
      targetUrl: buildActivityTargetUrl({
        entityType: row.entityType,
        entityId: row.entityId,
        projectId: row.projectId,
      }),
      createdAt: row.createdAt.toISOString(),
      _createdAtDate: row.createdAt,
    }));
  },

  async queryTaskArm(
    actor: AuthContext,
    scope: ActivityVisibilityScope,
    query: ParsedActivityQuery,
    createdAtFilter: Prisma.DateTimeFilter,
    hasCreatedAtFilter: boolean,
    cursor: DecodedActivityCursor | undefined,
    takeCount: number,
    tx: Prisma.TransactionClient
  ): Promise<InternalSortableActivityEntry[]> {
    const scopeOrBranches: Prisma.TaskHistoryWhereInput[] = [];

    if (scope.fullProjectIds === null) {
      if (query.projectId) {
        scopeOrBranches.push({ task: { projectId: query.projectId } });
      } else {
        scopeOrBranches.push({});
      }
    } else if (scope.fullProjectIds.length > 0) {
      scopeOrBranches.push({ task: { projectId: { in: scope.fullProjectIds } } });
    }

    if (scope.memberRestrictedProjectIds.length > 0) {
      scopeOrBranches.push({
        task: { projectId: { in: scope.memberRestrictedProjectIds } },
        OR: [
          { actorId: actor.userId },
          { task: { assignees: { some: { userId: actor.userId } } } },
        ],
      });
    }

    if (scopeOrBranches.length === 0) {
      return [];
    }

    const andConditions: Prisma.TaskHistoryWhereInput[] = [{ OR: scopeOrBranches }];

    if (query.projectId) {
      andConditions.push({ task: { projectId: query.projectId } });
    }
    if (query.userId) {
      andConditions.push({ actorId: query.userId });
    }
    if (query.action) {
      andConditions.push({ action: query.action as TaskHistoryAction });
    }
    if (hasCreatedAtFilter) {
      andConditions.push({ createdAt: createdAtFilter });
    }
    if (query.search) {
      andConditions.push({
        OR: [
          { reason: { contains: query.search, mode: "insensitive" } },
          { task: { title: { contains: query.search, mode: "insensitive" } } },
        ],
      });
    }
    if (cursor) {
      if (cursor.source === "WORKSPACE") {
        // Since "TASK" < "WORKSPACE", TaskHistory rows at exact cursor.createdAt come strictly after WORKSPACE cursor
        andConditions.push({ createdAt: { lte: cursor.createdAt } });
      } else {
        andConditions.push({
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { AND: [{ createdAt: cursor.createdAt }, { id: { lt: cursor.id } }] },
          ],
        });
      }
    }

    const rows = await tx.taskHistory.findMany({
      where: { AND: andConditions },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: takeCount,
      select: {
        id: true,
        taskId: true,
        action: true,
        fromStatus: true,
        toStatus: true,
        reason: true,
        createdAt: true,
        actor: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            projectId: true,
            project: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      cursorKey: encodeActivityCursor({
        createdAt: row.createdAt,
        source: "TASK",
        id: row.id,
      }),
      source: "TASK",
      entityType: "Task",
      entityId: row.taskId,
      projectId: row.task.projectId,
      projectName: row.task.project.name,
      projectStatus: row.task.project.status,
      action: row.action,
      actor: row.actor,
      summary: formatTaskHistorySummary(row),
      targetUrl: buildActivityTargetUrl({
        entityType: "Task",
        entityId: row.taskId,
        projectId: row.task.projectId,
        taskId: row.taskId,
      }),
      createdAt: row.createdAt.toISOString(),
      _createdAtDate: row.createdAt,
    }));
  },
};
