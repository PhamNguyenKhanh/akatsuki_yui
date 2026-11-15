import { apiError, apiSuccess } from "@/lib/api-response";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { getSprintCompletionPreviewService } from "@/modules/sprints/sprint-completion.service";

type RouteContext = {
  params: Promise<{ sprintId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { sprintId } = await context.params;
    const preview = await getSprintCompletionPreviewService(actor, sprintId);
    return apiSuccess(preview);
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/sprints/[sprintId]/completion-preview" });
  }
}
