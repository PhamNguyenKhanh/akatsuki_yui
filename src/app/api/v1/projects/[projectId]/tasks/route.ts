import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { createTaskService, listProjectTasksService } from "@/modules/tasks/task.service";
import type { PaginationMeta } from "@/types/api";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { projectId } = await context.params;
    const rawQuery: Record<string, string> = {};
    for (const [key, value] of request.nextUrl.searchParams.entries()) {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        rawQuery[key] = trimmed;
      }
    }

    const result = await listProjectTasksService(actor, projectId, rawQuery);
    const meta: PaginationMeta = {
      page: result.page,
      pageSize: result.pageSize,
      total: result.totalItems,
      totalPages: result.totalPages,
    };

    return apiSuccess(result.items, { meta });
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/projects/[projectId]/tasks" });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { projectId } = await context.params;
    const body = await parseJsonBody(request);
    const created = await createTaskService(actor, projectId, body);
    return apiSuccess(created, { status: 201 });
  } catch (error) {
    return apiError(error, { route: "POST /api/v1/projects/[projectId]/tasks" });
  }
}
