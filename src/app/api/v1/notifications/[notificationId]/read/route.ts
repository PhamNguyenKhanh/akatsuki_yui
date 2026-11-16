import { apiError, apiSuccess } from "@/lib/api-response";
import { badRequestError } from "@/lib/errors";
import { enforceApiWriteRateLimit } from "@/lib/rate-limit";
import { parseOptionalJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { markNotificationReadStateService } from "@/modules/notifications/notification.service";
import type { MarkNotificationReadInput } from "@/modules/notifications/notification.validation";

type RouteContext = {
  params: Promise<{ notificationId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { notificationId } = await context.params;
    const parsed = await parseOptionalJsonBody(request, { isRead: true });
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw badRequestError("Nội dung JSON không hợp lệ.");
    }
    const updated = await markNotificationReadStateService(
      actor,
      notificationId,
      parsed as MarkNotificationReadInput
    );
    return apiSuccess(updated);
  } catch (error) {
    return apiError(error, { route: "PATCH /api/v1/notifications/[notificationId]/read" });
  }
}
