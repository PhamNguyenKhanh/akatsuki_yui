import { apiError, apiSuccess } from "@/lib/api-response";
import { enforceApiWriteRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import type { UpdateMeetLinkInput } from "@/modules/meetings/meeting.schema";
import { deleteMeetLinkService, updateMeetLinkService } from "@/modules/meetings/meeting.service";

type RouteContext = {
  params: Promise<{ projectId: string; linkId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { projectId, linkId } = await context.params;
    const body = (await parseJsonBody(request)) as UpdateMeetLinkInput;
    const updated = await updateMeetLinkService(actor, projectId, linkId, body);
    return apiSuccess(updated);
  } catch (error) {
    return apiError(error, { route: "PATCH /api/v1/projects/[projectId]/meet-links/[linkId]" });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { projectId, linkId } = await context.params;
    const deleted = await deleteMeetLinkService(actor, projectId, linkId);
    return apiSuccess(deleted);
  } catch (error) {
    return apiError(error, { route: "DELETE /api/v1/projects/[projectId]/meet-links/[linkId]" });
  }
}
