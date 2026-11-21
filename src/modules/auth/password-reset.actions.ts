"use server";

import { type ActionResult, toActionError } from "@/lib/request";
import {
  requestPasswordResetService,
  resetPasswordWithTokenService,
} from "@/modules/auth/password-reset.service";

export async function requestPasswordResetAction(
  email: string
): Promise<ActionResult<{ sent: boolean }>> {
  try {
    const result = await requestPasswordResetService(email);
    return { ok: true, data: result };
  } catch (error) {
    return toActionError(error, { action: "requestPasswordResetAction" });
  }
}

export async function resetPasswordAction(input: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ActionResult<{ reset: boolean }>> {
  try {
    await resetPasswordWithTokenService(input);
    return { ok: true, data: { reset: true } };
  } catch (error) {
    return toActionError(error, { action: "resetPasswordAction" });
  }
}
