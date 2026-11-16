import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { enforceApiWriteRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import type { CreateProjectInput } from "@/modules/projects/project.schema";
import { createProjectService, listProjectsService } from "@/modules/projects/project.service";
import type { PaginationMeta } from "@/types/api";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireActiveUser();
    const rawQuery: Record<string, string> = {};
    for (const [key, value] of request.nextUrl.searchParams.entries()) {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        rawQuery[key] = trimmed;
      }
    }

    const result = await listProjectsService(actor, rawQuery);
    const meta: PaginationMeta = {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    };

    return apiSuccess(result.items, { meta });
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/projects" });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const body = (await parseJsonBody(request)) as CreateProjectInput;
    const created = await createProjectService(actor, body);
    return apiSuccess(created, { status: 201 });
  } catch (error) {
    return apiError(error, { route: "POST /api/v1/projects" });
  }
}
