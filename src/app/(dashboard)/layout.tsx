import { AppShell } from "@/components/layout/app-shell";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { requireActiveUserOrRedirect } from "@/modules/authorization/require-auth";
import { getUserUnreadNotificationCountService } from "@/modules/notifications/notification.service";
import { getAccessibleActiveProjectSummaryService } from "@/modules/projects/project.service";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireActiveUserOrRedirect();
  const canReadNotifications = user.permissions.includes(PERMISSIONS.NOTIFICATION_READ);
  const canReadProjects = user.permissions.includes(PERMISSIONS.PROJECT_READ);

  const [initialUnreadCount, activeProject] = await Promise.all([
    canReadNotifications
      ? getUserUnreadNotificationCountService(user).then((res) => res.unreadCount)
      : Promise.resolve(0),
    canReadProjects ? getAccessibleActiveProjectSummaryService(user) : Promise.resolve(null),
  ]);

  return (
    <AppShell user={user} initialUnreadCount={initialUnreadCount} activeProject={activeProject}>
      {children}
    </AppShell>
  );
}
