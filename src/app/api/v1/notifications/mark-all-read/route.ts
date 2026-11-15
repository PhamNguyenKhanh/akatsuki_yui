import { apiError, apiSuccess } from "@/lib/api-response";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { markAllNotificationsReadService } from "@/modules/notifications/notification.service";

export async function POST() {
  try {
    const actor = await requireActiveUser();
    const result = await markAllNotificationsReadService(actor);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error, { route: "POST /api/v1/notifications/mark-all-read" });
  }
}
