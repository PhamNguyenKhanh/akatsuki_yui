import { apiError, apiSuccess } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/request";
import { registerAccount } from "@/modules/auth/auth.service";

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request);
    const user = await registerAccount(body as Parameters<typeof registerAccount>[0]);
    return apiSuccess(user, { status: 201 });
  } catch (error) {
    return apiError(error, { route: "POST /api/v1/auth/register" });
  }
}
