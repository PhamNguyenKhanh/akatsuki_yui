import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ProjectReportsClient } from "@/components/reports/project-reports-client";
import { isAppError } from "@/lib/errors";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { requirePermissionOrRedirect } from "@/modules/authorization/require-auth";
import { loadProjectReportsPageBundle } from "@/modules/reports/project-reports-loader";

export const metadata: Metadata = {
  title: "Báo cáo Project | Akatsuki Yui",
};

interface ProjectReportsPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectReportsPage({ params }: ProjectReportsPageProps) {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.REPORT_READ);
  const { projectId } = await params;

  let bundle;
  try {
    bundle = await loadProjectReportsPageBundle(actor, projectId);
  } catch (error) {
    if (isAppError(error)) {
      if (error.code === "FORBIDDEN") redirect("/access-denied?reason=forbidden");
      if (error.code === "NOT_FOUND" || error.code === "VALIDATION_ERROR") notFound();
    }
    throw error;
  }

  return (
    <ProjectReportsClient
      key={bundle.initialAnalytics.projectId}
      {...bundle}
      switcherMode="project-route"
    />
  );
}
