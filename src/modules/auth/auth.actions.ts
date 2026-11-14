"use server";

import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { type ActionResult, toActionError } from "@/lib/request";
import type { LoginInput, RegisterInput } from "@/modules/auth/auth.schema";
import { recordLogoutActivity, registerAccount } from "@/modules/auth/auth.service";
import { performCredentialsLogin } from "@/modules/auth/sign-in-helper";
import type { SafeUserDTO } from "@/types/auth";

export async function registerAction(input: RegisterInput): Promise<ActionResult<SafeUserDTO>> {
  try {
    const user = await registerAccount(input);
    return { ok: true, data: user };
  } catch (error) {
    return toActionError(error, { action: "registerAction" });
  }
}

export async function loginAction(input: LoginInput): Promise<ActionResult<{ user: SafeUserDTO }>> {
  try {
    const result = await performCredentialsLogin(input);
    return { ok: true, data: result };
  } catch (error) {
    return toActionError(error, { action: "loginAction" });
  }
}

export async function logoutAction(): Promise<void> {
  const session = await auth();
  if (session?.user?.id) {
    try {
      await recordLogoutActivity(session.user.id, session.user.email);
    } catch {
      // Logout must still clear the cookie even if activity audit fails
    }
  }
  await signOut({ redirect: false });
  redirect("/login");
}
