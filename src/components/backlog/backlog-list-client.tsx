"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProjectStatus, TaskPriority, TaskStatus } from "@prisma/client";
import { CalendarClock, Kanban, Layers, Plus, Search, SendToBack } from "lucide-react";
import { AddToSprintDialog } from "@/components/backlog/add-to-sprint-dialog";
import { TaskPriorityBadge, TaskStatusBadge } from "@/components/shared/status-badge";
import type { TaskAssignableMemberOption } from "@/components/tasks/task-list-client";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SprintTargetOptionDTO } from "@/modules/sprints/sprint.repository";
import type { TaskSummaryDTO } from "@/modules/tasks/task.repository";

const ALL_VALUE = "ALL";
const UNASSIGNED_VALUE = "UNASSIGNED";

function formatDateVi(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

interface BacklogListClientProps {
  projectId: string;
  projectStatus: ProjectStatus;
  tasks: TaskSummaryDTO[];
  totalItems: number;
  page: number;
  totalPages: number;
  assignableMembers: TaskAssignableMemberOption[];
  targetSprints: SprintTargetOptionDTO[];
  canCreateTask: boolean;
  canManageSprint: boolean;
  initialFilters: {
    search?: string;
    priority?: TaskPriority;
    assigneeId?: string;
    unassignedOnly?: boolean;
    overdueOnly?: boolean;
    deadlineFrom?: string;
    deadlineTo?: string;
    sortBy: string;
    sortOrder: string;
  };
}

export function BacklogListClient({
  projectId,
  projectStatus,
  tasks,
  totalItems,
  page,
  totalPages,
  assignableMembers,
  targetSprints,
  canCreateTask,
  canManageSprint,
  initialFilters,
}: BacklogListClientProps) {
  const router = useRouter();
  const [searchInput, setSearchInput] = React.useState(initialFilters.search ?? "");
  const [priorityFilter, setPriorityFilter] = React.useState<string>(
    initialFilters.priority ?? ALL_VALUE
  );
  const [assigneeFilter, setAssigneeFilter] = React.useState<string>(
    initialFilters.unassignedOnly ? UNASSIGNED_VALUE : (initialFilters.assigneeId ?? ALL_VALUE)
  );
  const [overdueFilter, setOverdueFilter] = React.useState<string>(
    initialFilters.overdueOnly ? "OVERDUE" : ALL_VALUE
  );
  const [deadlineFrom, setDeadlineFrom] = React.useState(initialFilters.deadlineFrom ?? "");
  const [deadlineTo, setDeadlineTo] = React.useState(initialFilters.deadlineTo ?? "");
  const [sortOption, setSortOption] = React.useState(
    `${initialFilters.sortBy}:${initialFilters.sortOrder}`
  );
  const [selectedTaskIds, setSelectedTaskIds] = React.useState<string[]>([]);
  const [dialogTasks, setDialogTasks] = React.useState<TaskSummaryDTO[] | null>(null);

  const isArchived = projectStatus === ProjectStatus.ARCHIVED;
  const canPlanTasks = canManageSprint && !isArchived;

  const eligiblePageTasks = tasks.filter((task) => task.status !== TaskStatus.DONE);
  const selectedTasks = eligiblePageTasks.filter((task) => selectedTaskIds.includes(task.id));
  const allEligibleSelected =
    eligiblePageTasks.length > 0 && selectedTasks.length === eligiblePageTasks.length;

  function buildQueryUrl(
    targetPage: number,
    overrides?: {
      search?: string;
      priority?: string;
      assignee?: string;
      overdue?: string;
      deadlineFrom?: string;
      deadlineTo?: string;
      sort?: string;
    }
  ): string {
    const params = new URLSearchParams();
    const s = overrides?.search !== undefined ? overrides.search : searchInput;
    const p = overrides?.priority !== undefined ? overrides.priority : priorityFilter;
    const a = overrides?.assignee !== undefined ? overrides.assignee : assigneeFilter;
    const o = overrides?.overdue !== undefined ? overrides.overdue : overdueFilter;
    const df = overrides?.deadlineFrom !== undefined ? overrides.deadlineFrom : deadlineFrom;
    const dt = overrides?.deadlineTo !== undefined ? overrides.deadlineTo : deadlineTo;
    const sortVal = overrides?.sort !== undefined ? overrides.sort : sortOption;
    const [sortBy, sortOrder] = sortVal.split(":");

    if (s.trim()) params.set("search", s.trim());
    if (p && p !== ALL_VALUE) params.set("priority", p);
    if (a === UNASSIGNED_VALUE) {
      params.set("unassignedOnly", "true");
    } else if (a && a !== ALL_VALUE) {
      params.set("assigneeId", a);
    }
    if (o === "OVERDUE") params.set("overdueOnly", "true");
    if (df) params.set("deadlineFrom", df);
    if (dt) params.set("deadlineTo", dt);
    if (sortBy) params.set("sortBy", sortBy);
    if (sortOrder) params.set("sortOrder", sortOrder);
    if (targetPage > 1) params.set("page", String(targetPage));

    const qs = params.toString();
    return qs ? `/projects/${projectId}/backlog?${qs}` : `/projects/${projectId}/backlog`;
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(buildQueryUrl(1, { search: searchInput }));
  }

  function toggleTask(taskId: string) {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  }

  function toggleSelectAllEligible() {
    if (allEligibleSelected) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(eligiblePageTasks.map((t) => t.id));
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <form onSubmit={handleSearchSubmit} className="flex flex-1 gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Tìm kiếm Task trong Backlog theo tiêu đề hoặc mô tả..."
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="secondary">
                Tìm kiếm
              </Button>
            </form>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/projects/${projectId}/sprints`}>
                  <Layers className="h-4 w-4" />
                  <span>Danh sách Sprints</span>
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/projects/${projectId}/kanban?scope=BACKLOG`}>
                  <Kanban className="h-4 w-4" />
                  <span>Kanban Backlog</span>
                </Link>
              </Button>
              {canCreateTask && !isArchived && (
                <Button asChild size="sm">
                  <Link href={`/projects/${projectId}/tasks/new`}>
                    <Plus className="h-4 w-4" />
                    <span>Tạo Task vào Backlog</span>
                  </Link>
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <Select
              value={priorityFilter}
              onValueChange={(value) => {
                setPriorityFilter(value);
                router.push(buildQueryUrl(1, { priority: value }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Độ ưu tiên" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Tất cả độ ưu tiên</SelectItem>
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
                router.push(buildQueryUrl(1, { assignee: value }));
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
                router.push(buildQueryUrl(1, { overdue: value }));
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

            <div className="flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                type="date"
                aria-label="Deadline từ ngày"
                value={deadlineFrom}
                onChange={(e) => {
                  const val = e.target.value;
                  setDeadlineFrom(val);
                  router.push(buildQueryUrl(1, { deadlineFrom: val }));
                }}
              />
            </div>

            <div>
              <Input
                type="date"
                aria-label="Deadline đến ngày"
                value={deadlineTo}
                onChange={(e) => {
                  const val = e.target.value;
                  setDeadlineTo(val);
                  router.push(buildQueryUrl(1, { deadlineTo: val }));
                }}
              />
            </div>

            <Select
              value={sortOption}
              onValueChange={(value) => {
                setSortOption(value);
                router.push(buildQueryUrl(1, { sort: value }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sắp xếp" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deadline:asc">Deadline gần nhất</SelectItem>
                <SelectItem value="deadline:desc">Deadline xa nhất</SelectItem>
                <SelectItem value="priority:desc">Ưu tiên (Z → A)</SelectItem>
                <SelectItem value="updatedAt:desc">Mới cập nhật</SelectItem>
                <SelectItem value="createdAt:desc">Mới tạo nhất</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {canPlanTasks && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <div className="text-sm text-slate-700">
            Đã chọn <strong>{selectedTasks.length}</strong> Task để đưa vào Sprint Planning.
          </div>
          <Button
            type="button"
            size="sm"
            disabled={selectedTasks.length === 0}
            onClick={() => setDialogTasks(selectedTasks)}
          >
            <SendToBack className="h-4 w-4" />
            <span>Đưa {selectedTasks.length} Task vào Sprint...</span>
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {tasks.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Không tìm thấy Task nào trong Product Backlog khớp với bộ lọc hiện tại.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {canPlanTasks && (
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          aria-label="Chọn tất cả Task hợp lệ trên trang"
                          checked={allEligibleSelected}
                          onChange={toggleSelectAllEligible}
                          disabled={eligiblePageTasks.length === 0}
                          className="h-4 w-4 rounded border-slate-300 accent-primary"
                        />
                      </TableHead>
                    )}
                    <TableHead>Công việc</TableHead>
                    <TableHead>Ưu tiên</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Người thực hiện</TableHead>
                    {canPlanTasks && <TableHead className="text-right">Thao tác</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => {
                    const isDone = task.status === TaskStatus.DONE;
                    const checked = selectedTaskIds.includes(task.id);
                    return (
                      <TableRow key={task.id}>
                        {canPlanTasks && (
                          <TableCell>
                            <input
                              type="checkbox"
                              aria-label={`Chọn ${task.code}`}
                              checked={checked}
                              disabled={isDone}
                              title={isDone ? "Task đã DONE không thể đưa vào Sprint" : undefined}
                              onChange={() => toggleTask(task.id)}
                              className="h-4 w-4 rounded border-slate-300 accent-primary"
                            />
                          </TableCell>
                        )}
                        <TableCell className="min-w-[260px]">
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">
                                {task.code}
                              </span>
                              <Link
                                href={`/projects/${projectId}/tasks/${task.id}`}
                                className="font-medium text-slate-900 hover:text-primary hover:underline"
                              >
                                {task.title}
                              </Link>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              {task.status === TaskStatus.REVIEW && (
                                <Badge
                                  variant="outline"
                                  className="border-amber-300 bg-amber-50 text-amber-800"
                                >
                                  Đang chờ Review
                                </Badge>
                              )}
                              {task.estimateHours !== null && (
                                <span>Ước lượng: {task.estimateHours} giờ</span>
                              )}
                            </div>
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
                        {canPlanTasks && (
                          <TableCell className="text-right">
                            {isDone ? (
                              <span className="text-xs text-muted-foreground">Đã DONE</span>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setDialogTasks([task])}
                              >
                                Đưa vào Sprint
                              </Button>
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

      <div className="flex flex-col items-center justify-between gap-2 text-sm text-muted-foreground sm:flex-row">
        <span>
          Trang {page} / {totalPages} · Tổng {totalItems} Task trong Product Backlog
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => router.push(buildQueryUrl(page - 1))}
          >
            Trang trước
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => router.push(buildQueryUrl(page + 1))}
          >
            Trang sau
          </Button>
        </div>
      </div>

      <AddToSprintDialog
        open={dialogTasks !== null}
        onOpenChange={(open) => {
          if (!open) setDialogTasks(null);
        }}
        projectId={projectId}
        selectedTasks={dialogTasks ?? []}
        targetSprints={targetSprints}
        onAssigned={() => setSelectedTaskIds([])}
      />
    </div>
  );
}
