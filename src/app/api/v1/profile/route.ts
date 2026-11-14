import { apiError, apiSuccess } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { getMyProfileService, updateMyProfileService } from "@/modules/users/user.service";

export async function GET() {
  try {
    const actor = await requireActiveUser();
    const profile = await getMyProfileService(actor);
    return apiSuccess(profile);
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/profile" });
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireActiveUser();
    const body = await parseJsonBody(request);
    const updated = await updateMyProfileService(actor, body);
    return apiSuccess(updated);
  } catch (error) {
    return apiError(error, { route: "PATCH /api/v1/profile" });
  }
}
