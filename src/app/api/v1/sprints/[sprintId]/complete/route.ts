import { apiError, apiSuccess } from "@/lib/api-response";
import { enforceApiWriteRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { completeSprintService } from "@/modules/sprints/sprint-completion.service";

type RouteContext = {
  params: Promise<{ sprintId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { sprintId } = await context.params;
    const body = await parseJsonBody(request);
    const completed = await completeSprintService(actor, sprintId, body);
    return apiSuccess(completed);
  } catch (error) {
    return apiError(error, { route: "POST /api/v1/sprints/[sprintId]/complete" });
  }
}
