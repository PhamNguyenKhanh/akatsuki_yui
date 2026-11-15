import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { listUserNotificationsService } from "@/modules/notifications/notification.service";

function extractSearchParams(request: NextRequest): Record<string, string> {
  const params: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireActiveUser();
    const result = await listUserNotificationsService(actor, extractSearchParams(request));
    return apiSuccess(result);
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/notifications" });
  }
}
