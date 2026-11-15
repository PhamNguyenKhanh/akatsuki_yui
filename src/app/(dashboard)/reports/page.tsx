import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { ProjectReportsClient } from "@/components/reports/project-reports-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isAppError } from "@/lib/errors";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { requirePermissionOrRedirect } from "@/modules/authorization/require-auth";
import {
  loadAccessibleReportProjects,
  loadProjectReportsPageBundle,
} from "@/modules/reports/project-reports-loader";

export const metadata: Metadata = {
  title: "Báo cáo & Phân tích | Akatsuki Yui",
};

interface GlobalReportsPageProps {
  searchParams: Promise<{ projectId?: string }>;
}

export default async function GlobalReportsPage({ searchParams }: GlobalReportsPageProps) {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.REPORT_READ);
  const resolved = await searchParams;
  const requestedProjectId =
    typeof resolved.projectId === "string" && resolved.projectId.trim().length > 0
      ? resolved.projectId.trim()
      : undefined;

  const { ordered, selected } = await loadAccessibleReportProjects(actor);
  const targetProjectId = requestedProjectId ?? selected?.id;

  if (!targetProjectId) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <BarChart3 className="h-6 w-6 text-primary" />
            Báo cáo &amp; Phân tích Project
          </h1>
          <p className="text-sm text-muted-foreground">
            Bạn hiện chưa tham gia Project nào để xem báo cáo phân tích.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Chưa có Project khả dụng</CardTitle>
            <CardDescription>
              Khi bạn tham gia hoặc được phân công vào một Project, báo cáo tiến độ, đóng góp thành
              viên và Sprint Analytics sẽ hiển thị tại đây.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">Quay lại Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  let bundle;
  try {
    bundle = await loadProjectReportsPageBundle(actor, targetProjectId);
  } catch (error) {
    if (isAppError(error)) {
      if (error.code === "FORBIDDEN") redirect("/access-denied?reason=forbidden");
      if (error.code === "NOT_FOUND" || error.code === "VALIDATION_ERROR") {
        if (ordered.length > 0 && ordered[0].id !== targetProjectId) {
          redirect(`/reports?projectId=${ordered[0].id}`);
        }
        notFound();
      }
    }
    throw error;
  }

  return (
    <ProjectReportsClient
      key={bundle.initialAnalytics.projectId}
      {...bundle}
      switcherMode="global-reports"
    />
  );
}
