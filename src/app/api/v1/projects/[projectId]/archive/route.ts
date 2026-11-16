import { apiError, apiSuccess } from "@/lib/api-response";
import { enforceApiWriteRateLimit } from "@/lib/rate-limit";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { archiveProjectService } from "@/modules/projects/project.service";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { projectId } = await context.params;
    const updated = await archiveProjectService(actor, projectId);
    return apiSuccess(updated);
  } catch (error) {
    return apiError(error, { route: "POST /api/v1/projects/[projectId]/archive" });
  }
}
