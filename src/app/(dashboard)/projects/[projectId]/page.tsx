import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProjectStatus } from "@prisma/client";
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  CalendarClock,
  ExternalLink,
  History,
  Layers,
  Target,
  UserCheck,
  Video,
} from "lucide-react";
import { ProjectDetailActions } from "@/components/projects/project-detail-actions";
import { ProjectMembersPanel } from "@/components/projects/project-members-panel";
import { ProjectStatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isAppError } from "@/lib/errors";
import { sanitizeExternalHttpUrl } from "@/lib/safe-url";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { hasPermission } from "@/modules/authorization/policy.service";
import { requirePermissionOrRedirect } from "@/modules/authorization/require-auth";
import { listProjectMembersService } from "@/modules/project-members/member.service";
import { isWorkspaceAdmin } from "@/modules/projects/project.access";
import type { ProjectDTO } from "@/modules/projects/project.repository";
import {
  getProjectDetailService,
  listProjectUserCandidatesService,
} from "@/modules/projects/project.service";

export const metadata: Metadata = {
  title: "Chi tiết Project",
};

type ProjectDetailPageProps = {
  params: Promise<{ projectId: string }>;
};

function formatDate(isoString: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(isoString));
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.PROJECT_READ);
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

  const isAdmin = isWorkspaceAdmin(actor);
  const isAdminOrLeader = isAdmin || project.leaderId === actor.userId;

  const canManageMembers =
    hasPermission(actor, PERMISSIONS.PROJECT_MEMBER_MANAGE) && isAdminOrLeader;
  const canReadTasks = hasPermission(actor, PERMISSIONS.TASK_READ);
  const canReadSprints = hasPermission(actor, PERMISSIONS.SPRINT_READ);
  const canReadDocuments = hasPermission(actor, PERMISSIONS.DOCUMENT_READ);
  const canReadSchedule = hasPermission(actor, PERMISSIONS.SCHEDULE_READ);
  const canReadMeetings = hasPermission(actor, PERMISSIONS.MEETING_READ);
  const canReadReports = hasPermission(actor, PERMISSIONS.REPORT_READ);
  const canReadActivity = hasPermission(actor, PERMISSIONS.ACTIVITY_READ);
  const canManageSprint = hasPermission(actor, PERMISSIONS.SPRINT_MANAGE) && isAdminOrLeader;
  const canCreateTask =
    hasPermission(actor, PERMISSIONS.TASK_CREATE) &&
    isAdminOrLeader &&
    project.status !== ProjectStatus.ARCHIVED;

  const { getProjectTaskStatsService } = await import("@/modules/tasks/task.service");
  const { ProjectTaskSummaryCard } = await import("@/components/tasks/project-task-summary-card");
  const { listProjectSprintsService } = await import("@/modules/sprints/sprint.service");
  const { listBacklogTasksService } = await import("@/modules/sprints/sprint-planning.service");
  const { ProjectSprintSummaryCard } =
    await import("@/components/sprints/project-sprint-summary-card");
  const {
    listPinnedProjectDocumentsService,
    listProjectDocumentsService,
  } = await import("@/modules/documents/document.service");
  const { PinnedToolkitBar } =
    await import("@/components/features/documents/pinned-toolkit-bar");
  const { ProjectDocumentSummaryCard } =
    await import("@/components/features/documents/project-document-summary-card");

  const canLoadCandidateLists = canManageMembers && project.status !== ProjectStatus.ARCHIVED;

  const [
    members,
    addableUserCandidates,
    leaderChangeCandidates,
    taskStats,
    projectSprints,
    backlogPreview,
    documentPreview,
    pinnedDocuments,
  ] = await Promise.all([
    listProjectMembersService(actor, project.id, { includeHistory: true }),
    canLoadCandidateLists
      ? listProjectUserCandidatesService(actor, {
          kind: "member",
          projectId: project.id,
          excludeCurrentMembers: "true",
        })
      : Promise.resolve([]),
    canLoadCandidateLists
      ? listProjectUserCandidatesService(actor, {
          kind: "member",
          projectId: project.id,
          excludeCurrentMembers: "false",
        })
      : Promise.resolve([]),
    canReadTasks ? getProjectTaskStatsService(actor, project.id) : Promise.resolve(null),
    canReadSprints ? listProjectSprintsService(actor, project.id) : Promise.resolve(null),
    canReadSprints && canReadTasks
      ? listBacklogTasksService(actor, project.id, { pageSize: 1 })
      : Promise.resolve(null),
    canReadDocuments
      ? listProjectDocumentsService(actor, project.id, { pageSize: 3 })
      : Promise.resolve(null),
    canReadDocuments
      ? listPinnedProjectDocumentsService(actor, project.id)
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link href="/projects">
                <ArrowLeft className="h-4 w-4" />
                <span>Danh sách Project</span>
              </Link>
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{project.name}</h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Khởi tạo bởi <strong>{project.createdBy.fullName}</strong> · Ngày tạo{" "}
            {formatDate(project.createdAt)}
            {project.archivedAt ? ` · Đã Archive ngày ${formatDate(project.archivedAt)}` : ""}
          </p>
        </div>

        <ProjectDetailActions
          project={project}
          capabilities={{
            canEdit: hasPermission(actor, PERMISSIONS.PROJECT_UPDATE) && isAdminOrLeader,
            canActivate: hasPermission(actor, PERMISSIONS.PROJECT_ACTIVATE) && isAdminOrLeader,
            canArchive: hasPermission(actor, PERMISSIONS.PROJECT_ARCHIVE) && isAdminOrLeader,
            canRestore: hasPermission(actor, PERMISSIONS.PROJECT_RESTORE) && isAdmin,
          }}
        />
      </div>

      {canReadDocuments && (
        <PinnedToolkitBar projectId={project.id} pinnedDocuments={pinnedDocuments} />
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <UserCheck className="h-4 w-4" />
              <span>Điều phối &amp; Hướng dẫn</span>
            </CardDescription>
            <CardTitle className="text-base">{project.leader.fullName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            <p>Leader: {project.leader.email}</p>
            <p>
              Giảng viên:{" "}
              {project.instructor
                ? `${project.instructor.fullName} (${project.instructor.email})`
                : "Không chỉ định (Tùy chọn)"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>Thời gian thực hiện</span>
            </CardDescription>
            <CardTitle className="text-base">
              {formatDate(project.startDate)} – {formatDate(project.endDate)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {project.template
              ? `Khởi tạo từ Template: ${project.template.name}`
              : "Khởi tạo độc lập (Không dùng Template)"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Layers className="h-4 w-4" />
              <span>Repository &amp; Công nghệ</span>
            </CardDescription>
            <CardTitle className="truncate text-base">
              {(() => {
                const safeRepositoryUrl = sanitizeExternalHttpUrl(project.repositoryUrl);
                if (!safeRepositoryUrl) {
                  return "Chưa gắn Repository URL";
                }
                return (
                  <a
                    href={safeRepositoryUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-slate-900 hover:underline"
                  >
                    <span className="truncate">Mở Repository</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </a>
                );
              })()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {project.technologies.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {project.technologies.map((tech) => (
                  <Badge key={tech} variant="outline" className="text-xs">
                    {tech}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Chưa khai báo tech stack.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-slate-700" />
              <span>Mô tả &amp; Mục tiêu</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Mô tả tổng quan
              </p>
              <p className="mt-1 whitespace-pre-line text-slate-700">
                {project.description ?? "Chưa cập nhật mô tả."}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Mục tiêu (Objectives)
              </p>
              <p className="mt-1 whitespace-pre-line text-slate-700">
                {project.objectives ?? "Chưa cập nhật mục tiêu."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Phạm vi (Scope)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="whitespace-pre-line text-slate-700">
              {project.scope ?? "Chưa cập nhật phạm vi đề tài."}
            </p>
          </CardContent>
        </Card>
      </div>

      {taskStats && (
        <ProjectTaskSummaryCard
          projectId={project.id}
          stats={taskStats}
          canCreateTask={canCreateTask}
        />
      )}

      {(canReadSchedule || canReadMeetings || canReadReports || canReadActivity) && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <span className="text-sm font-medium text-slate-800">
            Điều phối, Phân tích &amp; Nhật ký Project:
          </span>
          {canReadSchedule && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/projects/${project.id}/schedule`}>
                <CalendarClock className="h-4 w-4" />
                Lịch bận (Schedule)
              </Link>
            </Button>
          )}
          {canReadMeetings && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/projects/${project.id}/meetings`}>
                <Video className="h-4 w-4" />
                Cuộc họp (Meet)
              </Link>
            </Button>
          )}
          {canReadReports && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/projects/${project.id}/reports`}>
                <BarChart3 className="h-4 w-4" />
                Báo cáo &amp; Phân tích
              </Link>
            </Button>
          )}
          {canReadActivity && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/activity?projectId=${project.id}`}>
                <History className="h-4 w-4" />
                Lịch sử hoạt động
              </Link>
            </Button>
          )}
        </div>
      )}

      {projectSprints && (
        <ProjectSprintSummaryCard
          projectId={project.id}
          sprints={projectSprints}
          backlogTotalCount={backlogPreview?.totalItems ?? 0}
          canManageSprint={canManageSprint}
          isArchived={project.status === ProjectStatus.ARCHIVED}
        />
      )}

      {documentPreview && (
        <ProjectDocumentSummaryCard
          projectId={project.id}
          documents={documentPreview.items}
          totalCount={documentPreview.totalItems}
        />
      )}

      <ProjectMembersPanel
        projectId={project.id}
        projectStatus={project.status}
        currentLeaderId={project.leaderId}
        members={members}
        addableUserCandidates={addableUserCandidates}
        leaderChangeCandidates={leaderChangeCandidates}
        canManageMembers={canManageMembers}
      />
    </div>
  );
}
