import { apiError, apiSuccess } from "@/lib/api-response";
import { enforceApiWriteRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { updateAccountStatusService } from "@/modules/users/user.service";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { userId } = await context.params;
    const body = await parseJsonBody(request);
    const updated = await updateAccountStatusService(
      actor,
      userId,
      body as Parameters<typeof updateAccountStatusService>[2]
    );
    return apiSuccess(updated);
  } catch (error) {
    return apiError(error, { route: "PATCH /api/v1/users/[userId]/status" });
  }
}
