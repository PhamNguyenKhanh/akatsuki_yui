import { apiError, apiSuccess } from "@/lib/api-response";
import { enforceApiWriteRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import type { CreateProjectMeetingInput } from "@/modules/meetings/meeting.schema";
import {
  createProjectMeetingService,
  getProjectMeetingsBundleService,
} from "@/modules/meetings/meeting.service";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { projectId } = await context.params;
    const bundle = await getProjectMeetingsBundleService(actor, projectId);
    return apiSuccess(bundle);
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/projects/[projectId]/meetings" });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { projectId } = await context.params;
    const body = (await parseJsonBody(request)) as CreateProjectMeetingInput;
    const created = await createProjectMeetingService(actor, projectId, body);
    return apiSuccess(created, { status: 201 });
  } catch (error) {
    return apiError(error, { route: "POST /api/v1/projects/[projectId]/meetings" });
  }
}
