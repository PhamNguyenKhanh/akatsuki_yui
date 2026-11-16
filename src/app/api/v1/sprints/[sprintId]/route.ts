import { apiError, apiSuccess } from "@/lib/api-response";
import { enforceApiWriteRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { getSprintDetailService, updateSprintService } from "@/modules/sprints/sprint.service";

type RouteContext = {
  params: Promise<{ sprintId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { sprintId } = await context.params;
    const sprint = await getSprintDetailService(actor, sprintId);
    return apiSuccess(sprint);
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/sprints/[sprintId]" });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { sprintId } = await context.params;
    const body = await parseJsonBody(request);
    const result = await updateSprintService(actor, sprintId, body);
    return apiSuccess(
      result.sprint,
      result.overlappingSprints.length > 0
        ? { meta: { overlappingSprints: result.overlappingSprints } }
        : undefined
    );
  } catch (error) {
    return apiError(error, { route: "PATCH /api/v1/sprints/[sprintId]" });
  }
}
