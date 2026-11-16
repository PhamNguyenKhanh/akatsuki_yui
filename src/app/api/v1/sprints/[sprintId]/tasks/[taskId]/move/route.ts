import { apiError, apiSuccess } from "@/lib/api-response";
import { enforceApiWriteRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { moveSprintTaskService } from "@/modules/sprints/sprint-planning.service";

type RouteContext = {
  params: Promise<{ sprintId: string; taskId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { sprintId, taskId } = await context.params;
    const body = await parseJsonBody(request);
    const updated = await moveSprintTaskService(actor, sprintId, taskId, body);
    return apiSuccess(updated);
  } catch (error) {
    return apiError(error, { route: "POST /api/v1/sprints/[sprintId]/tasks/[taskId]/move" });
  }
}
