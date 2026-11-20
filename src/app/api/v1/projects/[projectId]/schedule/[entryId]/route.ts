import { apiError, apiSuccess } from "@/lib/api-response";
import { enforceApiWriteRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import type {
  DeleteScheduleEntryInput,
  UpdateScheduleEntryInput,
} from "@/modules/schedule/schedule.schema";
import {
  deleteScheduleEntryService,
  updateScheduleEntryService,
} from "@/modules/schedule/schedule.service";
import { extractSearchParams, parseOptionalJsonBody } from "@/modules/sprints/sprint-route-helpers";

type RouteContext = {
  params: Promise<{ projectId: string; entryId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { projectId, entryId } = await context.params;
    const body = (await parseJsonBody(request)) as UpdateScheduleEntryInput;
    const updated = await updateScheduleEntryService(actor, projectId, entryId, body);
    return apiSuccess(updated);
  } catch (error) {
    return apiError(error, { route: "PATCH /api/v1/projects/[projectId]/schedule/[entryId]" });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { projectId, entryId } = await context.params;
    const query = extractSearchParams(request);
    const body = (await parseOptionalJsonBody(request)) as Partial<DeleteScheduleEntryInput>;
    const payload: DeleteScheduleEntryInput = {
      scope: (body?.scope ?? query.scope ?? "ALL_SERIES") as DeleteScheduleEntryInput["scope"],
      occurrenceDate: body?.occurrenceDate ?? query.occurrenceDate ?? "",
    };
    const deleted = await deleteScheduleEntryService(actor, projectId, entryId, payload);
    return apiSuccess(deleted);
  } catch (error) {
    return apiError(error, { route: "DELETE /api/v1/projects/[projectId]/schedule/[entryId]" });
  }
}
