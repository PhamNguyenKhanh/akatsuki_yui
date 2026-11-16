import { apiError, apiSuccess } from "@/lib/api-response";
import { enforceApiWriteRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import {
  addTaskDependencyService,
  listTaskDependenciesService,
} from "@/modules/tasks/task-dependency.service";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { taskId } = await context.params;
    const dependencies = await listTaskDependenciesService(actor, taskId);
    return apiSuccess(dependencies);
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/tasks/[taskId]/dependencies" });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { taskId } = await context.params;
    const body = await parseJsonBody(request);
    const dependencies = await addTaskDependencyService(actor, taskId, body);
    return apiSuccess(dependencies, { status: 201 });
  } catch (error) {
    return apiError(error, { route: "POST /api/v1/tasks/[taskId]/dependencies" });
  }
}
