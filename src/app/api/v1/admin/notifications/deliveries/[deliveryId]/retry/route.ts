import { apiError, apiSuccess } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { manualRetryNotificationDeliveryService } from "@/modules/notifications/notification-delivery.service";

type RouteContext = {
  params: Promise<{ deliveryId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { deliveryId } = await context.params;
    const rawText = request.headers.get("content-length") === "0" ? "" : await request.clone().text().catch(() => "");
    let confirmUnknownResend = false;
    if (rawText.trim().length > 0) {
      const parsed = (await parseJsonBody(request)) as { confirmUnknownResend?: unknown };
      confirmUnknownResend = parsed?.confirmUnknownResend === true;
    }
    const result = await manualRetryNotificationDeliveryService(actor, deliveryId, {
      confirmUnknownResend,
    });
    return apiSuccess(result);
  } catch (error) {
    return apiError(error, {
      route: "POST /api/v1/admin/notifications/deliveries/[deliveryId]/retry",
    });
  }
}
