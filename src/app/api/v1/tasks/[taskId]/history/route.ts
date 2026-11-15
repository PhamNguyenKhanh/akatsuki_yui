import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { listTaskHistoryService } from "@/modules/tasks/task-history.service";
import type { PaginationMeta } from "@/types/api";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { taskId } = await context.params;
    const rawQuery: Record<string, string> = {};
    for (const [key, value] of request.nextUrl.searchParams.entries()) {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        rawQuery[key] = trimmed;
      }
    }

    const result = await listTaskHistoryService(actor, taskId, rawQuery);
    const meta: PaginationMeta = {
      page: result.page,
      pageSize: result.pageSize,
      total: result.totalItems,
      totalPages: result.totalPages,
    };

    return apiSuccess(result.items, { meta });
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/tasks/[taskId]/history" });
  }
}
