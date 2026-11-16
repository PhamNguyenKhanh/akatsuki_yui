import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { enforceApiWriteRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import type {
  PermissionMutationInput,
  ToggleRolePermissionInput,
} from "@/modules/roles/role.schema";
import {
  grantRolePermissionService,
  revokeRolePermissionService,
  toggleRolePermissionService,
} from "@/modules/roles/role.service";

type RouteContext = {
  params: Promise<{ roleId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { roleId } = await context.params;
    const body = (await parseJsonBody(request)) as PermissionMutationInput;
    const updated = await grantRolePermissionService(actor, roleId, body);
    return apiSuccess(updated);
  } catch (error) {
    return apiError(error, { route: "POST /api/v1/roles/[roleId]/permissions" });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { roleId } = await context.params;
    const body = (await parseJsonBody(request)) as ToggleRolePermissionInput;
    const updated = await toggleRolePermissionService(actor, roleId, body);
    return apiSuccess(updated);
  } catch (error) {
    return apiError(error, { route: "PATCH /api/v1/roles/[roleId]/permissions" });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { roleId } = await context.params;
    const permissionId = request.nextUrl.searchParams.get("permissionId")?.trim() || undefined;
    const permissionCode = request.nextUrl.searchParams.get("permissionCode")?.trim() || undefined;

    let payload: PermissionMutationInput;
    if (permissionId || permissionCode) {
      payload = { permissionId, permissionCode };
    } else {
      payload = (await parseJsonBody(request)) as PermissionMutationInput;
    }

    const updated = await revokeRolePermissionService(actor, roleId, payload);
    return apiSuccess(updated);
  } catch (error) {
    return apiError(error, { route: "DELETE /api/v1/roles/[roleId]/permissions" });
  }
}
