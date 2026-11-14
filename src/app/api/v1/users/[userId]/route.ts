import { apiError, apiSuccess } from "@/lib/api-response";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { getUserDetailService } from "@/modules/users/user.service";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { userId } = await context.params;
    const user = await getUserDetailService(actor, userId);
    return apiSuccess(user);
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/users/[userId]" });
  }
}
