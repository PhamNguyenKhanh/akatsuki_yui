import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { listBacklogTasksService } from "@/modules/sprints/sprint-planning.service";
import { extractSearchParams } from "@/modules/sprints/sprint-route-helpers";
import type { PaginationMeta } from "@/types/api";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { projectId } = await context.params;
    const result = await listBacklogTasksService(actor, projectId, extractSearchParams(request));
    const meta: PaginationMeta = {
      page: result.page,
      pageSize: result.pageSize,
      total: result.totalItems,
      totalPages: result.totalPages,
    };
    return apiSuccess(result.items, { meta });
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/projects/[projectId]/backlog" });
  }
}
