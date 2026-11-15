import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { listUnifiedActivityService } from "@/modules/activity/activity.service";
import { requireActiveUser } from "@/modules/authorization/require-auth";

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
    const feed = await listUnifiedActivityService(actor, extractSearchParams(request));
    return apiSuccess(feed);
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/activity" });
  }
}
