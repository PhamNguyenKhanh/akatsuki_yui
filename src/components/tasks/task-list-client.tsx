"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProjectStatus, TaskPriority, TaskStatus } from "@prisma/client";
import { AlertTriangle, Plus, RotateCcw, Search } from "lucide-react";
import { TaskPriorityBadge, TaskStatusBadge } from "@/components/shared/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { TaskSummaryDTO } from "@/modules/tasks/task.repository";

const ALL_VALUE = "__ALL__";
const UNASSIGNED_VALUE = "__UNASSIGNED__";

function formatDateVi(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export interface TaskAssignableMemberOption {
  userId: string;
  fullName: string;
  email: string;
}

interface TaskListClientProps {
  projectId: string;
  projectName: string;
  projectStatus: ProjectStatus;
  tasks: TaskSummaryDTO[];
  totalItems: number;
  page: number;
  totalPages: number;
  canCreateTask: boolean;
  assignableMembers: TaskAssignableMemberOption[];
  initialFilters: {
    search?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    assigneeId?: string;
    unassignedOnly?: boolean;
    overdueOnly?: boolean;
    sortBy: string;
    sortOrder: "asc" | "desc";
  };
}

export function TaskListClient({
  projectId,
  projectName,
  projectStatus,
  tasks,
  totalItems,
  page,
  totalPages,
  canCreateTask,
  assignableMembers,
  initialFilters,
}: TaskListClientProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState(initialFilters.search ?? "");
  const [statusFilter, setStatusFilter] = React.useState<string>(
    initialFilters.status ?? ALL_VALUE
  );
  const [priorityFilter, setPriorityFilter] = React.useState<string>(
    initialFilters.priority ?? ALL_VALUE
  );
  const [assigneeFilter, setAssigneeFilter] = React.useState<string>(
    initialFilters.unassignedOnly ? UNASSIGNED_VALUE : (initialFilters.assigneeId ?? ALL_VALUE)
  );
  const [overdueFilter, setOverdueFilter] = React.useState<string>(
    initialFilters.overdueOnly ? "OVERDUE" : ALL_VALUE
  );
  const [sortOption, setSortOption] = React.useState<string>(
    `${initialFilters.sortBy}:${initialFilters.sortOrder}`
  );

  const isArchived = projectStatus === ProjectStatus.ARCHIVED;

  function buildQueryUrl(
    nextPage: number,
    overrides?: Partial<{
      search: string;
      status: string;
      priority: string;
      assignee: string;
      overdue: string;
      sort: string;
    }>
  ) {
    const params = new URLSearchParams();
    const s = (overrides?.search ?? search).trim();
    const st = overrides?.status ?? statusFilter;
    const pr = overrides?.priority ?? priorityFilter;
    const as = overrides?.assignee ?? assigneeFilter;
    const ov = overrides?.overdue ?? overdueFilter;
    const sr = overrides?.sort ?? sortOption;

    if (s) params.set("search", s);
    if (st !== ALL_VALUE) params.set("status", st);
    if (pr !== ALL_VALUE) params.set("priority", pr);
    if (as === UNASSIGNED_VALUE) {
      params.set("unassignedOnly", "true");
    } else if (as !== ALL_VALUE) {
      params.set("assigneeId", as);
    }
    if (ov === "OVERDUE") {
      params.set("overdueOnly", "true");
    }

    const [sortBy, sortOrder] = sr.split(":");
    if (sortBy && (sortBy !== "deadline" || sortOrder !== "asc")) {
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder ?? "asc");
    }
    if (nextPage > 1) {
      params.set("page", String(nextPage));
    }

    const qs = params.toString();
    return qs ? `/projects/${projectId}/tasks?${qs}` : `/projects/${projectId}/tasks`;
  }

  function applySearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(buildQueryUrl(1));
  }

  function handleReset() {
    setSearch("");
    setStatusFilter(ALL_VALUE);
    setPriorityFilter(ALL_VALUE);
    setAssigneeFilter(ALL_VALUE);
    setOverdueFilter(ALL_VALUE);
    setSortOption("deadline:asc");
    router.push(`/projects/${projectId}/tasks`);
  }

  return (
    <div className="space-y-4">
      {isArchived && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Project đang ở trạng thái ARCHIVED</AlertTitle>
          <AlertDescription>
            Bạn chỉ có thể xem danh sách và lịch sử Task. Các thao tác tạo mới, chỉnh sửa, phân công
            và review đều đang được khóa.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Bộ lọc công việc · {projectName}</CardTitle>
            <CardDescription>
              Tìm kiếm theo tiêu đề/mô tả và lọc theo trạng thái, độ ưu tiên, người được giao hoặc
              trễ hạn.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/projects/${projectId}/backlog`}>Product Backlog</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/projects/${projectId}/sprints`}>Sprints</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/projects/${projectId}/kanban`}>Kanban</Link>
            </Button>
            {canCreateTask && !isArchived && (
              <Button asChild size="sm">
                <Link href={`/projects/${projectId}/tasks/new`}>
                  <Plus className="h-4 w-4" />
                  <span>Tạo Task mới</span>
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={applySearchSubmit} className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tiêu đề hoặc mô tả Task..."
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                Tìm kiếm
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
                <span>Đặt lại</span>
              </Button>
            </div>
          </form>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                router.push(buildQueryUrl(1, { status: value }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Tất cả trạng thái</SelectItem>
                <SelectItem value={TaskStatus.TODO}>To Do</SelectItem>
                <SelectItem value={TaskStatus.IN_PROGRESS}>In Progress</SelectItem>
                <SelectItem value={TaskStatus.REVIEW}>Review</SelectItem>
                <SelectItem value={TaskStatus.DONE}>Done</SelectItem>
              </SelectContent>
            </Select>

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

      <Card>
        <CardContent className="p-0">
          {tasks.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Không tìm thấy công việc nào khớp với bộ lọc hiện tại.
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
                    <TableHead>Phụ thuộc</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.id}>
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
                            {task.sprint ? (
                              <Link
                                href={`/projects/${projectId}/sprints/${task.sprint.id}`}
                                className="inline-flex items-center rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 font-medium text-indigo-800 hover:underline"
                              >
                                Sprint: {task.sprint.name}
                              </Link>
                            ) : (
                              <Link
                                href={`/projects/${projectId}/backlog`}
                                className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-medium text-slate-700 hover:underline"
                              >
                                Product Backlog
                              </Link>
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
                      <TableCell className="min-w-[180px]">
                        {task.assignees.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Chưa phân công</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {task.assignees.map((assignee) => (
                              <Badge key={assignee.id} variant="secondary" className="font-normal">
                                {assignee.user.fullName}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {task.dependencyCount === 0 ? (
                          <span className="text-muted-foreground">Không</span>
                        ) : task.blockedByCount > 0 ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {task.blockedByTasks && task.blockedByTasks.length > 0 ? (
                              <>
                                {task.blockedByTasks.slice(0, 2).map((blocker) => (
                                  <Link
                                    key={blocker.id}
                                    href={`/projects/${projectId}/tasks/${blocker.id}`}
                                    title={blocker.title}
                                  >
                                    <Badge
                                      variant="outline"
                                      className="border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                    >
                                      Đang chờ {blocker.code}
                                    </Badge>
                                  </Link>
                                ))}
                                {task.blockedByTasks.length > 2 && (
                                  <Badge
                                    variant="outline"
                                    className="border-amber-300 bg-amber-50 text-amber-800"
                                    title={task.blockedByTasks
                                      .slice(2)
                                      .map((b) => `[${b.code}] ${b.title}`)
                                      .join("\n")}
                                  >
                                    +{task.blockedByTasks.length - 2}
                                  </Badge>
                                )}
                              </>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-amber-300 bg-amber-50 text-amber-800"
                              >
                                Đang chờ {task.blockedByCount} Task
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-emerald-300 bg-emerald-50 text-emerald-800"
                          >
                            {task.dependencyCount} đã DONE
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col items-center justify-between gap-2 text-sm text-muted-foreground sm:flex-row">
        <span>
          Trang {page} / {totalPages} · Tổng {totalItems} công việc
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
    </div>
  );
}
