"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowRight,
  BarChart3,
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock,
  FolderKanban,
  Gauge,
  KeyRound,
  ListChecks,
  Shield,
  Users,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectStatusBadge, RoleBadge, SprintStatusBadge } from "@/components/shared/status-badge";
import { MyAssignedTasksCard } from "@/components/tasks/my-assigned-tasks-card";
import { formatHcmDateTimeVi, formatHcmDateVi } from "@/lib/timezone";
import type { OperationalDashboardDTO } from "@/modules/dashboard/dashboard.service";

interface OperationalDashboardClientProps {
  actorName: string;
  actorEmail: string;
  actorRoles: string[];
  permissionCount: number;
  dashboard: OperationalDashboardDTO;
}

function getTimelineStateDescription(
  timeline: NonNullable<OperationalDashboardDTO["timelineProgress"]>
): string {
  if (!timeline.hasTimelineDates || timeline.state === "NO_DATES") {
    return "Chưa thiết lập ngày bắt đầu / kết thúc cho Project này.";
  }
  switch (timeline.state) {
    case "NOT_STARTED":
      return `Chưa đến ngày bắt đầu (${formatHcmDateVi(timeline.startDate!)} → ${formatHcmDateVi(timeline.endDate!)})`;
    case "PAST_END_DATE":
      return `Đã qua mốc kết thúc ${formatHcmDateVi(timeline.endDate!)} (+${timeline.overdueDays} ngày)`;
    case "IN_WINDOW":
      return `${timeline.elapsedDays}/${timeline.totalDays} ngày (${formatHcmDateVi(timeline.startDate!)} → ${formatHcmDateVi(timeline.endDate!)})`;
  }
}

