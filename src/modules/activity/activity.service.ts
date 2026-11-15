import "server-only";
import type { ProjectStatus } from "@prisma/client";
import { badRequestError } from "@/lib/errors";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { assertPermission } from "@/modules/authorization/policy.service";
import { assertProjectReadAccess } from "@/modules/projects/project.access";
import { activityRepository, type ActivityEntryDTO } from "@/modules/activity/activity.repository";
import {
  activityQuerySchema,
  decodeActivityCursor,
  type ActivityQueryInput,
} from "@/modules/activity/activity.schema";
import type { AuthContext } from "@/types/auth";

export interface ActivityFeedPageDTO {
  items: ActivityEntryDTO[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
    limit: number;
  };
  scope: {
    isWorkspaceAdmin: boolean;
    hasRestrictedMemberProjects: boolean;
  };
}

export interface ActivityFilterOptionsDTO {
  projects: Array<{ id: string; name: string; status: ProjectStatus }>;
  actors: Array<{ id: string; fullName: string; email: string }>;
}

/**
 * Returns a cursor-paginated unified timeline merging ActivityLog and TaskHistory
 * ordered strictly by `(createdAt DESC, source DESC, id DESC)` with server-side RBAC
 * and MEMBER own/assigned-task isolation (`DEC-052`, `DEC-055`).
 */
export async function listUnifiedActivityService(
  actor: AuthContext,
  rawQuery: ActivityQueryInput | Record<string, unknown> = {}
): Promise<ActivityFeedPageDTO> {
  assertPermission(actor, PERMISSIONS.ACTIVITY_READ);

  const parsed = activityQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    throw badRequestError(
      parsed.error.issues[0]?.message ?? "Tham số truy vấn lịch sử hoạt động không hợp lệ.",
      parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "query",
        message: issue.message,
      }))
    );
  }

  const query = parsed.data;
  const cursor = query.cursor ? decodeActivityCursor(query.cursor) : undefined;

  if (query.projectId) {
    await assertProjectReadAccess(actor, query.projectId);
  }

  const scope = await activityRepository.resolveVisibilityScope(actor, query.projectId);
  const feed = await activityRepository.queryUnifiedFeed(actor, scope, query, cursor);

  return {
    items: feed.items,
    pageInfo: feed.pageInfo,
    scope: {
      isWorkspaceAdmin: scope.adminViewAll,
      hasRestrictedMemberProjects: scope.memberRestrictedProjectIds.length > 0,
    },
  };
}

/**
 * Loads permitted Project and Actor options for `/activity` UI filters.
 */
export async function getActivityFilterOptionsService(
  actor: AuthContext
): Promise<ActivityFilterOptionsDTO> {
  assertPermission(actor, PERMISSIONS.ACTIVITY_READ);

  const [projects, scope] = await Promise.all([
    activityRepository.findAccessibleProjectsForFilter(actor),
    activityRepository.resolveVisibilityScope(actor),
  ]);
  const actors = await activityRepository.findActorOptionsForFilter(actor, scope);

  return {
    projects,
    actors,
  };
}
