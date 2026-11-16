import { apiError, apiSuccess } from "@/lib/api-response";
import { enforceApiWriteRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import {
  addTaskAssigneeService,
  listTaskAssigneesService,
  syncTaskAssigneesService,
} from "@/modules/tasks/task-assignment.service";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { taskId } = await context.params;
    const assignees = await listTaskAssigneesService(actor, taskId);
    return apiSuccess(assignees);
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/tasks/[taskId]/assignees" });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { taskId } = await context.params;
    const body = await parseJsonBody(request);
    const assignees = await syncTaskAssigneesService(actor, taskId, body);
    return apiSuccess(assignees);
  } catch (error) {
    return apiError(error, { route: "PUT /api/v1/tasks/[taskId]/assignees" });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { taskId } = await context.params;
    const body = await parseJsonBody(request);
    const assignees = await addTaskAssigneeService(actor, taskId, body);
    return apiSuccess(assignees, { status: 201 });
  } catch (error) {
    return apiError(error, { route: "POST /api/v1/tasks/[taskId]/assignees" });
  }
}
