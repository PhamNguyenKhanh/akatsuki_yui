import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getOptionalAuthContext } from "@/modules/authorization/require-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Đăng nhập",
};

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const authContext = await getOptionalAuthContext();
  if (authContext) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  return <LoginForm callbackUrl={params.callbackUrl} />;
}
