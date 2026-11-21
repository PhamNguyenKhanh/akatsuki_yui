import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getOptionalAuthContext } from "@/modules/authorization/require-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Quên mật khẩu",
};

export default async function ForgotPasswordPage() {
  const authContext = await getOptionalAuthContext();
  if (authContext) {
    redirect("/dashboard");
  }

  return <ForgotPasswordForm />;
}
