import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { enforceApiWriteRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { extractSearchParams } from "@/modules/sprints/sprint-route-helpers";
import { createSprintService, listProjectSprintsService } from "@/modules/sprints/sprint.service";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { projectId } = await context.params;
    const sprints = await listProjectSprintsService(actor, projectId, extractSearchParams(request));
    return apiSuccess(sprints);
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/projects/[projectId]/sprints" });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { projectId } = await context.params;
    const body = await parseJsonBody(request);
    const result = await createSprintService(actor, projectId, body);
    return apiSuccess(result.sprint, {
      status: 201,
      meta:
        result.overlappingSprints.length > 0
          ? { overlappingSprints: result.overlappingSprints }
          : undefined,
    });
  } catch (error) {
    return apiError(error, { route: "POST /api/v1/projects/[projectId]/sprints" });
  }
}