export function OperationalDashboardClient({
  actorName,
  actorEmail,
  actorRoles,
  permissionCount,
  dashboard,
}: OperationalDashboardClientProps) {
  const router = useRouter();
  const {
    permissions,
    accessibleProjects,
    selectedProject,
    workspaceProjectSummary,
    accountSummary,
    notificationSummary,
    taskSummary,
    timelineProgress,
    sprintSummary,
    activeSprints,
    myAssignedTasks,
    recentActivity,
  } = dashboard;

  const displayedSprints = activeSprints.length > 0 ? activeSprints : sprintSummary ? [sprintSummary] : [];

  function handleProjectChange(projectId: string) {
    router.push(`/dashboard?projectId=${encodeURIComponent(projectId)}`);
  }

  return (
    <div className="space-y-6">
      {/* Header & Project Switcher */}
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 lg:flex-row lg:items-end">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Vận hành hàng ngày · Operational Dashboard
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Xin chào, {actorName}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{actorEmail}</span>
            <span>·</span>
            {actorRoles.map((role) => (
              <RoleBadge key={role} role={role} />
            ))}
            <span>·</span>
            <span className="text-xs">{permissionCount} quyền đang hoạt động</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {permissions.canReadNotifications && notificationSummary && (
            <Button asChild variant="outline" size="sm">
              <Link href="/notifications">
                <Bell className="h-4 w-4" />
                Thông báo
                {notificationSummary.unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-[11px]">
                    {notificationSummary.unreadCount}
                  </Badge>
                )}
              </Link>
            </Button>
          )}

          {accessibleProjects.length > 0 && selectedProject && (
            <div className="flex min-w-[260px] flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Project đang theo dõi (Mặc định ACTIVE trước)
              </span>
              <Select value={selectedProject.id} onValueChange={handleProjectChange}>
                <SelectTrigger aria-label="Chọn Project trên Dashboard">
                  <SelectValue placeholder="Chọn Project" />
                </SelectTrigger>
                <SelectContent>
                  {accessibleProjects.map((proj) => (
                    <SelectItem key={proj.id} value={proj.id}>
                      {proj.name} (
                      {proj.status === "ACTIVE"
                        ? "ACTIVE"
                        : proj.status === "ARCHIVED"
                          ? "Archived"
                          : "Created"}
                      )
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Selected Project Read-Only Banner when ARCHIVED (DEC-053) */}
      {selectedProject?.isReadOnly && (
        <Alert>
          <Archive className="h-4 w-4" />
          <AlertTitle>Đang xem Project ở trạng thái Đã lưu trữ (Archived · Read-only)</AlertTitle>
          <AlertDescription>
            Project <strong>{selectedProject.name}</strong> đã lưu trữ. Bạn vẫn có thể kiểm tra toàn
            bộ tiến độ, Sprint, báo cáo và lịch sử hoạt động nhưng mọi thao tác chỉnh sửa đã được
            khóa.
          </AlertDescription>
        </Alert>
      )}

      {/* Project Hero Operational Overview */}
      {selectedProject ? (
        <Card>
          <CardHeader className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-xl">{selectedProject.name}</CardTitle>
                <ProjectStatusBadge status={selectedProject.status} />
              </div>
              <CardDescription>
                Leader: <strong>{selectedProject.leaderName}</strong> ·{" "}
                {selectedProject.activeMemberCount} thành viên đang tham gia
                {selectedProject.startDate && selectedProject.endDate
                  ? ` · ${formatHcmDateVi(selectedProject.startDate)} – ${formatHcmDateVi(selectedProject.endDate)}`
                  : ""}
              </CardDescription>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/projects/${selectedProject.id}`}>
                  Chi tiết Project
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              {permissions.canReadTasks && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/projects/${selectedProject.id}/kanban`}>Kanban Board</Link>
                </Button>
              )}
              {permissions.canReadReports && (
                <Button asChild size="sm">
                  <Link href={`/projects/${selectedProject.id}/reports`}>
                    <BarChart3 className="h-4 w-4" />
                    Phân tích chi tiết
                  </Link>
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Task KPI Cards (gated by task.read) */}
            {permissions.canReadTasks && taskSummary && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs font-medium text-muted-foreground">Tổng Task</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{taskSummary.totalTasks}</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
                  <p className="text-xs font-medium text-emerald-700">Hoàn thành (Done)</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-900">
                    {taskSummary.doneCount}
                  </p>
                </div>
                <div className="rounded-lg border border-sky-200 bg-sky-50/70 p-3">
                  <p className="text-xs font-medium text-sky-700">Đang làm (In Progress)</p>
                  <p className="mt-1 text-2xl font-bold text-sky-900">
                    {taskSummary.inProgressCount}
                  </p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
                  <p className="text-xs font-medium text-amber-700">Chờ Review</p>
                  <p className="mt-1 text-2xl font-bold text-amber-900">
                    {taskSummary.reviewCount}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                  <p className="text-xs font-medium text-slate-600">To Do</p>
                  <p className="mt-1 text-2xl font-bold text-slate-800">{taskSummary.todoCount}</p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50/70 p-3">
                  <p className="text-xs font-medium text-red-700">Quá hạn (Overdue)</p>
                  <p className="mt-1 text-2xl font-bold text-red-900">{taskSummary.overdueCount}</p>
                </div>
              </div>
            )}

            {/* Two Strictly Separated Progress Bars (DEC-051) */}
            <div className="grid gap-4 md:grid-cols-2">
              {permissions.canReadTasks && taskSummary && (
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-900">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Tiến độ hoàn thành công việc (Task Work Progress)
                    </span>
                    <span className="font-bold text-emerald-700">
                      {taskSummary.workProgressPercent}% ({taskSummary.doneCount}/
                      {taskSummary.totalTasks})
                    </span>
                  </div>
                  <div
                    className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
                    role="progressbar"
                    aria-label="Tiến độ hoàn thành Task"
                    aria-valuenow={taskSummary.workProgressPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all"
                      style={{
                        width: `${Math.min(100, Math.max(0, taskSummary.workProgressPercent))}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Tính theo số Task ở trạng thái DONE trên tổng số Task của Project (DEC-033).
                  </p>
                </div>
              )}

              {timelineProgress && (
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-900">
                      <CalendarClock className="h-4 w-4 text-indigo-600" />
                      Tiến độ thời gian Project (Project Timeline)
                    </span>
                    <span className="font-bold text-indigo-700">
                      {timelineProgress.progressPercent !== null
                        ? `${timelineProgress.progressPercent}%`
                        : "Chưa có lịch"}
                    </span>
                  </div>
                  <div
                    className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
                    role="progressbar"
                    aria-label="Tiến độ thời gian Project"
                    aria-valuenow={timelineProgress.progressPercent ?? 0}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className={`h-full rounded-full transition-all ${
                        timelineProgress.state === "PAST_END_DATE"
                          ? "bg-amber-500"
                          : "bg-indigo-600"
                      }`}
                      style={{
                        width: `${Math.min(100, Math.max(0, timelineProgress.progressPercent ?? 0))}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {getTimelineStateDescription(timelineProgress)}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderKanban className="h-4 w-4 text-primary" />
              Chưa có Project khả dụng
            </CardTitle>
            <CardDescription>
              Bạn hiện chưa tham gia Project nào hoặc chưa được cấp quyền xem thông tin Project.
            </CardDescription>
          </CardHeader>
          {permissions.canCreateProject && (
            <CardContent>
              <Button asChild size="sm">
                <Link href="/projects/new">Tạo Project đầu tiên</Link>
              </Button>
            </CardContent>
          )}
        </Card>
      )}

      {/* Middle Grid: Sprint Progress + My Assigned Tasks */}
      <div className="grid gap-4 lg:grid-cols-2">
        {permissions.canReadSprints && selectedProject && (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Gauge className="h-4 w-4 text-primary" />
                  Tiến độ Sprint
                  {activeSprints.length > 1 && (
                    <Badge variant="secondary" className="text-xs">
                      {activeSprints.length} đang chạy
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {activeSprints.length > 1
                    ? `Các Sprint đang chạy song song của Project ${selectedProject.name}`
                    : `Sprint trọng tâm của Project ${selectedProject.name}`}
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/projects/${selectedProject.id}/sprints`}>Danh sách Sprint</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {displayedSprints.length > 0 ? (
                displayedSprints.map((sprintItem) => (
                  <div key={sprintItem.id} className="space-y-3 rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        href={`/projects/${selectedProject.id}/sprints/${sprintItem.id}`}
                        className="font-semibold text-slate-900 hover:text-primary hover:underline"
                      >
                        {sprintItem.name}
                      </Link>
                      <SprintStatusBadge status={sprintItem.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatHcmDateVi(sprintItem.startDate)} →{" "}
                      {formatHcmDateVi(sprintItem.endDate)} · {sprintItem.taskStats.doneCount}/
                      {sprintItem.taskStats.totalTasks} Task DONE
                    </p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span>Hoàn thành Sprint</span>
                        <span>{sprintItem.taskStats.progressPercent}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{
                            width: `${Math.min(100, Math.max(0, sprintItem.taskStats.progressPercent))}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>In Progress: {sprintItem.taskStats.inProgressCount}</span>
                      <span>Review: {sprintItem.taskStats.reviewCount}</span>
                      {sprintItem.taskStats.overdueCount > 0 && (
                        <span className="flex items-center gap-1 font-medium text-red-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Quá hạn: {sprintItem.taskStats.overdueCount}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Project hiện chưa có Sprint nào được khởi tạo.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {permissions.canReadTasks && <MyAssignedTasksCard tasks={myAssignedTasks} />}
      </div>

      {/* Bottom Row: Recent Activity (DEC-052 filtered) + Workspace Admin Summary Cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        {permissions.canReadActivity && selectedProject && recentActivity && (
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-primary" />
                  Hoạt động gần đây ({recentActivity.items.length})
                </CardTitle>
                <CardDescription>
                  {recentActivity.isMemberRestricted
                    ? "Chỉ hiển thị hoạt động của bạn và các Task bạn tham gia trong Project."
                    : `Dòng thời gian thống nhất mới nhất của ${selectedProject.name}.`}
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/activity?projectId=${selectedProject.id}`}>
                  Xem toàn bộ
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentActivity.items.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Chưa có hoạt động nào được ghi nhận trong Project này.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {recentActivity.items.map((item) => (
                    <div
                      key={item.cursorKey}
                      className="flex flex-col justify-between gap-1 py-2.5 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {item.source === "TASK" ? "Task" : "Workspace"}
                          </Badge>
                          {item.targetUrl ? (
                            <Link
                              href={item.targetUrl}
                              className="truncate text-sm font-medium text-slate-900 hover:text-primary hover:underline"
                            >
                              {item.summary}
                            </Link>
                          ) : (
                            <span className="truncate text-sm font-medium text-slate-900">
                              {item.summary}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {item.actor ? item.actor.fullName : "Hệ thống"} · {item.action}
                        </p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatHcmDateTimeVi(item.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Governance & Workspace Summary Widgets */}
        <div className="space-y-4">
          {permissions.canReadProjects && workspaceProjectSummary && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ListChecks className="h-4 w-4 text-primary" />
                  Tổng quan Workspace ({workspaceProjectSummary.total})
                </CardTitle>
                <CardDescription>
                  {workspaceProjectSummary.activeCount} ACTIVE ·{" "}
                  {workspaceProjectSummary.createdCount} mới tạo ·{" "}
                  {workspaceProjectSummary.archivedCount} Archived
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/projects">Quản lý Project</Link>
                </Button>
                {permissions.canReadReports && (
                  <Button asChild variant="outline" size="sm">
                    <Link href="/reports">Báo cáo &amp; Phân tích</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {(permissions.canReadAccounts || permissions.canManageRoles) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-4 w-4 text-primary" />
                  Quản trị hệ thống
                </CardTitle>
                {accountSummary && (
                  <CardDescription>
                    {accountSummary.activeAccounts}/{accountSummary.totalAccounts} tài khoản hoạt
                    động · {accountSummary.pendingAccounts} chờ duyệt
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {permissions.canReadAccounts && (
                  <Button asChild variant="outline" size="sm">
                    <Link href="/admin/users">
                      <Users className="h-4 w-4" />
                      Tài khoản
                    </Link>
                  </Button>
                )}
                {permissions.canManageRoles && (
                  <Button asChild variant="outline" size="sm">
                    <Link href="/admin/roles">
                      <KeyRound className="h-4 w-4" />
                      Ma trận RBAC
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
