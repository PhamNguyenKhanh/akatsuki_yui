import { AppShell } from "@/components/layout/app-shell";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { requireActiveUserOrRedirect } from "@/modules/authorization/require-auth";
import { getUserUnreadNotificationCountService } from "@/modules/notifications/notification.service";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireActiveUserOrRedirect();
  const canReadNotifications = user.permissions.includes(PERMISSIONS.NOTIFICATION_READ);
  const initialUnreadCount = canReadNotifications
    ? (await getUserUnreadNotificationCountService(user)).unreadCount
    : 0;

  return (
    <AppShell user={user} initialUnreadCount={initialUnreadCount}>
      {children}
    </AppShell>
  );
}
