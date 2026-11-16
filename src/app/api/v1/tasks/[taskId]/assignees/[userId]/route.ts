import { apiError, apiSuccess } from "@/lib/api-response";
import { enforceApiWriteRateLimit } from "@/lib/rate-limit";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { removeTaskAssigneeService } from "@/modules/tasks/task-assignment.service";

type RouteContext = {
  params: Promise<{ taskId: string; userId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { taskId, userId } = await context.params;
    const assignees = await removeTaskAssigneeService(actor, taskId, userId);
    return apiSuccess(assignees);
  } catch (error) {
    return apiError(error, { route: "DELETE /api/v1/tasks/[taskId]/assignees/[userId]" });
  }
}
