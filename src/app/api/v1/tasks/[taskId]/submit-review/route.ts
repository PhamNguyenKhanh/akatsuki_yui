import { apiError, apiSuccess } from "@/lib/api-response";
import { badRequestError } from "@/lib/errors";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { submitTaskForReviewService } from "@/modules/tasks/task-workflow.service";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

async function parseOptionalReviewBody(request: Request): Promise<unknown> {
  const raw = await request.text();
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw badRequestError("JSON body không hợp lệ.");
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { taskId } = await context.params;
    const body = await parseOptionalReviewBody(request);
    const updated = await submitTaskForReviewService(actor, taskId, body);
    return apiSuccess(updated);
  } catch (error) {
    return apiError(error, { route: "POST /api/v1/tasks/[taskId]/submit-review" });
  }
}
