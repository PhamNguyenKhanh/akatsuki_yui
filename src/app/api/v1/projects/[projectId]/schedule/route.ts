import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { enforceApiWriteRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import type { CreateScheduleEntryInput } from "@/modules/schedule/schedule.schema";
import {
  createScheduleEntryService,
  getProjectWeeklyScheduleService,
} from "@/modules/schedule/schedule.service";
import { extractSearchParams } from "@/modules/sprints/sprint-route-helpers";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { projectId } = await context.params;
    const result = await getProjectWeeklyScheduleService(
      actor,
      projectId,
      extractSearchParams(request)
    );
    return apiSuccess(result);
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/projects/[projectId]/schedule" });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { projectId } = await context.params;
    const body = (await parseJsonBody(request)) as CreateScheduleEntryInput;
    const created = await createScheduleEntryService(actor, projectId, body);
    return apiSuccess(created, { status: 201 });
  } catch (error) {
    return apiError(error, { route: "POST /api/v1/projects/[projectId]/schedule" });
  }
}
