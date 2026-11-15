import { apiError, apiSuccess } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/request";
import { performCredentialsLogin } from "@/modules/auth/sign-in-helper";

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request);
    const result = await performCredentialsLogin(
      body as Parameters<typeof performCredentialsLogin>[0],
      { headers: request.headers }
    );
    return apiSuccess(result);
  } catch (error) {
    return apiError(error, { route: "POST /api/v1/auth/login" });
  }
}
