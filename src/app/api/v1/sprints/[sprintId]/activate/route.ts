import { apiError, apiSuccess } from "@/lib/api-response";
import { enforceApiWriteRateLimit } from "@/lib/rate-limit";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { activateSprintService } from "@/modules/sprints/sprint.service";

type RouteContext = {
  params: Promise<{ sprintId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { sprintId } = await context.params;
    const updated = await activateSprintService(actor, sprintId);
    return apiSuccess(updated);
  } catch (error) {
    return apiError(error, { route: "POST /api/v1/sprints/[sprintId]/activate" });
  }
}
