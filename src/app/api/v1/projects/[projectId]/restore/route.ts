import { apiError, apiSuccess } from "@/lib/api-response";
import { enforceApiWriteRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import type { RestoreProjectInput } from "@/modules/projects/project.schema";
import { restoreProjectService } from "@/modules/projects/project.service";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { projectId } = await context.params;
    const body = (await parseJsonBody(request)) as RestoreProjectInput;
    const restored = await restoreProjectService(actor, projectId, body);
    return apiSuccess(restored);
  } catch (error) {
    return apiError(error, { route: "POST /api/v1/projects/[projectId]/restore" });
  }
}
