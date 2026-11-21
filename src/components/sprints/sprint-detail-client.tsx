"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProjectStatus, SprintStatus, TaskStatus } from "@prisma/client";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Kanban,
  Pencil,
  Play,
  Plus,
  Undo2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { CopyZaloButton } from "@/components/shared/copy-zalo-button";
import {
  SprintStatusBadge,
  TaskPriorityBadge,
  TaskStatusBadge,
} from "@/components/shared/status-badge";
import { formatSprintZaloSummary } from "@/lib/zalo-summary";
import { AssignBacklogDialog } from "@/components/sprints/assign-backlog-dialog";
import { SprintBurndownChart } from "@/components/sprints/sprint-burndown-chart";
import { SprintCompleteModal } from "@/components/sprints/sprint-complete-modal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { SprintAnalyticsDTO } from "@/modules/sprints/sprint-analytics.service";
import {
  activateSprintAction,
  cancelSprintAction,
  moveSprintTaskAction,
} from "@/modules/sprints/sprint.actions";
import type { SprintDetailDTO, SprintTargetOptionDTO } from "@/modules/sprints/sprint.repository";
import { formatSprintDateYmd } from "@/modules/sprints/sprint.schema";
import type { TaskSummaryDTO } from "@/modules/tasks/task.repository";

function formatDateVi(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const [y, m, d] = formatSprintDateYmd(date).split("-");
  return `${d}/${m}/${y}`;
}

