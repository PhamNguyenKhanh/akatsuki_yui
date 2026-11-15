import { apiError, apiSuccess } from "@/lib/api-response";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { getUserUnreadNotificationCountService } from "@/modules/notifications/notification.service";

export async function GET() {
  try {
    const actor = await requireActiveUser();
    const result = await getUserUnreadNotificationCountService(actor);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/notifications/unread-count" });
  }
}
