import { apiError, apiSuccess } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { changeMyPasswordService } from "@/modules/users/user.service";

export async function POST(request: Request) {
  try {
    const actor = await requireActiveUser();
    const body = await parseJsonBody(request);
    await changeMyPasswordService(actor, body as Parameters<typeof changeMyPasswordService>[1], {
      headers: request.headers,
    });
    return apiSuccess({ changed: true });
  } catch (error) {
    return apiError(error, { route: "POST /api/v1/profile/change-password" });
  }
}
