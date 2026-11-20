import { apiError, apiSuccess } from "@/lib/api-response";
import { enforceApiWriteRateLimit } from "@/lib/rate-limit";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { cancelProjectMeetingService } from "@/modules/meetings/meeting.service";

type RouteContext = {
  params: Promise<{ projectId: string; meetingId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { projectId, meetingId } = await context.params;
    const cancelled = await cancelProjectMeetingService(actor, projectId, meetingId);
    return apiSuccess(cancelled);
  } catch (error) {
    return apiError(error, {
      route: "POST /api/v1/projects/[projectId]/meetings/[meetingId]/cancel",
    });
  }
}
