import { apiError, apiSuccess } from "@/lib/api-response";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { getSprintProgressAndBurndownService } from "@/modules/sprints/sprint-analytics.service";

type RouteContext = {
  params: Promise<{ sprintId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { sprintId } = await context.params;
    const analytics = await getSprintProgressAndBurndownService(actor, sprintId);
    return apiSuccess(analytics);
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/sprints/[sprintId]/burndown" });
  }
}
