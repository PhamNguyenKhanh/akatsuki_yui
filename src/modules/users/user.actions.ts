"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, toActionError } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import type { RoleName } from "@/modules/authorization/constants";
import type {
  AccountStatusAction,
  ChangePasswordInput,
  UpdateProfileInput,
} from "@/modules/users/user.schema";
import {
  assignUserRoleService,
  changeMyPasswordService,
  updateAccountStatusService,
  updateMyProfileService,
} from "@/modules/users/user.service";
import type { SafeUserDTO } from "@/types/auth";

export async function updateAccountStatusAction(
  targetUserId: string,
  action: AccountStatusAction
): Promise<ActionResult<SafeUserDTO>> {
  try {
    const actor = await requireActiveUser();
    const updated = await updateAccountStatusService(actor, targetUserId, { action });
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${targetUserId}`);
    revalidatePath("/dashboard");
    return { ok: true, data: updated };
  } catch (error) {
    return toActionError(error, { action: "updateAccountStatusAction" });
  }
}

export async function assignUserRoleAction(
  targetUserId: string,
  roleName: RoleName
): Promise<ActionResult<SafeUserDTO>> {
  try {
    const actor = await requireActiveUser();
    const updated = await assignUserRoleService(actor, targetUserId, { roleName });
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${targetUserId}`);
    revalidatePath("/dashboard");
    return { ok: true, data: updated };
  } catch (error) {
    return toActionError(error, { action: "assignUserRoleAction" });
  }
}

export async function updateMyProfileAction(
  input: UpdateProfileInput
): Promise<ActionResult<SafeUserDTO>> {
  try {
    const actor = await requireActiveUser();
    const updated = await updateMyProfileService(actor, input);
    revalidatePath("/profile");
    revalidatePath("/dashboard");
    revalidatePath("/admin/users");
    return { ok: true, data: updated };
  } catch (error) {
    return toActionError(error, { action: "updateMyProfileAction" });
  }
}

export async function changeMyPasswordAction(
  input: ChangePasswordInput
): Promise<ActionResult<{ changed: true }>> {
  try {
    const actor = await requireActiveUser();
    await changeMyPasswordService(actor, input);
    return { ok: true, data: { changed: true } };
  } catch (error) {
    return toActionError(error, { action: "changeMyPasswordAction" });
  }
}
