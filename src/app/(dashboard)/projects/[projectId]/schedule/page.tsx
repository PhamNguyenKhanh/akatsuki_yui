import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProjectScheduleClient } from "@/components/schedule/project-schedule-client";
import { ProjectStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { isAppError } from "@/lib/errors";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { requirePermissionOrRedirect } from "@/modules/authorization/require-auth";
import type { ProjectDTO } from "@/modules/projects/project.repository";
import { getProjectDetailService } from "@/modules/projects/project.service";
import { getProjectWeeklyScheduleService } from "@/modules/schedule/schedule.service";
import { normalizePageSearchParams } from "@/modules/sprints/sprint-route-helpers";

export const metadata: Metadata = {
  title: "Lịch bận (Schedule)",
};

type ProjectSchedulePageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectSchedulePage({
  params,
  searchParams,
}: ProjectSchedulePageProps) {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.SCHEDULE_READ);
  const { projectId } = await params;
  const rawQuery = normalizePageSearchParams(await searchParams);

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

  let initialSchedule;
  try {
    initialSchedule = await getProjectWeeklyScheduleService(actor, project.id, {
      ...(rawQuery.weekStart ? { weekStart: rawQuery.weekStart } : {}),
    });
  } catch (error) {
    if (isAppError(error) && error.code === "VALIDATION_ERROR") {
      initialSchedule = await getProjectWeeklyScheduleService(actor, project.id, {});
    } else {
      throw error;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Lịch bận (Schedule) · {project.name}
            </h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Theo dõi khung giờ bận theo tuần của từng thành viên để dễ dàng sắp xếp lịch họp và phân
            công công việc.
          </p>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link href={`/projects/${project.id}`}>
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại Project</span>
          </Link>
        </Button>
      </div>

      <ProjectScheduleClient
        projectId={project.id}
        projectStatus={project.status}
        currentUserId={actor.userId}
        schedule={initialSchedule}
      />
    </div>
  );
}
