import Link from "next/link";
import { ArrowRight, CheckSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectTaskSummaryStatsDTO } from "@/modules/tasks/task.repository";

interface ProjectTaskSummaryCardProps {
  projectId: string;
  stats: ProjectTaskSummaryStatsDTO;
  canCreateTask: boolean;
}

export function ProjectTaskSummaryCard({
  projectId,
  stats,
  canCreateTask,
}: ProjectTaskSummaryCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-slate-700" />
            <CardTitle className="text-base">Tổng quan công việc (Tasks)</CardTitle>
          </div>
          <CardDescription>
            Theo dõi tiến độ thực hiện, phân công, phụ thuộc và quy trình review của Project.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreateTask && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/projects/${projectId}/tasks/new`}>
                <Plus className="h-4 w-4" />
                <span>Tạo Task mới</span>
              </Link>
            </Button>
          )}
          <Button asChild size="sm">
            <Link href={`/projects/${projectId}/tasks`}>
              <span>Quản lý Tasks</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Tổng Task</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{stats.totalTasks}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">To Do</p>
            <p className="mt-1 text-xl font-bold text-slate-700">{stats.todoCount}</p>
          </div>
          <div className="rounded-lg border border-border bg-sky-50/70 p-3">
            <p className="text-xs text-sky-700">In Progress</p>
            <p className="mt-1 text-xl font-bold text-sky-900">{stats.inProgressCount}</p>
          </div>
          <div className="rounded-lg border border-border bg-amber-50/70 p-3">
            <p className="text-xs text-amber-700">Review</p>
            <p className="mt-1 text-xl font-bold text-amber-900">{stats.reviewCount}</p>
          </div>
          <div className="rounded-lg border border-border bg-emerald-50/70 p-3">
            <p className="text-xs text-emerald-700">Done</p>
            <p className="mt-1 text-xl font-bold text-emerald-900">{stats.doneCount}</p>
          </div>
          <div className="rounded-lg border border-border bg-red-50/70 p-3">
            <p className="text-xs text-red-700">Quá hạn</p>
            <p className="mt-1 text-xl font-bold text-red-900">{stats.overdueCount}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
