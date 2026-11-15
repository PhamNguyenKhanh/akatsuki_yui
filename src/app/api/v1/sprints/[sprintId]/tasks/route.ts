import { apiError, apiSuccess } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { assignTasksToSprintService } from "@/modules/sprints/sprint-planning.service";

type RouteContext = {
  params: Promise<{ sprintId: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { sprintId } = await context.params;
    const body = await parseJsonBody(request);
    const result = await assignTasksToSprintService(actor, sprintId, body);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error, { route: "PUT /api/v1/sprints/[sprintId]/tasks" });
  }
}
