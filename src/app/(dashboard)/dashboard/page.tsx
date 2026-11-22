import type { Metadata } from "next";
import { OperationalDashboardClient } from "@/components/dashboard/operational-dashboard-client";
import { requireActiveUserOrRedirect } from "@/modules/authorization/require-auth";
import { getOperationalDashboardService } from "@/modules/dashboard/dashboard.service";
import { getMyDayFocusService } from "@/modules/dashboard/my-day-focus.service";

export const metadata: Metadata = {
  title: "Dashboard | Akatsuki Yui",
};

interface DashboardPageProps {
  searchParams: Promise<{ projectId?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const actor = await requireActiveUserOrRedirect();
  const resolvedSearchParams = await searchParams;
  const requestedProjectId =
    typeof resolvedSearchParams.projectId === "string" &&
    resolvedSearchParams.projectId.trim().length > 0
      ? resolvedSearchParams.projectId.trim()
      : undefined;

  const [dashboard, myFocus] = await Promise.all([
    getOperationalDashboardService(
      actor,
      requestedProjectId ? { projectId: requestedProjectId } : {}
    ).catch(() => getOperationalDashboardService(actor, {})),
    getMyDayFocusService(actor),
  ]);

  return (
    <OperationalDashboardClient
      actorName={actor.fullName}
      actorEmail={actor.email}
      actorRoles={actor.roles}
      permissionCount={actor.permissions.length}
      dashboard={dashboard}
      myFocus={myFocus}
    />
  );
}
