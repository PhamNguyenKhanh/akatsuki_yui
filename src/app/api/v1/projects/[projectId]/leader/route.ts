import { apiError, apiSuccess } from "@/lib/api-response";
import { enforceApiWriteRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import type { ChangeProjectLeaderInput } from "@/modules/project-members/member.schema";
import { changeProjectLeaderService } from "@/modules/project-members/member.service";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { projectId } = await context.params;
    const body = (await parseJsonBody(request)) as ChangeProjectLeaderInput;
    const members = await changeProjectLeaderService(actor, projectId, body);
    return apiSuccess(members);
  } catch (error) {
    return apiError(error, { route: "PATCH /api/v1/projects/[projectId]/leader" });
  }
}
