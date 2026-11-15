import { apiError, apiSuccess } from "@/lib/api-response";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { manualRetryNotificationDeliveryService } from "@/modules/notifications/notification-delivery.service";

type RouteContext = {
  params: Promise<{ deliveryId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { deliveryId } = await context.params;
    const result = await manualRetryNotificationDeliveryService(actor, deliveryId);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error, {
      route: "POST /api/v1/admin/notifications/deliveries/[deliveryId]/retry",
    });
  }
}
