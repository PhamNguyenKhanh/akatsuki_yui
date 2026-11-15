import { apiError, apiSuccess } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { markNotificationReadStateService } from "@/modules/notifications/notification.service";
import type { MarkNotificationReadInput } from "@/modules/notifications/notification.validation";

type RouteContext = {
  params: Promise<{ notificationId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { notificationId } = await context.params;
    let body: MarkNotificationReadInput = { isRead: true };
    try {
      const parsed = await parseJsonBody(request);
      if (parsed && typeof parsed === "object") {
        body = parsed as MarkNotificationReadInput;
      }
    } catch {
      body = { isRead: true };
    }
    const updated = await markNotificationReadStateService(actor, notificationId, body);
    return apiSuccess(updated);
  } catch (error) {
    return apiError(error, { route: "PATCH /api/v1/notifications/[notificationId]/read" });
  }
}
