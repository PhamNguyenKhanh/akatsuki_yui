import { apiError, apiSuccess } from "@/lib/api-response";
import { requireActiveUser } from "@/modules/authorization/require-auth";

export async function GET() {
  try {
    const context = await requireActiveUser();
    return apiSuccess({
      authenticated: true,
      user: context,
    });
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/auth/session" });
  }
}
