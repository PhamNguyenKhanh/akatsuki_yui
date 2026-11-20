import { apiError, apiSuccess } from "@/lib/api-response";
import { enforceApiWriteRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import type { UpdateProjectMeetingInput } from "@/modules/meetings/meeting.schema";
import {
  deleteProjectMeetingService,
  updateProjectMeetingService,
} from "@/modules/meetings/meeting.service";

type RouteContext = {
  params: Promise<{ projectId: string; meetingId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { projectId, meetingId } = await context.params;
    const body = (await parseJsonBody(request)) as UpdateProjectMeetingInput;
    const updated = await updateProjectMeetingService(actor, projectId, meetingId, body);
    return apiSuccess(updated);
  } catch (error) {
    return apiError(error, { route: "PATCH /api/v1/projects/[projectId]/meetings/[meetingId]" });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { projectId, meetingId } = await context.params;
    const deleted = await deleteProjectMeetingService(actor, projectId, meetingId);
    return apiSuccess(deleted);
  } catch (error) {
    return apiError(error, { route: "DELETE /api/v1/projects/[projectId]/meetings/[meetingId]" });
  }
}
