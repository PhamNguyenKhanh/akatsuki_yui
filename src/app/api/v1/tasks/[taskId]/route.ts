import { apiError, apiSuccess } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { getTaskDetailService, updateTaskService } from "@/modules/tasks/task.service";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { taskId } = await context.params;
    const detail = await getTaskDetailService(actor, taskId);
    return apiSuccess(detail);
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/tasks/[taskId]" });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { taskId } = await context.params;
    const body = await parseJsonBody(request);
    const updated = await updateTaskService(actor, taskId, body);
    return apiSuccess(updated);
  } catch (error) {
    return apiError(error, { route: "PATCH /api/v1/tasks/[taskId]" });
  }
}
