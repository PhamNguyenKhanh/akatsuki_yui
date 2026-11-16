import { apiError, apiSuccess } from "@/lib/api-response";
import { enforceApiWriteRateLimit } from "@/lib/rate-limit";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { removeTaskDependencyService } from "@/modules/tasks/task-dependency.service";

type RouteContext = {
  params: Promise<{ taskId: string; dependsOnTaskId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { taskId, dependsOnTaskId } = await context.params;
    const dependencies = await removeTaskDependencyService(actor, taskId, dependsOnTaskId);
    return apiSuccess(dependencies);
  } catch (error) {
    return apiError(error, {
      route: "DELETE /api/v1/tasks/[taskId]/dependencies/[dependsOnTaskId]",
    });
  }
}
