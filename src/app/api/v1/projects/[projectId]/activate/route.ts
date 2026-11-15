import { apiError, apiSuccess } from "@/lib/api-response";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { activateProjectService } from "@/modules/projects/project.service";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { projectId } = await context.params;
    const updated = await activateProjectService(actor, projectId);
    return apiSuccess(updated);
  } catch (error) {
    return apiError(error, { route: "POST /api/v1/projects/[projectId]/activate" });
  }
}
