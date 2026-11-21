import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getOptionalAuthContext } from "@/modules/authorization/require-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Đặt lại mật khẩu",
};

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const authContext = await getOptionalAuthContext();
  if (authContext) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  return <ResetPasswordForm token={params.token ?? ""} />;
}
