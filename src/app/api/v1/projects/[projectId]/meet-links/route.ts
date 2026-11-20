import { apiError, apiSuccess } from "@/lib/api-response";
import { enforceApiWriteRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import type { CreateMeetLinkInput } from "@/modules/meetings/meeting.schema";
import {
  createMeetLinkService,
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
    return apiSuccess(bundle.meetLinks);
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/projects/[projectId]/meet-links" });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { projectId } = await context.params;
    const body = (await parseJsonBody(request)) as CreateMeetLinkInput;
    const created = await createMeetLinkService(actor, projectId, body);
    return apiSuccess(created, { status: 201 });
  } catch (error) {
    return apiError(error, { route: "POST /api/v1/projects/[projectId]/meet-links" });
  }
}
