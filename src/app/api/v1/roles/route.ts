import { apiError, apiSuccess } from "@/lib/api-response";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { getPermissionMatrixService } from "@/modules/roles/role.service";

export async function GET() {
  try {
    const actor = await requireActiveUser();
    const matrix = await getPermissionMatrixService(actor);
    return apiSuccess(matrix);
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/roles" });
  }
}
