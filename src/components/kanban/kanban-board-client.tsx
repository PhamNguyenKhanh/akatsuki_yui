"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProjectStatus, TaskPriority, TaskStatus } from "@prisma/client";
import { AlertCircle, Layers, Search, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { KanbanTaskCard } from "@/components/kanban/kanban-task-card";
import type { TaskAssignableMemberOption } from "@/components/tasks/task-list-client";
import { TaskReviewModal, type TaskReviewModalMode } from "@/components/tasks/task-review-modal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePropSyncedState } from "@/lib/use-prop-synced-state";
import { cn } from "@/lib/utils";
import type { KanbanBoardDTO, KanbanCardItemDTO } from "@/modules/sprints/kanban.service";
import type { SprintSummaryDTO } from "@/modules/sprints/sprint.repository";
import { updateTaskStatusAction } from "@/modules/tasks/task.actions";

const ALL_VALUE = "ALL";
const UNASSIGNED_VALUE = "UNASSIGNED";

const KANBAN_COLUMNS: Array<{
  status: TaskStatus;
  title: string;
  headerClass: string;
}> = [
  { status: TaskStatus.TODO, title: "To Do", headerClass: "border-slate-300 bg-slate-100/80" },
  {
    status: TaskStatus.IN_PROGRESS,
    title: "In Progress",
    headerClass: "border-sky-300 bg-sky-50/80",
  },
  { status: TaskStatus.REVIEW, title: "Review", headerClass: "border-amber-300 bg-amber-50/80" },
  { status: TaskStatus.DONE, title: "Done", headerClass: "border-emerald-300 bg-emerald-50/80" },
];

const MY_TASKS_STORAGE_KEY = "akatsuki:kanban:my-tasks";

interface KanbanBoardClientProps {
  projectId: string;
  currentUserId: string;
  initialBoard: KanbanBoardDTO;
  sprints: SprintSummaryDTO[];
  assignableMembers: TaskAssignableMemberOption[];
  initialFilters: {
    scope: "PROJECT" | "SPRINT" | "BACKLOG";
    sprintId?: string;
    search?: string;
    priority?: TaskPriority;
    assigneeId?: string;
    unassignedOnly?: boolean;
    overdueOnly?: boolean;
  };
}

function isAllowedDropTarget(card: KanbanCardItemDTO, targetStatus: TaskStatus): boolean {
  if (card.status === targetStatus) return false;
  if (card.status === TaskStatus.TODO && targetStatus === TaskStatus.IN_PROGRESS) {
    return card.permissions.canStartProgress;
  }
  if (card.status === TaskStatus.IN_PROGRESS && targetStatus === TaskStatus.REVIEW) {
    return card.permissions.canSubmitReview;
  }
  if (card.status === TaskStatus.REVIEW && targetStatus === TaskStatus.DONE) {
    return card.permissions.canApproveOrReject;
  }
  if (card.status === TaskStatus.REVIEW && targetStatus === TaskStatus.IN_PROGRESS) {
    return card.permissions.canApproveOrReject;
  }
  return false;
}

function getTransitionDeniedMessage(card: KanbanCardItemDTO, targetStatus: TaskStatus): string {
  if (card.status === targetStatus) {
    return "Task đã nằm trong cột này.";
  }
  if (card.status === TaskStatus.DONE) {
    return "Task đã hoàn thành (DONE) không thể kéo sang trạng thái khác.";
  }
  if (card.status === TaskStatus.TODO && targetStatus !== TaskStatus.IN_PROGRESS) {
    return "Task ở To Do phải chuyển sang In Progress trước khi gửi Review hoặc hoàn thành.";
  }
  if (card.status === TaskStatus.IN_PROGRESS && targetStatus === TaskStatus.DONE) {
    return "Task đang In Progress phải được gửi sang Review để Leader/Admin duyệt trước khi sang Done.";
  }
  return "Bạn không có quyền hoặc quy trình không hỗ trợ bước chuyển trạng thái trực tiếp này.";
}

export function KanbanBoardClient({
  projectId,
  currentUserId,
  initialBoard,
  sprints,
  assignableMembers,
  initialFilters,
}: KanbanBoardClientProps) {
  const router = useRouter();
  const [optimisticState, setOptimisticState] = React.useState<{
    base: KanbanBoardDTO;
    board: KanbanBoardDTO;
  } | null>(null);
  const board =
    optimisticState && optimisticState.base === initialBoard ? optimisticState.board : initialBoard;
  const [searchInput, setSearchInput] = React.useState(initialFilters.search ?? "");
  const [priorityFilter, setPriorityFilter] = React.useState<string>(
    initialFilters.priority ?? ALL_VALUE
  );
  const [assigneeFilter, setAssigneeFilter] = usePropSyncedState<string>(
    initialFilters.unassignedOnly ? UNASSIGNED_VALUE : (initialFilters.assigneeId ?? ALL_VALUE)
  );
  const [overdueFilter, setOverdueFilter] = React.useState<string>(
    initialFilters.overdueOnly ? "OVERDUE" : ALL_VALUE
  );

  const [draggingCard, setDraggingCard] = React.useState<KanbanCardItemDTO | null>(null);
  const [dragOverColumn, setDragOverColumn] = React.useState<TaskStatus | null>(null);
  const [busyTaskId, setBusyTaskId] = React.useState<string | null>(null);
  const [boardError, setBoardError] = React.useState<string | null>(null);
  const [reviewModal, setReviewModal] = React.useState<{
    open: boolean;
    mode: TaskReviewModalMode;
    card: KanbanCardItemDTO | null;
  }>({ open: false, mode: "submit", card: null });

  const isArchived = board.project.status === ProjectStatus.ARCHIVED;
  const isMyTasksOnly = assigneeFilter === currentUserId;

  React.useEffect(() => {
    if (initialFilters.assigneeId || initialFilters.unassignedOnly) {
      return;
    }
    try {
      if (window.localStorage.getItem(MY_TASKS_STORAGE_KEY) === "1") {
        router.replace(buildBoardUrl({ assignee: currentUserId }));
      }
    } catch {
      // Ignore storage access errors in restricted browsers
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleToggleMyTasks() {
    const nextAssignee = isMyTasksOnly ? ALL_VALUE : currentUserId;
    try {
      window.localStorage.setItem(MY_TASKS_STORAGE_KEY, isMyTasksOnly ? "0" : "1");
    } catch {
      // Ignore storage access errors
    }
    setAssigneeFilter(nextAssignee);
    router.push(buildBoardUrl({ assignee: nextAssignee }));
  }

  function buildBoardUrl(overrides: {
    scope?: "PROJECT" | "SPRINT" | "BACKLOG";
    sprintId?: string;
    search?: string;
    priority?: string;
    assignee?: string;
    overdue?: string;
  }): string {
    const params = new URLSearchParams();
    const scope = overrides.scope ?? initialFilters.scope;
    const sprintId =
      overrides.sprintId !== undefined ? overrides.sprintId : initialFilters.sprintId;
    const s = overrides.search !== undefined ? overrides.search : searchInput;
    const p = overrides.priority !== undefined ? overrides.priority : priorityFilter;
    const a = overrides.assignee !== undefined ? overrides.assignee : assigneeFilter;
    const o = overrides.overdue !== undefined ? overrides.overdue : overdueFilter;

    params.set("scope", scope);
    if (scope === "SPRINT" && sprintId) {
      params.set("sprintId", sprintId);
    }
    if (s.trim()) params.set("search", s.trim());
    if (p && p !== ALL_VALUE) params.set("priority", p);
    if (a === UNASSIGNED_VALUE) {
      params.set("unassignedOnly", "true");
    } else if (a && a !== ALL_VALUE) {
      params.set("assigneeId", a);
    }
    if (o === "OVERDUE") params.set("overdueOnly", "true");

    return `/projects/${projectId}/kanban?${params.toString()}`;
  }

  function handleScopeSwitch(scope: "PROJECT" | "SPRINT" | "BACKLOG") {
    if (scope === "SPRINT") {
      const preferred =
        initialFilters.sprintId || sprints.find((s) => s.status === "ACTIVE")?.id || sprints[0]?.id;
      if (!preferred) {
        toast.info("Project chưa có Sprint nào. Vui lòng tạo Sprint trước.");
        return;
      }
      router.push(buildBoardUrl({ scope: "SPRINT", sprintId: preferred }));
      return;
    }
    router.push(buildBoardUrl({ scope, sprintId: undefined }));
  }

  async function handleStartProgress(card: KanbanCardItemDTO) {
    if (isArchived || busyTaskId) return;
    setBoardError(null);

    const prev = board;
    const nextTodo = prev.columns.TODO.filter((item) => item.id !== card.id);
    const updatedCard: KanbanCardItemDTO = {
      ...card,
      status: TaskStatus.IN_PROGRESS,
      permissions: {
        ...card.permissions,
        canStartProgress: false,
        canSubmitReview:
          prev.capabilities.canSubmitReview &&
          (prev.capabilities.isLeaderOrAdmin ||
            card.assignees.some((a) => a.userId === prev.capabilities.currentUserId)),
      },
    };
    setOptimisticState({
      base: initialBoard,
      board: {
        ...prev,
        columns: {
          ...prev.columns,
          TODO: nextTodo,
          IN_PROGRESS: [updatedCard, ...prev.columns.IN_PROGRESS],
        },
        counts: {
          ...prev.counts,
          TODO: Math.max(0, prev.counts.TODO - 1),
          IN_PROGRESS: prev.counts.IN_PROGRESS + 1,
        },
      },
    });

    setBusyTaskId(card.id);
    const result = await updateTaskStatusAction(card.id, TaskStatus.IN_PROGRESS);
    setBusyTaskId(null);

    if (!result.ok) {
      setOptimisticState(null);
      setBoardError(result.error.message);
      toast.error(result.error.message);
      return;
    }

    toast.success(`Đã chuyển ${card.code} sang In Progress.`);
    router.refresh();
  }

  function handleDropOnColumn(targetStatus: TaskStatus, event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOverColumn(null);

    const cardId = draggingCard?.id || event.dataTransfer.getData("text/plain");
    const card =
      draggingCard ??
      [
        ...board.columns.TODO,
        ...board.columns.IN_PROGRESS,
        ...board.columns.REVIEW,
        ...board.columns.DONE,
      ].find((item) => item.id === cardId);

    setDraggingCard(null);
    if (!card || isArchived) return;

    if (card.status === targetStatus) return;

    if (!isAllowedDropTarget(card, targetStatus)) {
      const msg = getTransitionDeniedMessage(card, targetStatus);
      setBoardError(msg);
      toast.error(msg);
      return;
    }

    if (card.status === TaskStatus.TODO && targetStatus === TaskStatus.IN_PROGRESS) {
      void handleStartProgress(card);
      return;
    }

    if (card.status === TaskStatus.IN_PROGRESS && targetStatus === TaskStatus.REVIEW) {
      setReviewModal({ open: true, mode: "submit", card });
      return;
    }

    if (card.status === TaskStatus.REVIEW && targetStatus === TaskStatus.DONE) {
      setReviewModal({ open: true, mode: "approve", card });
      return;
    }

    if (card.status === TaskStatus.REVIEW && targetStatus === TaskStatus.IN_PROGRESS) {
      setReviewModal({ open: true, mode: "reject", card });
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={initialFilters.scope === "PROJECT" ? "default" : "outline"}
                onClick={() => handleScopeSwitch("PROJECT")}
              >
                Toàn bộ Project
              </Button>
              <Button
                type="button"
                size="sm"
                variant={initialFilters.scope === "SPRINT" ? "default" : "outline"}
                disabled={sprints.length === 0}
                onClick={() => handleScopeSwitch("SPRINT")}
              >
                Theo Sprint
              </Button>
              <Button
                type="button"
                size="sm"
                variant={initialFilters.scope === "BACKLOG" ? "default" : "outline"}
                onClick={() => handleScopeSwitch("BACKLOG")}
              >
                Product Backlog
              </Button>

              {initialFilters.scope === "SPRINT" && sprints.length > 0 && (
                <Select
                  value={initialFilters.sprintId ?? sprints[0].id}
                  onValueChange={(sprintId) =>
                    router.push(buildBoardUrl({ scope: "SPRINT", sprintId }))
                  }
                >
                  <SelectTrigger className="w-[240px]">
                    <SelectValue placeholder="Chọn Sprint..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sprints.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={isMyTasksOnly ? "default" : "outline"}
                onClick={handleToggleMyTasks}
                aria-pressed={isMyTasksOnly}
              >
                <UserCheck className="h-4 w-4" />
                <span>Việc của tôi</span>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={`/projects/${projectId}/backlog`}>
                  <Layers className="h-4 w-4" />
                  <span>Backlog</span>
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={`/projects/${projectId}/sprints`}>
                  <span>Sprints</span>
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                router.push(buildBoardUrl({ search: searchInput }));
              }}
              className="flex gap-2 md:col-span-2"
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Tìm kiếm Task trên Board..."
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="secondary">
                Lọc
              </Button>
            </form>

            <Select
              value={priorityFilter}
              onValueChange={(value) => {
                setPriorityFilter(value);
                router.push(buildBoardUrl({ priority: value }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Độ ưu tiên" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Mọi độ ưu tiên</SelectItem>
                <SelectItem value={TaskPriority.CRITICAL}>Critical</SelectItem>
                <SelectItem value={TaskPriority.HIGH}>High</SelectItem>
                <SelectItem value={TaskPriority.MEDIUM}>Medium</SelectItem>
                <SelectItem value={TaskPriority.LOW}>Low</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={assigneeFilter}
              onValueChange={(value) => {
                setAssigneeFilter(value);
                try {
                  window.localStorage.setItem(
                    MY_TASKS_STORAGE_KEY,
                    value === currentUserId ? "1" : "0"
                  );
                } catch {
                  // Ignore storage access errors
                }
                router.push(buildBoardUrl({ assignee: value }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Người thực hiện" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Tất cả thành viên</SelectItem>
                <SelectItem value={UNASSIGNED_VALUE}>Chưa phân công</SelectItem>
                {assignableMembers.map((member) => (
                  <SelectItem key={member.userId} value={member.userId}>
                    {member.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={overdueFilter}
              onValueChange={(value) => {
                setOverdueFilter(value);
                router.push(buildBoardUrl({ overdue: value }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Hạn chót" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Mọi hạn chót</SelectItem>
                <SelectItem value="OVERDUE">Chỉ Task quá hạn</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isArchived && (
        <Alert>
          <AlertTitle>Project đã Archive (Chế độ chỉ đọc)</AlertTitle>
          <AlertDescription>
            Bạn vẫn có thể xem trạng thái Kanban nhưng không thể kéo thả hay chuyển trạng thái Task.
          </AlertDescription>
        </Alert>
      )}

      {board.truncated && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Hiển thị giới hạn 250 Task trên Kanban Board</AlertTitle>
          <AlertDescription>
            Project có hơn 250 Task khớp bộ lọc. Vui lòng chuyển sang chế độ &ldquo;Theo
            Sprint&rdquo; hoặc thu hẹp bộ lọc để xem chính xác hơn.
          </AlertDescription>
        </Alert>
      )}

      {boardError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Không thể chuyển trạng thái Task</AlertTitle>
          <AlertDescription>{boardError}</AlertDescription>
        </Alert>
      )}

      {/* 4 Fixed Columns Kanban Board */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {KANBAN_COLUMNS.map((col) => {
          const cards = board.columns[col.status];
          const isValidTarget =
            draggingCard !== null && isAllowedDropTarget(draggingCard, col.status);
          const isHovering = dragOverColumn === col.status;

          return (
            <div
              key={col.status}
              onDragOver={(event) => {
                event.preventDefault();
                if (dragOverColumn !== col.status) {
                  setDragOverColumn(col.status);
                }
              }}
              onDragLeave={() => {
                if (dragOverColumn === col.status) {
                  setDragOverColumn(null);
                }
              }}
              onDrop={(event) => handleDropOnColumn(col.status, event)}
              className={cn(
                "flex min-h-[420px] flex-col rounded-xl border border-border bg-muted/20 p-3 transition",
                isHovering && isValidTarget
                  ? "border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-300"
                  : "",
                isHovering && draggingCard && !isValidTarget && draggingCard.status !== col.status
                  ? "border-red-300 bg-red-50/30"
                  : ""
              )}
            >
              <div
                className={cn(
                  "mb-3 flex items-center justify-between rounded-lg border px-3 py-2",
                  col.headerClass
                )}
              >
                <span className="text-sm font-semibold text-slate-900">{col.title}</span>
                <Badge variant="secondary" className="font-mono text-xs">
                  {cards.length}
                </Badge>
              </div>

              <div className="flex flex-1 flex-col gap-2.5">
                {cards.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
                    Không có Task
                  </div>
                ) : (
                  cards.map((card) => (
                    <KanbanTaskCard
                      key={card.id}
                      projectId={projectId}
                      card={card}
                      isArchived={isArchived}
                      isBusy={busyTaskId === card.id}
                      isDragging={draggingCard?.id === card.id}
                      onDragStartCard={(c, event) => {
                        setBoardError(null);
                        setDraggingCard(c);
                        event.dataTransfer.setData("text/plain", c.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEndCard={() => {
                        setDraggingCard(null);
                        setDragOverColumn(null);
                      }}
                      onStartProgress={(c) => void handleStartProgress(c)}
                      onOpenReviewModal={(c, mode) => setReviewModal({ open: true, mode, card: c })}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {reviewModal.card && (
        <TaskReviewModal
          open={reviewModal.open}
          onOpenChange={(open) => {
            if (!open) setReviewModal((prev) => ({ ...prev, open: false, card: null }));
          }}
          mode={reviewModal.mode}
          projectId={projectId}
          taskId={reviewModal.card.id}
          taskCode={reviewModal.card.code}
          taskTitle={reviewModal.card.title}
        />
      )}
    </div>
  );
}
