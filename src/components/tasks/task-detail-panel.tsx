"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProjectStatus, TaskStatus } from "@prisma/client";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Pencil,
  Play,
  Send,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { sanitizeExternalHttpUrl } from "@/lib/safe-url";
import { formatTaskZaloSummary } from "@/lib/zalo-summary";
import { CopyZaloButton } from "@/components/shared/copy-zalo-button";
import { TaskPriorityBadge, TaskStatusBadge } from "@/components/shared/status-badge";
import { TaskAssigneesCard } from "@/components/tasks/task-assignees-card";
import { TaskCommentsPanel } from "@/components/tasks/task-comments-panel";
import { TaskDependenciesCard } from "@/components/tasks/task-dependencies-card";
import { TaskHistoryTimeline } from "@/components/tasks/task-history-timeline";
import { TaskSubtasksCard } from "@/components/tasks/task-subtasks-card";
import type { TaskAssignableMemberOption } from "@/components/tasks/task-list-client";
import { TaskReviewModal, type TaskReviewModalMode } from "@/components/tasks/task-review-modal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateTaskAction, updateTaskStatusAction } from "@/modules/tasks/task.actions";
import type {
  TaskCommentDTO,
  TaskMentionableMemberDTO,
} from "@/modules/tasks/task-comment.service";
import type { TaskSubtaskDTO } from "@/modules/tasks/task-subtask.service";
import type { TaskHistoryItemDTO } from "@/modules/tasks/task-history.repository";
import type { ProjectTaskOptionDTO, TaskDetailDTO } from "@/modules/tasks/task.repository";

