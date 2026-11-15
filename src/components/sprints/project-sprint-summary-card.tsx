import Link from "next/link";
import { SprintStatus } from "@prisma/client";
import { ArrowRight, Calendar, Kanban, Layers, Plus } from "lucide-react";
import { SprintStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SprintSummaryDTO } from "@/modules/sprints/sprint.repository";
import { formatSprintDateYmd } from "@/modules/sprints/sprint.schema";

function formatShortRange(startDate: Date, endDate: Date): string {
  const formatOne = (d: Date) => {
    const [y, m, day] = formatSprintDateYmd(d).split("-");
    return `${day}/${m}/${y}`;
  };
  return `${formatOne(startDate)} – ${formatOne(endDate)}`;
}

interface ProjectSprintSummaryCardProps {
  projectId: string;
  sprints: SprintSummaryDTO[];
  backlogTotalCount: number;
  canManageSprint: boolean;
  isArchived: boolean;
}

export function ProjectSprintSummaryCard({
  projectId,
  sprints,
  backlogTotalCount,
  canManageSprint,
  isArchived,
}: ProjectSprintSummaryCardProps) {
  const activeSprints = sprints.filter((s) => s.status === SprintStatus.ACTIVE);
  const plannedSprints = sprints.filter((s) => s.status === SprintStatus.PLANNED);
  const highlightedSprints = [...activeSprints, ...plannedSprints].slice(0, 3);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-slate-700" />
            <CardTitle className="text-base">Sprint, Product Backlog &amp; Kanban Board</CardTitle>
          </div>
          <CardDescription>
            Điều phối chu kỳ làm việc, lập kế hoạch từ Product Backlog và theo dõi Kanban 4 cột.
          </CardDescription>
        </div>

        <div className="flex flex-wrap gap-2">
          {canManageSprint && !isArchived && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/projects/${projectId}/sprints/new`}>
                <Plus className="h-4 w-4" />
                <span>Tạo Sprint</span>
              </Link>
            </Button>
          )}
          <Button asChild size="sm" variant="outline">
            <Link href={`/projects/${projectId}/backlog`}>
              <span>Backlog ({backlogTotalCount})</span>
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/projects/${projectId}/kanban`}>
              <Kanban className="h-4 w-4" />
              <span>Kanban Board</span>
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/projects/${projectId}/sprints`}>
              <span>Quản lý Sprints ({sprints.length})</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {highlightedSprints.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Chưa có Sprint nào đang chạy hoặc đang lên kế hoạch trong Project này.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {highlightedSprints.map((sprint) => (
              <Link
                key={sprint.id}
                href={`/projects/${projectId}/sprints/${sprint.id}`}
                className="block space-y-2 rounded-lg border border-border bg-muted/20 p-3 transition hover:border-slate-400"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="line-clamp-1 font-medium text-slate-900">{sprint.name}</span>
                  <SprintStatusBadge status={sprint.status} />
                </div>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{formatShortRange(sprint.startDate, sprint.endDate)}</span>
                </p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-700">
                    <span>Tiến độ Task</span>
                    <span className="font-mono font-medium">
                      {sprint.taskStats.progressPercent}% ({sprint.taskStats.doneCount}/
                      {sprint.taskStats.totalTasks})
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-emerald-600"
                      style={{ width: `${sprint.taskStats.progressPercent}%` }}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
