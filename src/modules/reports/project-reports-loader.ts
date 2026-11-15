import "server-only";
import { SprintStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { hasPermission } from "@/modules/authorization/policy.service";
import { sortAndSelectDashboardProject } from "@/modules/dashboard/dashboard.service";
import { buildAccessibleProjectsWhere } from "@/modules/projects/project.access";
import { getMemberContributionReportService } from "@/modules/reports/member-contribution.service";
import { getProjectAnalyticsService } from "@/modules/reports/project-analytics.service";
import { getProjectSprintReportService } from "@/modules/reports/sprint-report.service";
import { getSprintProgressAndBurndownService } from "@/modules/sprints/sprint-analytics.service";
import type { AuthContext } from "@/types/auth";

export async function loadAccessibleReportProjects(actor: AuthContext) {
  const rows = await prisma.project.findMany({
    where: buildAccessibleProjectsWhere(actor),
    select: {
      id: true,
      name: true,
      status: true,
      updatedAt: true,
    },
  });
  return sortAndSelectDashboardProject(rows);
}

export async function loadProjectReportsPageBundle(actor: AuthContext, projectId: string) {
  const canReadSprints = hasPermission(actor, PERMISSIONS.SPRINT_READ);

  const [{ ordered }, analytics, memberContribution, sprintReport] = await Promise.all([
    loadAccessibleReportProjects(actor),
    getProjectAnalyticsService(actor, projectId, { preset: "30d" }),
    getMemberContributionReportService(actor, projectId, { preset: "30d", includeRemoved: true }),
    getProjectSprintReportService(actor, projectId),
  ]);

  const preferredSprint =
    sprintReport.sprints.find((s) => s.status === SprintStatus.ACTIVE) ??
    sprintReport.sprints.find((s) => s.status === SprintStatus.COMPLETED) ??
    sprintReport.sprints[0] ??
    null;

  const initialBurndown =
    canReadSprints && preferredSprint
      ? await getSprintProgressAndBurndownService(actor, preferredSprint.sprintId).catch(() => null)
      : null;

  return {
    accessibleProjects: ordered.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
    })),
    initialAnalytics: analytics,
    initialMemberContribution: memberContribution,
    initialSprintReport: sprintReport,
    initialBurndown,
    canReadSprints,
  };
}
