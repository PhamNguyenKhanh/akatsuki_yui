import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { ProjectMeetingsClient } from "@/components/meetings/project-meetings-client";
import { ProjectStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { isAppError } from "@/lib/errors";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { hasPermission } from "@/modules/authorization/policy.service";
import { requirePermissionOrRedirect } from "@/modules/authorization/require-auth";
import { getProjectMeetingsBundleService } from "@/modules/meetings/meeting.service";
import type { ProjectDTO } from "@/modules/projects/project.repository";
import { getProjectDetailService } from "@/modules/projects/project.service";

export const metadata: Metadata = {
  title: "Cuộc họp (Google Meet)",
};

type ProjectMeetingsPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectMeetingsPage({ params }: ProjectMeetingsPageProps) {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.MEETING_READ);
  const { projectId } = await params;

  let project: ProjectDTO;
  try {
    project = await getProjectDetailService(actor, projectId);
  } catch (error) {
    if (isAppError(error)) {
      if (error.code === "FORBIDDEN") redirect("/access-denied?reason=forbidden");
      if (error.code === "NOT_FOUND" || error.code === "VALIDATION_ERROR") notFound();
    }
    throw error;
  }

  const bundle = await getProjectMeetingsBundleService(actor, project.id);
  const canReadSchedule = hasPermission(actor, PERMISSIONS.SCHEDULE_READ);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Cuộc họp Google Meet · {project.name}
            </h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Quản lý kho link Google Meet và lên lịch họp tự động kiểm tra trùng lịch bận từ module
            Schedule.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canReadSchedule && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/projects/${project.id}/schedule`}>
                <CalendarClock className="h-4 w-4" />
                <span>Xem Lịch bận</span>
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href={`/projects/${project.id}`}>
              <ArrowLeft className="h-4 w-4" />
              <span>Quay lại Project</span>
            </Link>
          </Button>
        </div>
      </div>

      <ProjectMeetingsClient
        projectId={project.id}
        projectStatus={project.status}
        bundle={bundle}
      />
    </div>
  );
}