function formatDateVi(value: Date | string | null): string {
  if (!value) return "Chưa thiết lập";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

interface TaskDetailPanelProps {
  task: TaskDetailDTO;
  currentUserId: string;
  assignableMembers: TaskAssignableMemberOption[];
  mentionableMembers: TaskMentionableMemberDTO[];
  initialComments: TaskCommentDTO[];
  initialSubtasks: TaskSubtaskDTO[];
  candidateTasks: ProjectTaskOptionDTO[];
  initialHistory: {
    items: TaskHistoryItemDTO[];
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  } | null;
  capabilities: {
    isLeaderOrAdmin: boolean;
    isAssignedMember: boolean;
    isInstructorOnly: boolean;
    canUpdateTask: boolean;
    canAssignTask: boolean;
    canSubmitReview: boolean;
    canReviewTask: boolean;
    canReadHistory: boolean;
  };
}

export function TaskDetailPanel({
  task,
  currentUserId,
  assignableMembers,
  mentionableMembers,
  initialComments,
  initialSubtasks,
  candidateTasks,
  initialHistory,
  capabilities,
}: TaskDetailPanelProps) {
  const router = useRouter();
  const [modalState, setModalState] = React.useState<{
    open: boolean;
    mode: TaskReviewModalMode;
  }>({ open: false, mode: "submit" });
  const [statusBusy, setStatusBusy] = React.useState(false);

  const [progressNotes, setProgressNotes] = React.useState(task.progressNotes ?? "");
  const [referenceLinksText, setReferenceLinksText] = React.useState(
    task.referenceLinks.join("\n")
  );
  const [progressBusy, setProgressBusy] = React.useState(false);
  const [progressError, setProgressError] = React.useState<string | null>(null);

  const isArchived = task.project.status === ProjectStatus.ARCHIVED;
  const isCompletedTask = task.status === TaskStatus.DONE;
  const isReadOnlyTask = isArchived || isCompletedTask;
  const isActorEligibleForWork = capabilities.isLeaderOrAdmin || capabilities.isAssignedMember;

  const canStartWork =
    !isReadOnlyTask &&
    task.status === TaskStatus.TODO &&
    capabilities.canUpdateTask &&
    isActorEligibleForWork;

  const canTriggerSubmitReview =
    !isReadOnlyTask &&
    task.status === TaskStatus.IN_PROGRESS &&
    capabilities.canSubmitReview &&
    isActorEligibleForWork;

  const canTriggerReviewDecision =
    !isReadOnlyTask &&
    task.status === TaskStatus.REVIEW &&
    capabilities.canReviewTask &&
    capabilities.isLeaderOrAdmin;

  const canEditProgress = !isReadOnlyTask && capabilities.canUpdateTask && isActorEligibleForWork;

  const canEditLeaderMetadata =
    !isReadOnlyTask && capabilities.canUpdateTask && capabilities.isLeaderOrAdmin;

  const canManageAssignees =
    !isReadOnlyTask && capabilities.canAssignTask && capabilities.isLeaderOrAdmin;

  async function handleStartWork() {
    setStatusBusy(true);
    const result = await updateTaskStatusAction(task.id, TaskStatus.IN_PROGRESS);
    setStatusBusy(false);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    toast.success(`Đã chuyển ${task.code} sang IN_PROGRESS.`);
    router.refresh();
  }

  async function handleSaveProgress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProgressError(null);

    const referenceLinks = referenceLinksText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    setProgressBusy(true);
    const result = await updateTaskAction(task.id, {
      progressNotes: progressNotes.trim() ? progressNotes : null,
      referenceLinks,
      expectedUpdatedAt:
        typeof task.updatedAt === "string" ? task.updatedAt : task.updatedAt.toISOString(),
    });
    setProgressBusy(false);

    if (!result.ok) {
      setProgressError(result.error.message);
      toast.error(result.error.message);
      return;
    }

    toast.success("Đã lưu ghi chú tiến độ và liên kết tham chiếu.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {isArchived && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Project đã ở trạng thái ARCHIVED</AlertTitle>
          <AlertDescription>
            Toàn bộ thông tin Task chỉ được phép xem (read-only).
          </AlertDescription>
        </Alert>
      )}

      {!isArchived && isCompletedTask && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Task đã hoàn thành (DONE) — Chỉ xem (Read-Only)</AlertTitle>
          <AlertDescription>
            Task đã được duyệt hoàn thành và bị khóa chỉnh sửa hoàn toàn. Các tài liệu bổ sung sau
            nghiệm thu được quản lý trong module Documents.
          </AlertDescription>
        </Alert>
      )}

      {!isArchived && capabilities.isInstructorOnly && (
        <Alert>
          <AlertTitle>Chế độ chỉ xem dành cho Giảng viên (Instructor)</AlertTitle>
          <AlertDescription>
            Instructor có thể theo dõi chi tiết và nhật
            ký thay đổi của Task nhưng không thực hiện thao tác chỉnh sửa hay review.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                {task.code}
              </Badge>
              <TaskStatusBadge status={task.status} />
              <TaskPriorityBadge priority={task.priority} />
              {task.sprint ? (
                <Link href={`/projects/${task.projectId}/sprints/${task.sprint.id}`}>
                  <Badge
                    variant="outline"
                    className="border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100"
                  >
                    Sprint: {task.sprint.name}
                  </Badge>
                </Link>
              ) : (
                <Link href={`/projects/${task.projectId}/backlog`}>
                  <Badge
                    variant="outline"
                    className="border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  >
                    Product Backlog
                  </Badge>
                </Link>
              )}
              {task.isOverdue && (
                <Badge variant="outline" className="border-red-300 bg-red-50 text-red-800">
                  Quá hạn
                </Badge>
              )}
              {task.blockedByCount > 0 && task.status !== TaskStatus.DONE && (
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                  Đang chờ {task.blockedByCount} Task tiền điều kiện
                </Badge>
              )}
            </div>
            <CardTitle className="text-xl text-slate-900">{task.title}</CardTitle>
            <CardDescription>
              Thuộc Project{" "}
              <Link
                href={`/projects/${task.projectId}`}
                className="font-medium text-foreground underline"
              >
                {task.project.name}
              </Link>{" "}
              · Tạo bởi {task.createdBy.fullName}
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-2">
            <CopyZaloButton
              getText={() =>
                formatTaskZaloSummary({
                  code: task.code,
                  title: task.title,
                  projectName: task.project.name,
                  sprintName: task.sprint?.name ?? null,
                  status: task.status,
                  priority: task.priority,
                  deadlineText: formatDateVi(task.deadline),
                  isOverdue: task.isOverdue,
                  blockedByCount: task.blockedByCount,
                  assigneeNames: task.assignees.map((a) => a.user.fullName),
                  progressNotes: task.progressNotes,
                  referenceLinks: task.referenceLinks,
                  taskUrl:
                    typeof window !== "undefined"
                      ? `${window.location.origin}/projects/${task.projectId}/tasks/${task.id}`
                      : undefined,
                })
              }
              successMessage={`Đã copy tóm tắt ${task.code} chuẩn Zalo.`}
            />
            {canStartWork && (
              <Button type="button" size="sm" disabled={statusBusy} onClick={handleStartWork}>
                <Play className="h-4 w-4" />
                <span>{statusBusy ? "Đang chuyển..." : "Bắt đầu thực hiện"}</span>
              </Button>
            )}
            {canTriggerSubmitReview && (
              <Button
                type="button"
                size="sm"
                onClick={() => setModalState({ open: true, mode: "submit" })}
              >
                <Send className="h-4 w-4" />
                <span>Gửi Review</span>
              </Button>
            )}
            {canTriggerReviewDecision && (
              <>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setModalState({ open: true, mode: "approve" })}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Duyệt (Approve)</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => setModalState({ open: true, mode: "reject" })}
                >
                  <XCircle className="h-4 w-4" />
                  <span>Từ chối (Reject)</span>
                </Button>
              </>
            )}
            {canEditLeaderMetadata && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/projects/${task.projectId}/tasks/${task.id}/edit`}>
                  <Pencil className="h-4 w-4" />
                  <span>Chỉnh sửa</span>
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 rounded-lg border border-border bg-muted/20 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Ngày bắt đầu</p>
              <p className="font-medium text-slate-900">{formatDateVi(task.startDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Deadline</p>
              <p
                className={
                  task.isOverdue ? "font-semibold text-red-700" : "font-medium text-slate-900"
                }
              >
                {formatDateVi(task.deadline)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ước lượng giờ</p>
              <p className="font-medium text-slate-900">
                {task.estimateHours !== null ? `${task.estimateHours} giờ` : "Chưa ước lượng"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Hoàn thành lúc</p>
              <p className="font-medium text-slate-900">
                {task.completedAt ? formatDateVi(task.completedAt) : "Chưa DONE"}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold text-slate-900">Mô tả công việc</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {task.description ?? "Chưa có mô tả chi tiết."}
            </p>
          </div>
        </CardContent>
      </Card>

      <TaskSubtasksCard
        projectId={task.projectId}
        taskId={task.id}
        initialSubtasks={initialSubtasks}
        canEdit={canEditProgress}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tiến độ thực hiện &amp; Liên kết tham chiếu</CardTitle>
          <CardDescription>
            Thành viên được phân công có thể cập nhật ghi chú tiến độ và đường dẫn PR/tài liệu tại
            đây.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {task.referenceLinks.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Liên kết hiện tại ({task.referenceLinks.length})
              </p>
              <ul className="space-y-1">
                {task.referenceLinks.map((link) => {
                  const safeLink = sanitizeExternalHttpUrl(link);
                  if (!safeLink) {
                    return null;
                  }
                  return (
                    <li key={safeLink} className="text-sm">
                      <a
                        href={safeLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 break-all text-primary underline"
                      >
                        <span>{safeLink}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {canEditProgress ? (
            <form onSubmit={handleSaveProgress} className="space-y-3 border-t border-border pt-3">
              {progressError && (
                <Alert variant="destructive">
                  <AlertDescription>{progressError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="progress-notes">Ghi chú tiến độ</Label>
                <Textarea
                  id="progress-notes"
                  rows={3}
                  value={progressNotes}
                  onChange={(e) => setProgressNotes(e.target.value)}
                  placeholder="Cập nhật kết quả công việc, vướng mắc hiện tại hoặc checklist đã xong..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="progress-links">
                  Liên kết tham chiếu (mỗi dòng 1 URL http/https, tối đa 20)
                </Label>
                <Textarea
                  id="progress-links"
                  rows={2}
                  value={referenceLinksText}
                  onChange={(e) => setReferenceLinksText(e.target.value)}
                  placeholder="https://github.com/org/repo/pull/12"
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={progressBusy}>
                  {progressBusy ? "Đang lưu..." : "Lưu tiến độ"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ghi chú tiến độ
              </p>
              <p className="whitespace-pre-wrap text-sm text-slate-700">
                {task.progressNotes ?? "Chưa có ghi chú tiến độ."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <TaskAssigneesCard
          projectId={task.projectId}
          taskId={task.id}
          assignees={task.assignees}
          assignableMembers={assignableMembers}
          canManageAssignees={canManageAssignees}
          isArchived={isReadOnlyTask}
        />

        <TaskDependenciesCard
          projectId={task.projectId}
          taskId={task.id}
          dependencies={task.dependencies}
          dependents={task.dependents}
          candidateTasks={candidateTasks}
          canManageDependencies={canEditLeaderMetadata}
          isArchived={isReadOnlyTask}
        />
      </div>

      <TaskCommentsPanel
        projectId={task.projectId}
        taskId={task.id}
        currentUserId={currentUserId}
        isLeaderOrAdmin={capabilities.isLeaderOrAdmin}
        isArchived={isArchived}
        initialComments={initialComments}
        mentionableMembers={mentionableMembers}
      />

      <TaskHistoryTimeline
        key={`${task.id}-${String(task.updatedAt)}`}
        taskId={task.id}
        canReadHistory={capabilities.canReadHistory}
        reviews={task.reviews}
        initialHistory={initialHistory}
      />

      <TaskReviewModal
        open={modalState.open}
        onOpenChange={(open) => setModalState((prev) => ({ ...prev, open }))}
        mode={modalState.mode}
        projectId={task.projectId}
        taskId={task.id}
        taskTitle={task.title}
        taskCode={task.code}
      />
    </div>
  );
}
