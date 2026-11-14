import { apiError, apiSuccess } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import type { UpdateProjectInput } from "@/modules/projects/project.schema";
import { getProjectDetailService, updateProjectService } from "@/modules/projects/project.service";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { projectId } = await context.params;
    const project = await getProjectDetailService(actor, projectId);
    return apiSuccess(project);
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/projects/[projectId]" });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { projectId } = await context.params;
    const body = (await parseJsonBody(request)) as UpdateProjectInput;
    const updated = await updateProjectService(actor, projectId, body);
    return apiSuccess(updated);
  } catch (error) {
    return apiError(error, { route: "PATCH /api/v1/projects/[projectId]" });
  }
}
