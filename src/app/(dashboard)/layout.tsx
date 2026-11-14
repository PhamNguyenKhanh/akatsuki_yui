import { AppShell } from "@/components/layout/app-shell";
import { requireActiveUserOrRedirect } from "@/modules/authorization/require-auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireActiveUserOrRedirect();
  return <AppShell user={user}>{children}</AppShell>;
}
