import { apiError, apiSuccess } from "@/lib/api-response";
import { enforceApiWriteRateLimit } from "@/lib/rate-limit";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { parseOptionalJsonBody } from "@/modules/sprints/sprint-route-helpers";
import { cancelSprintService } from "@/modules/sprints/sprint.service";

type RouteContext = {
  params: Promise<{ sprintId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { sprintId } = await context.params;
    const body = await parseOptionalJsonBody(request);
    const updated = await cancelSprintService(actor, sprintId, body);
    return apiSuccess(updated);
  } catch (error) {
    return apiError(error, { route: "POST /api/v1/sprints/[sprintId]/cancel" });
  }
}
