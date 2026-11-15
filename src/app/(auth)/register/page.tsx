import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { getOptionalAuthContext } from "@/modules/authorization/require-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Đăng ký tài khoản",
};

export default async function RegisterPage() {
  const authContext = await getOptionalAuthContext();
  if (authContext) {
    redirect("/dashboard");
  }

  return <RegisterForm />;
}