function formatDateTimeVi(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

interface PendingTaskMoveConfirmation {
  taskId: string;
  taskCode: string;
  taskTitle: string;
  targetSprintId: string | null;
  targetLabel: string;
}

interface SprintDetailClientProps {
  sprint: SprintDetailDTO;
  analytics: SprintAnalyticsDTO;
  targetSprints: SprintTargetOptionDTO[];
  backlogCandidates: TaskSummaryDTO[];
  canManageSprint: boolean;
  overlapWarning?: string;
}

export function SprintDetailClient({
  sprint,
  analytics,
  targetSprints,
  backlogCandidates,
  canManageSprint,
  overlapWarning,
}: SprintDetailClientProps) {
  const router = useRouter();
  const [busyAction, setBusyAction] = React.useState(false);
  const [assignModalOpen, setAssignModalOpen] = React.useState(false);
  const [completeModalOpen, setCompleteModalOpen] = React.useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");
  const [pendingReviewMove, setPendingReviewMove] =
    React.useState<PendingTaskMoveConfirmation | null>(null);

  const isArchived = sprint.project.status === ProjectStatus.ARCHIVED;
  const isPlanningEligible =
    sprint.status === SprintStatus.PLANNED || sprint.status === SprintStatus.ACTIVE;
  const canEdit = canManageSprint && !isArchived && isPlanningEligible;
  const canActivate =
    canManageSprint &&
    !isArchived &&
    sprint.status === SprintStatus.PLANNED &&
    sprint.project.status === ProjectStatus.ACTIVE;

  async function handleActivate() {
    setBusyAction(true);
    const result = await activateSprintAction(sprint.id);
    setBusyAction(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(`Đã kích hoạt Sprint "${sprint.name}".`);
    router.refresh();
  }

  async function handleConfirmCancel() {
    setBusyAction(true);
    const result = await cancelSprintAction(sprint.id, {
      reason: cancelReason.trim() ? cancelReason.trim() : null,
    });
    setBusyAction(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setCancelDialogOpen(false);
    setCancelReason("");
    toast.success(`Đã hủy Sprint "${sprint.name}" và trả các Task chưa xong về Backlog.`);
    router.refresh();
  }

  async function executeTaskMove(taskId: string, targetSprintId: string | null, label: string) {
    setBusyAction(true);
    const result = await moveSprintTaskAction(sprint.id, taskId, { targetSprintId });
    setBusyAction(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(
      targetSprintId === null ? "Đã trả Task về Product Backlog." : `Đã chuyển Task sang ${label}.`
    );
    router.refresh();
  }

  function requestTaskMove(task: TaskSummaryDTO, targetSprintId: string | null, label: string) {
    if (task.status === TaskStatus.REVIEW) {
      setPendingReviewMove({
        taskId: task.id,
        taskCode: task.code,
        taskTitle: task.title,
        targetSprintId,
        targetLabel: label,
      });
      return;
    }
    void executeTaskMove(task.id, targetSprintId, label);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link href={`/projects/${sprint.projectId}/sprints`}>
                <ArrowLeft className="h-4 w-4" />
                <span>Danh sách Sprints</span>
              </Link>
            </Button>
            <span className="text-xs text-muted-foreground">·</span>
            <Link
              href={`/projects/${sprint.projectId}`}
              className="text-sm font-medium text-muted-foreground hover:underline"
            >
              {sprint.project.name}
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{sprint.name}</h1>
            <SprintStatusBadge status={sprint.status} />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {formatDateVi(sprint.startDate)} – {formatDateVi(sprint.endDate)}
            </span>
            <span>· Tạo bởi {sprint.createdBy.fullName}</span>
          </div>

          {sprint.goal && (
            <p className="max-w-3xl whitespace-pre-line text-sm text-slate-700">{sprint.goal}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <CopyZaloButton
            getText={() =>
              formatSprintZaloSummary({
                sprintName: sprint.name,
                projectName: sprint.project.name,
                status: sprint.status,
                startDateText: formatDateVi(sprint.startDate),
                endDateText: formatDateVi(sprint.endDate),
                totalTasks: analytics.progress.totalTasks,
                doneCount: analytics.progress.doneCount,
                inProgressCount: analytics.progress.inProgressCount,
                reviewCount: analytics.progress.reviewCount,
                todoCount: analytics.progress.todoCount,
                overdueCount: analytics.progress.overdueCount,
                progressPercent: analytics.progress.progressPercent,
                hasEstimateData: analytics.burndown.hasEstimateData,
                completedEstimateHours: analytics.burndown.completedEstimateHours,
                remainingEstimateHours: analytics.burndown.remainingEstimateHours,
                currentScopeHours: analytics.burndown.currentScopeHours,
                reviewTasks: sprint.tasks
                  .filter((t) => t.status === TaskStatus.REVIEW)
                  .map((t) => ({
                    code: t.code,
                    title: t.title,
                    assigneeNames: t.assignees.map((a) => a.user.fullName),
                    deadlineText: formatDateVi(t.deadline),
                  })),
                overdueTasks: sprint.tasks
                  .filter((t) => t.isOverdue && t.status !== TaskStatus.DONE)
                  .map((t) => ({
                    code: t.code,
                    title: t.title,
                    assigneeNames: t.assignees.map((a) => a.user.fullName),
                    deadlineText: formatDateVi(t.deadline),
                  })),
                sprintUrl:
                  typeof window !== "undefined"
                    ? `${window.location.origin}/projects/${sprint.projectId}/sprints/${sprint.id}`
                    : undefined,
              })
            }
            successMessage={`Đã copy báo cáo Sprint "${sprint.name}" chuẩn Zalo.`}
          />

          <Button asChild variant="outline" size="sm">
            <Link href={`/projects/${sprint.projectId}/kanban?scope=SPRINT&sprintId=${sprint.id}`}>
              <Kanban className="h-4 w-4" />
              <span>Kanban Sprint</span>
            </Link>
          </Button>

          {canEdit && (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href={`/projects/${sprint.projectId}/sprints/${sprint.id}/edit`}>
                  <Pencil className="h-4 w-4" />
                  <span>Chỉnh sửa</span>
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAssignModalOpen(true)}
                disabled={busyAction}
              >
                <Plus className="h-4 w-4" />
                <span>Đưa Task từ Backlog</span>
              </Button>
            </>
          )}

          {canManageSprint && !isArchived && sprint.status === SprintStatus.PLANNED && (
            <>
              <Button
                type="button"
                size="sm"
                disabled={!canActivate || busyAction}
                onClick={() => void handleActivate()}
                title={
                  sprint.project.status !== ProjectStatus.ACTIVE
                    ? "Project phải ACTIVE trước khi kích hoạt Sprint"
                    : undefined
                }
              >
                <Play className="h-4 w-4" />
                <span>Kích hoạt Sprint</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={busyAction}
                onClick={() => setCancelDialogOpen(true)}
              >
                <XCircle className="h-4 w-4" />
                <span>Hủy Sprint</span>
              </Button>
            </>
          )}

          {canManageSprint && !isArchived && sprint.status === SprintStatus.ACTIVE && (
            <Button
              type="button"
              size="sm"
              disabled={busyAction}
              onClick={() => setCompleteModalOpen(true)}
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Hoàn thành Sprint</span>
            </Button>
          )}
        </div>
      </div>

      {overlapWarning && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Cảnh báo trùng lịch Sprint (Không chặn thao tác)</AlertTitle>
          <AlertDescription>
            Khoảng thời gian của Sprint này giao với Sprint khác trong cùng Project:{" "}
            <strong>{overlapWarning}</strong>.
          </AlertDescription>
        </Alert>
      )}

      {sprint.status === SprintStatus.PLANNED && sprint.project.status !== ProjectStatus.ACTIVE && (
        <Alert>
          <AlertTitle>Project đang ở trạng thái {sprint.project.status}</AlertTitle>
          <AlertDescription>
            Theo quy định, Project phải ở trạng thái <strong>ACTIVE</strong> mới có thể kích hoạt
            Sprint. Bạn vẫn có thể lập kế hoạch và đưa Task từ Backlog vào Sprint này trước.
          </AlertDescription>
        </Alert>
      )}

      <SprintBurndownChart analytics={analytics} />

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">
              Danh sách công việc trong Sprint ({sprint.tasks.length})
            </CardTitle>
            <CardDescription>
              Toàn bộ Task hiện đang gắn với Sprint. Task đã DONE sẽ được giữ cố định trong Sprint.
            </CardDescription>
          </div>
          {canEdit && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setAssignModalOpen(true)}
            >
              <Plus className="h-4 w-4" />
              <span>Thêm từ Backlog</span>
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {sprint.tasks.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Chưa có Task nào trong Sprint này.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Công việc</TableHead>
                    <TableHead>Ưu tiên</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Người thực hiện</TableHead>
                    {canEdit && <TableHead className="text-right">Điều phối Sprint</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sprint.tasks.map((task) => {
                    const isDone = task.status === TaskStatus.DONE;
                    return (
                      <TableRow key={task.id}>
                        <TableCell className="min-w-[240px]">
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">
                                {task.code}
                              </span>
                              <Link
                                href={`/projects/${sprint.projectId}/tasks/${task.id}`}
                                className="font-medium text-slate-900 hover:text-primary hover:underline"
                              >
                                {task.title}
                              </Link>
                            </div>
                            {task.estimateHours !== null && (
                              <span className="text-xs text-muted-foreground">
                                Ước lượng: {task.estimateHours} giờ
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <TaskPriorityBadge priority={task.priority} />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <TaskStatusBadge status={task.status} />
                            {task.isOverdue && (
                              <Badge
                                variant="outline"
                                className="border-red-300 bg-red-50 text-red-700"
                              >
                                Quá hạn
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          <span className={task.isOverdue ? "font-medium text-red-700" : ""}>
                            {formatDateVi(task.deadline)}
                          </span>
                        </TableCell>
                        <TableCell className="min-w-[160px]">
                          {task.assignees.length === 0 ? (
                            <span className="text-xs text-muted-foreground">Chưa phân công</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {task.assignees.map((assignee) => (
                                <Badge
                                  key={assignee.id}
                                  variant="secondary"
                                  className="font-normal"
                                >
                                  {assignee.user.fullName}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            {isDone ? (
                              <span className="text-xs text-muted-foreground">
                                Đã DONE (giữ trong Sprint)
                              </span>
                            ) : (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={busyAction}
                                  onClick={() => requestTaskMove(task, null, "Product Backlog")}
                                >
                                  <Undo2 className="h-3.5 w-3.5" />
                                  <span>Về Backlog</span>
                                </Button>
                                {targetSprints.length > 0 && (
                                  <Select
                                    disabled={busyAction}
                                    onValueChange={(targetId) => {
                                      const target = targetSprints.find((s) => s.id === targetId);
                                      requestTaskMove(
                                        task,
                                        targetId,
                                        target?.name ?? "Sprint khác"
                                      );
                                    }}
                                  >
                                    <SelectTrigger className="h-8 w-[160px] text-xs">
                                      <SelectValue placeholder="Chuyển Sprint..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {targetSprints.map((target) => (
                                        <SelectItem key={target.id} value={target.id}>
                                          {target.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nhật ký hoạt động Sprint</CardTitle>
          <CardDescription>
            Các sự kiện khởi tạo, kích hoạt, điều chỉnh và tổng kết.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sprint.activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có hoạt động nào được ghi nhận.</p>
          ) : (
            <ol className="space-y-2.5 text-sm">
              {sprint.activities.map((activity) => (
                <li
                  key={activity.id}
                  className="flex flex-col justify-between gap-1 rounded-md border border-border px-3 py-2 sm:flex-row sm:items-center"
                >
                  <div>
                    <Badge variant="outline" className="mr-2 font-mono text-xs">
                      {activity.action}
                    </Badge>
                    <span className="font-medium text-slate-900">
                      {activity.actorName ?? "Hệ thống"}
                    </span>
                    {activity.description && (
                      <p className="mt-1 text-xs text-slate-600">{activity.description}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTimeVi(activity.createdAt)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <AssignBacklogDialog
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        projectId={sprint.projectId}
        sprintId={sprint.id}
        sprintName={sprint.name}
        backlogTasks={backlogCandidates}
      />

      <SprintCompleteModal
        open={completeModalOpen}
        onOpenChange={setCompleteModalOpen}
        sprint={sprint}
      />

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hủy Sprint &ldquo;{sprint.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              Chỉ Sprint ở trạng thái PLANNED mới có thể hủy. Mọi Task chưa DONE trong Sprint này sẽ
              được trả về Product Backlog và ghi nhận trong lịch sử Task.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="cancel-sprint-reason">Lý do hủy Sprint (tuỳ chọn)</Label>
            <Textarea
              id="cancel-sprint-reason"
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ví dụ: Điều chỉnh kế hoạch phạm vi học kỳ..."
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyAction}>Đóng</AlertDialogCancel>
            <AlertDialogAction
              disabled={busyAction}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmCancel();
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {busyAction ? "Đang hủy..." : "Xác nhận hủy Sprint"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingReviewMove !== null}
        onOpenChange={(open) => {
          if (!open) setPendingReviewMove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Task đang chờ Review</AlertDialogTitle>
            <AlertDialogDescription>
              Task{" "}
              <strong>
                {pendingReviewMove?.taskCode} · {pendingReviewMove?.taskTitle}
              </strong>{" "}
              hiện đang ở trạng thái <strong>REVIEW</strong>. Bạn có chắc muốn chuyển Task này sang{" "}
              <strong>{pendingReviewMove?.targetLabel}</strong> không?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyAction}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              disabled={busyAction}
              onClick={(e) => {
                e.preventDefault();
                if (!pendingReviewMove) return;
                const move = pendingReviewMove;
                setPendingReviewMove(null);
                void executeTaskMove(move.taskId, move.targetSprintId, move.targetLabel);
              }}
            >
              Vẫn chuyển Task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
