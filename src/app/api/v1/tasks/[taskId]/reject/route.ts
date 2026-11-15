import { apiError, apiSuccess } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { rejectTaskReviewService } from "@/modules/tasks/task-workflow.service";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { taskId } = await context.params;
    const body = await parseJsonBody(request);
    const updated = await rejectTaskReviewService(actor, taskId, body);
    return apiSuccess(updated);
  } catch (error) {
    return apiError(error, { route: "POST /api/v1/tasks/[taskId]/reject" });
  }
}
