import type { Metadata } from "next";
import { OperationalDashboardClient } from "@/components/dashboard/operational-dashboard-client";
import { requireActiveUserOrRedirect } from "@/modules/authorization/require-auth";
import { getOperationalDashboardService } from "@/modules/dashboard/dashboard.service";

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

  let dashboard;
  try {
    dashboard = await getOperationalDashboardService(
      actor,
      requestedProjectId ? { projectId: requestedProjectId } : {}
    );
  } catch {
    // Fall back safely to Active-first default if an explicit query param is invalid or stale.
    dashboard = await getOperationalDashboardService(actor, {});
  }

  return (
    <OperationalDashboardClient
      actorName={actor.fullName}
      actorEmail={actor.email}
      actorRoles={actor.roles}
      permissionCount={actor.permissions.length}
      dashboard={dashboard}
    />
  );
}
