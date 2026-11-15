import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { getProjectAnalyticsService } from "@/modules/reports/project-analytics.service";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

function extractSearchParams(request: NextRequest): Record<string, string> {
  const params: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { projectId } = await context.params;
    const analytics = await getProjectAnalyticsService(
      actor,
      projectId,
      extractSearchParams(request)
    );
    return apiSuccess(analytics);
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/reports/projects/[projectId]" });
  }
}
