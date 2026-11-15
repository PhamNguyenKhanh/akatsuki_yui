import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ProjectStatus, SprintStatus } from "@prisma/client";
import { SprintDetailClient } from "@/components/sprints/sprint-detail-client";
import { isAppError } from "@/lib/errors";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { hasPermission } from "@/modules/authorization/policy.service";
import { requirePermissionOrRedirect } from "@/modules/authorization/require-auth";
import { isWorkspaceAdmin } from "@/modules/projects/project.access";
import { getSprintProgressAndBurndownService } from "@/modules/sprints/sprint-analytics.service";
import { listSprintBacklogCandidatesService } from "@/modules/sprints/sprint-planning.service";
import type { SprintDetailDTO, SprintTargetOptionDTO } from "@/modules/sprints/sprint.repository";
import { normalizePageSearchParams } from "@/modules/sprints/sprint-route-helpers";
import {
  getSprintDetailService,
  listProjectSprintsService,
} from "@/modules/sprints/sprint.service";

export const metadata: Metadata = {
  title: "Chi tiết Sprint",
};

type SprintDetailPageProps = {
  params: Promise<{ projectId: string; sprintId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SprintDetailPage({ params, searchParams }: SprintDetailPageProps) {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.SPRINT_READ);
  const { projectId, sprintId } = await params;
  const rawQuery = normalizePageSearchParams(await searchParams);

  let sprint: SprintDetailDTO;
  try {
    sprint = await getSprintDetailService(actor, sprintId);
  } catch (error) {
    if (isAppError(error)) {
      if (error.code === "FORBIDDEN") redirect("/access-denied?reason=forbidden");
      if (
        error.code === "SPRINT_NOT_FOUND" ||
        error.code === "NOT_FOUND" ||
        error.code === "VALIDATION_ERROR"
      ) {
        notFound();
      }
    }
    throw error;
  }

  if (sprint.projectId !== projectId) {
    notFound();
  }

  const isAdminOrLeader = isWorkspaceAdmin(actor) || sprint.project.leaderId === actor.userId;
  const canManageSprint = hasPermission(actor, PERMISSIONS.SPRINT_MANAGE) && isAdminOrLeader;
  const canReadTasks = hasPermission(actor, PERMISSIONS.TASK_READ);
  const isPlanningEligible =
    sprint.status === SprintStatus.PLANNED || sprint.status === SprintStatus.ACTIVE;

  const [analytics, projectSprints, backlogPage] = await Promise.all([
    getSprintProgressAndBurndownService(actor, sprint.id),
    listProjectSprintsService(actor, sprint.projectId),
    canManageSprint &&
    canReadTasks &&
    isPlanningEligible &&
    sprint.project.status !== ProjectStatus.ARCHIVED
      ? listSprintBacklogCandidatesService(actor, sprint.projectId)
      : Promise.resolve(null),
  ]);

  const targetSprints: SprintTargetOptionDTO[] = projectSprints
    .filter(
      (candidate) =>
        candidate.id !== sprint.id &&
        (candidate.status === SprintStatus.PLANNED || candidate.status === SprintStatus.ACTIVE)
    )
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      status: candidate.status,
      startDate: candidate.startDate,
      endDate: candidate.endDate,
    }));

  return (
    <SprintDetailClient
      sprint={sprint}
      analytics={analytics}
      targetSprints={targetSprints}
      backlogCandidates={backlogPage?.items ?? []}
      canManageSprint={canManageSprint}
      overlapWarning={rawQuery.overlap}
    />
  );
}
