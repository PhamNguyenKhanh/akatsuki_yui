"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProjectStatus, SprintStatus } from "@prisma/client";
import {
  ArrowRight,
  Calendar,
  Kanban,
  Layers,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { SprintStatusBadge } from "@/components/shared/status-badge";
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
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteSprintAction, reopenSprintAction } from "@/modules/sprints/sprint.actions";
import type { SprintSummaryDTO } from "@/modules/sprints/sprint.repository";
import { formatSprintDateYmd } from "@/modules/sprints/sprint.schema";

const ALL_STATUS = "ALL";

function formatDateVi(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const ymd = formatSprintDateYmd(date);
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

interface SprintListClientProps {
  projectId: string;
  projectStatus: ProjectStatus;
  sprints: SprintSummaryDTO[];
  canManageSprint: boolean;
  initialFilters: {
    search?: string;
    status?: SprintStatus;
  };
}

export function SprintListClient({
  projectId,
  projectStatus,
  sprints,
  canManageSprint,
  initialFilters,
}: SprintListClientProps) {
  const router = useRouter();
  const [searchInput, setSearchInput] = React.useState(initialFilters.search ?? "");
  const [statusFilter, setStatusFilter] = React.useState<string>(
    initialFilters.status ?? ALL_STATUS
  );
  const [busySprintId, setBusySprintId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<SprintSummaryDTO | null>(null);

  const isArchived = projectStatus === ProjectStatus.ARCHIVED;

  function pushFilters(next: { search?: string; status?: string }) {
    const params = new URLSearchParams();
    const s = next.search !== undefined ? next.search : searchInput;
    const st = next.status !== undefined ? next.status : statusFilter;

    if (s.trim()) params.set("search", s.trim());
    if (st && st !== ALL_STATUS) params.set("status", st);

    const qs = params.toString();
    router.push(qs ? `/projects/${projectId}/sprints?${qs}` : `/projects/${projectId}/sprints`);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    pushFilters({ search: searchInput });
  }

  async function handleReopenSprint(sprint: SprintSummaryDTO) {
    setBusySprintId(sprint.id);
    const result = await reopenSprintAction(sprint.id);
    setBusySprintId(null);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(`Đã khởi chạy lại Sprint "${sprint.name}" về trạng thái PLANNED.`);
    router.refresh();
  }

  async function handleConfirmDeleteSprint() {
    if (!deleteTarget) return;
    setBusySprintId(deleteTarget.id);
    const result = await deleteSprintAction(deleteTarget.id);
    setBusySprintId(null);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(
      result.data.returnedTaskCount > 0
        ? `Đã xóa Sprint "${result.data.name}" và trả ${result.data.returnedTaskCount} Task về Backlog.`
        : `Đã xóa Sprint "${result.data.name}".`
    );
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <form onSubmit={handleSearchSubmit} className="flex flex-1 flex-wrap gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Tìm kiếm theo tên hoặc mục tiêu Sprint..."
                  className="pl-9"
                />
              </div>

              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  pushFilters({ status: value });
                }}
              >
                <SelectTrigger className="w-[210px]">
                  <SelectValue placeholder="Trạng thái Sprint" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_STATUS}>Tất cả trạng thái</SelectItem>
                  <SelectItem value={SprintStatus.ACTIVE}>Đang chạy (Active)</SelectItem>
                  <SelectItem value={SprintStatus.PLANNED}>Lên kế hoạch (Planned)</SelectItem>
                  <SelectItem value={SprintStatus.COMPLETED}>Đã hoàn thành</SelectItem>
                  <SelectItem value={SprintStatus.CANCELLED}>Đã hủy</SelectItem>
                </SelectContent>
              </Select>

              <Button type="submit" variant="secondary">
                Lọc
              </Button>
            </form>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/projects/${projectId}/backlog`}>
                  <Layers className="h-4 w-4" />
                  <span>Product Backlog</span>
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/projects/${projectId}/kanban`}>
                  <Kanban className="h-4 w-4" />
                  <span>Kanban Board</span>
                </Link>
              </Button>
              {canManageSprint && !isArchived && (
                <Button asChild size="sm">
                  <Link href={`/projects/${projectId}/sprints/new`}>
                    <Plus className="h-4 w-4" />
                    <span>Tạo Sprint mới</span>
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {sprints.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Chưa có Sprint nào phù hợp với bộ lọc hiện tại.
            </p>
            {canManageSprint && !isArchived && (
              <Button asChild size="sm" className="mt-4">
                <Link href={`/projects/${projectId}/sprints/new`}>
                  <Plus className="h-4 w-4" />
                  <span>Khởi tạo Sprint đầu tiên</span>
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sprints.map((sprint) => {
            const canEdit =
              canManageSprint &&
              !isArchived &&
              (sprint.status === SprintStatus.PLANNED || sprint.status === SprintStatus.ACTIVE);

            return (
              <Card key={sprint.id} className="flex flex-col justify-between">
                <CardHeader className="space-y-2 pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <Link
                        href={`/projects/${projectId}/sprints/${sprint.id}`}
                        className="text-lg font-semibold text-slate-900 hover:text-primary hover:underline"
                      >
                        {sprint.name}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDateVi(sprint.startDate)} – {formatDateVi(sprint.endDate)}
                        </span>
                      </div>
                    </div>
                    <SprintStatusBadge status={sprint.status} />
                  </div>
                  {sprint.goal && (
                    <CardDescription className="line-clamp-2">{sprint.goal}</CardDescription>
                  )}
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-700">
                      <span>Tiến độ (DONE / Tổng Task)</span>
                      <span className="font-mono font-semibold">
                        {sprint.taskStats.progressPercent}% ({sprint.taskStats.doneCount}/
                        {sprint.taskStats.totalTasks})
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-emerald-600"
                        style={{ width: `${sprint.taskStats.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-xs">
                    <Badge variant="outline">To Do: {sprint.taskStats.todoCount}</Badge>
                    <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-800">
                      In Progress: {sprint.taskStats.inProgressCount}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-amber-200 bg-amber-50 text-amber-800"
                    >
                      Review: {sprint.taskStats.reviewCount}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-emerald-200 bg-emerald-50 text-emerald-800"
                    >
                      Done: {sprint.taskStats.doneCount}
                    </Badge>
                    {sprint.taskStats.overdueCount > 0 && (
                      <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                        Quá hạn: {sprint.taskStats.overdueCount}
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={`/projects/${projectId}/kanban?scope=SPRINT&sprintId=${sprint.id}`}
                        >
                          <Kanban className="h-4 w-4" />
                          <span>Kanban</span>
                        </Link>
                      </Button>
                      {canEdit && (
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/projects/${projectId}/sprints/${sprint.id}/edit`}>
                            Chỉnh sửa
                          </Link>
                        </Button>
                      )}
                      {canManageSprint && !isArchived && sprint.status === SprintStatus.CANCELLED && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busySprintId === sprint.id}
                          onClick={() => void handleReopenSprint(sprint)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Khởi chạy lại</span>
                        </Button>
                      )}
                      {canManageSprint &&
                        !isArchived &&
                        (sprint.status === SprintStatus.PLANNED ||
                          sprint.status === SprintStatus.CANCELLED) && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={busySprintId === sprint.id}
                            onClick={() => setDeleteTarget(sprint)}
                            title="Xóa Sprint"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Xóa</span>
                          </Button>
                        )}
                    </div>
                    <Button asChild size="sm">
                      <Link href={`/projects/${projectId}/sprints/${sprint.id}`}>
                        <span>Chi tiết</span>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Xóa vĩnh viễn Sprint &ldquo;{deleteTarget?.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sprint sẽ bị xóa vĩnh viễn khỏi Project.{" "}
              {deleteTarget && deleteTarget.taskStats.totalTasks > 0
                ? `${deleteTarget.taskStats.totalTasks} Task hiện đang gắn với Sprint này sẽ được trả về Product Backlog.`
                : "Hiện không có Task nào đang gắn với Sprint này."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busySprintId !== null}>Đóng</AlertDialogCancel>
            <AlertDialogAction
              disabled={busySprintId !== null}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDeleteSprint();
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {busySprintId !== null ? "Đang xóa..." : "Xác nhận xóa Sprint"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
