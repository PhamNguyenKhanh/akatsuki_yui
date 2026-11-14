"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, toActionError } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import type { RoleWithPermissionsDTO } from "@/modules/roles/role.repository";
import type { ToggleRolePermissionInput } from "@/modules/roles/role.schema";
import { toggleRolePermissionService } from "@/modules/roles/role.service";

export async function toggleRolePermissionAction(
  roleId: string,
  input: ToggleRolePermissionInput
): Promise<ActionResult<RoleWithPermissionsDTO>> {
  try {
    const actor = await requireActiveUser();
    const updated = await toggleRolePermissionService(actor, roleId, input);
    revalidatePath("/admin/roles");
    revalidatePath("/admin/users");
    revalidatePath("/dashboard");
    return { ok: true, data: updated };
  } catch (error) {
    return toActionError(error, { action: "toggleRolePermissionAction" });
  }
}
