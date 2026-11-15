"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProjectStatus, SprintStatus, TaskPriority, TaskStatus } from "@prisma/client";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  Clock,
  Eye,
  Info,
  Layers,
  Loader2,
  ShieldAlert,
  UserCheck,
  Users,
} from "lucide-react";
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
import { ProjectStatusBadge, SprintStatusBadge } from "@/components/shared/status-badge";
import { SprintBurndownChart } from "@/components/sprints/sprint-burndown-chart";
import {
  HorizontalBreakdownBars,
  SvgDonutChart,
  SvgDualLineTrendChart,
  SvgStackedBarChart,
} from "@/components/reports/svg-charts";
import { formatHcmDateVi } from "@/lib/timezone";
import type { MemberContributionReportDTO } from "@/modules/reports/member-contribution.service";
import type { ProjectAnalyticsDTO } from "@/modules/reports/project-analytics.service";
import type { AnalyticsPreset } from "@/modules/reports/report.schema";
import type { ProjectSprintReportDTO } from "@/modules/reports/sprint-report.service";
import type { SprintAnalyticsDTO } from "@/modules/sprints/sprint-analytics.service";

export interface ReportProjectOption {
  id: string;
  name: string;
  status: ProjectStatus;
}

interface ProjectReportsClientProps {
  accessibleProjects: ReportProjectOption[];
  initialAnalytics: ProjectAnalyticsDTO;
  initialMemberContribution: MemberContributionReportDTO;
  initialSprintReport: ProjectSprintReportDTO;
  initialBurndown: SprintAnalyticsDTO | null;
  switcherMode: "project-route" | "global-reports";
  canReadSprints?: boolean;
}

type ReportTab = "overview" | "sprints" | "members" | "workload";

const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To Do",
  IN_PROGRESS: "Đang thực hiện",
  REVIEW: "Chờ Review",
  DONE: "Hoàn thành",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  TODO: "#94a3b8",
  IN_PROGRESS: "#0284c7",
  REVIEW: "#d97706",
  DONE: "#059669",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  CRITICAL: "Khẩn cấp (Critical)",
  HIGH: "Cao (High)",
  MEDIUM: "Trung bình (Medium)",
  LOW: "Thấp (Low)",
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#ea580c",
  MEDIUM: "#2563eb",
  LOW: "#64748b",
};

const PRESET_LABELS: Array<{ value: AnalyticsPreset; label: string }> = [
  { value: "7d", label: "7 ngày" },
  { value: "30d", label: "30 ngày" },
  { value: "90d", label: "90 ngày" },
  { value: "all", label: "Toàn bộ" },
  { value: "custom", label: "Tùy chọn" },
];

export function ProjectReportsClient({
  accessibleProjects,
  initialAnalytics,
  initialMemberContribution,
  initialSprintReport,
  initialBurndown,
  switcherMode,
  canReadSprints = true,
}: ProjectReportsClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<ReportTab>("overview");
  const [analytics, setAnalytics] = React.useState<ProjectAnalyticsDTO>(initialAnalytics);
  const [memberContribution, setMemberContribution] =
    React.useState<MemberContributionReportDTO>(initialMemberContribution);
  const [sprintReport] = React.useState<ProjectSprintReportDTO>(initialSprintReport);

  const [preset, setPreset] = React.useState<AnalyticsPreset>(
    (initialAnalytics.window.preset as AnalyticsPreset) ?? "30d"
  );
  const [customFrom, setCustomFrom] = React.useState<string>(initialAnalytics.window.fromYmd);
  const [customTo, setCustomTo] = React.useState<string>(initialAnalytics.window.toYmd);
  const [includeRemoved, setIncludeRemoved] = React.useState<boolean>(
    initialMemberContribution.includeRemoved
  );
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const [selectedSprintIdForBurndown, setSelectedSprintIdForBurndown] = React.useState<string>(
    initialBurndown?.sprintId ?? initialSprintReport.sprints[0]?.sprintId ?? ""
  );
  const [burndownData, setBurndownData] = React.useState<SprintAnalyticsDTO | null>(
    initialBurndown
  );
  const [burndownLoading, setBurndownLoading] = React.useState<boolean>(false);

  const projectId = analytics.projectId;

  function buildTimeframeParams(
    targetPreset: AnalyticsPreset,
    fromVal: string,
    toVal: string,
    withIncludeRemoved?: boolean
  ): URLSearchParams {
    const params = new URLSearchParams();
    params.set("preset", targetPreset);
    if (targetPreset === "custom") {
      params.set("from", fromVal);
      params.set("to", toVal);
    }
    if (withIncludeRemoved !== undefined) {
      params.set("includeRemoved", String(withIncludeRemoved));
    }
    return params;
  }

  async function refreshWindowData(
    nextPreset: AnalyticsPreset,
    fromVal: string,
    toVal: string,
    nextIncludeRemoved: boolean
  ) {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const analyticsParams = buildTimeframeParams(nextPreset, fromVal, toVal);
      const memberParams = buildTimeframeParams(nextPreset, fromVal, toVal, nextIncludeRemoved);

      const [analyticsRes, memberRes] = await Promise.all([
        fetch(`/api/v1/reports/projects/${projectId}?${analyticsParams.toString()}`),
        fetch(`/api/v1/reports/projects/${projectId}/members?${memberParams.toString()}`),
      ]);

      const analyticsJson = await analyticsRes.json();
      if (!analyticsRes.ok) {
        throw new Error(analyticsJson?.error?.message ?? "Không thể tải dữ liệu phân tích.");
      }

      const memberJson = await memberRes.json();
      if (!memberRes.ok) {
        throw new Error(memberJson?.error?.message ?? "Không thể tải dữ liệu đóng góp thành viên.");
      }

      setAnalytics(analyticsJson.data);
      setMemberContribution(memberJson.data);
      setPreset(analyticsJson.data.window.preset);
      setCustomFrom(analyticsJson.data.window.fromYmd);
      setCustomTo(analyticsJson.data.window.toYmd);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Đã xảy ra lỗi khi cập nhật báo cáo.");
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshMembersOnly(nextIncludeRemoved: boolean) {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const memberParams = buildTimeframeParams(preset, customFrom, customTo, nextIncludeRemoved);
      const memberRes = await fetch(
        `/api/v1/reports/projects/${projectId}/members?${memberParams.toString()}`
      );
      const memberJson = await memberRes.json();
      if (!memberRes.ok) {
        throw new Error(memberJson?.error?.message ?? "Không thể cập nhật danh sách thành viên.");
      }
      setMemberContribution(memberJson.data);
      setIncludeRemoved(nextIncludeRemoved);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Không thể tải báo cáo thành viên.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSelectSprintBurndown(nextSprintId: string) {
    setSelectedSprintIdForBurndown(nextSprintId);
    if (!nextSprintId || !canReadSprints) return;

    setBurndownLoading(true);
    try {
      const res = await fetch(`/api/v1/sprints/${nextSprintId}/burndown`);
      const json = await res.json();
      if (res.ok && json?.data) {
        setBurndownData(json.data);
      }
    } finally {
      setBurndownLoading(false);
    }
  }

  function handlePresetClick(nextPreset: AnalyticsPreset) {
    setPreset(nextPreset);
    setErrorMessage(null);
    if (nextPreset !== "custom") {
      void refreshWindowData(nextPreset, customFrom, customTo, includeRemoved);
    }
  }

  function handleApplyCustom(e: React.FormEvent) {
    e.preventDefault();
    void refreshWindowData("custom", customFrom, customTo, includeRemoved);
  }

  function handleProjectSwitch(targetProjectId: string) {
    if (switcherMode === "global-reports") {
      router.push(`/reports?projectId=${encodeURIComponent(targetProjectId)}`);
    } else {
      router.push(`/projects/${encodeURIComponent(targetProjectId)}/reports`);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header & Switcher */}
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 lg:flex-row lg:items-end">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground hover:underline">
              Dashboard
            </Link>
            <span>/</span>
            <Link href={`/projects/${projectId}`} className="hover:text-foreground hover:underline">
              {analytics.projectName}
            </Link>
            <span>/</span>
            <span>Báo cáo &amp; Phân tích</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Báo cáo &amp; Phân tích Project
            </h1>
            <ProjectStatusBadge status={analytics.projectStatus as ProjectStatus} />
            <Badge variant="outline" className="gap-1 text-xs">
              <Eye className="h-3 w-3" />
              Chế độ xem trực tiếp (View-only)
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Phân tích tiến độ, đóng góp thành viên phi cộng dồn, tái dựng lịch sử Sprint và xu hướng
            tồn đọng ({analytics.window.timezone}, UTC+07:00).
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {accessibleProjects.length > 0 && (
            <div className="flex min-w-[260px] flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Chuyển Project báo cáo
              </span>
              <Select value={projectId} onValueChange={handleProjectSwitch}>
                <SelectTrigger aria-label="Chọn Project báo cáo">
                  <SelectValue placeholder="Chọn Project" />
                </SelectTrigger>
                <SelectContent>
                  {accessibleProjects.map((proj) => (
                    <SelectItem key={proj.id} value={proj.id}>
                      {proj.name} ({proj.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button asChild variant="outline" size="sm">
            <Link href={`/activity?projectId=${projectId}`}>
              Lịch sử hoạt động
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Archived Project Read-only Notice (DEC-053) */}
      {analytics.isReadOnly && (
        <Alert>
          <Archive className="h-4 w-4" />
          <AlertTitle>Project đang ở trạng thái Đã lưu trữ (Archived · Read-only)</AlertTitle>
          <AlertDescription>
            Bạn đang xem báo cáo lịch sử của Project đã đóng băng. Mọi số liệu được giữ nguyên vẹn
            để đối chiếu.
          </AlertDescription>
        </Alert>
      )}

      {/* Timeframe Controls (DEC-057) */}
      <Card>
        <CardContent className="flex flex-col justify-between gap-4 pt-5 lg:flex-row lg:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CalendarRange className="h-4 w-4" />
              Khoảng thời gian:
            </span>
            {PRESET_LABELS.map((item) => (
              <Button
                key={item.value}
                type="button"
                size="sm"
                variant={preset === item.value ? "default" : "outline"}
                onClick={() => handlePresetClick(item.value)}
                disabled={isLoading}
              >
                {item.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              Kỳ đang xem:{" "}
              <strong className="text-slate-900">
                {formatHcmDateVi(analytics.window.fromYmd)} –{" "}
                {formatHcmDateVi(analytics.window.toYmd)}
              </strong>{" "}
              ({analytics.window.spanDays} ngày)
            </span>
            <Badge variant="secondary">
              {analytics.window.granularity === "week"
                ? "Tự động gộp tuần ISO (> 90 ngày)"
                : "Hiển thị theo ngày"}
            </Badge>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          </div>
        </CardContent>

        {preset === "custom" && (
          <CardContent className="border-t border-border pt-4">
            <form onSubmit={handleApplyCustom} className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label htmlFor="report-from" className="text-xs font-medium text-slate-700">
                  Từ ngày (Asia/Ho_Chi_Minh)
                </label>
                <Input
                  id="report-from"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-44"
                  required
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="report-to" className="text-xs font-medium text-slate-700">
                  Đến ngày (Tối đa 365 ngày)
                </label>
                <Input
                  id="report-to"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-44"
                  required
                />
              </div>
              <Button type="submit" size="sm" disabled={isLoading}>
                Áp dụng
              </Button>
            </form>
          </CardContent>
        )}
      </Card>

      {analytics.window.wasClampedTo365Days && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Cửa sổ phân tích đã được giới hạn tối đa 365 ngày (DEC-057)</AlertTitle>
          <AlertDescription>
            Chế độ &ldquo;Toàn bộ&rdquo; tự động giới hạn trong 365 ngày gần nhất để đảm bảo hiệu
            năng truy vấn.
          </AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Tham số báo cáo không hợp lệ</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Report Navigation Tabs */}
      <div
        className="flex flex-wrap gap-2 border-b border-border pb-2"
        role="tablist"
        aria-label="Các mục báo cáo Project"
      >
        {(
          [
            { id: "overview", label: "1. Tổng quan & Xu hướng", icon: BarChart3 },
            { id: "sprints", label: "2. Phân tích Sprint", icon: Layers },
            { id: "members", label: "3. Đóng góp Thành viên", icon: Users },
            { id: "workload", label: "4. Khối lượng & Quá hạn", icon: Clock },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <Button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              variant={active ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(tab.id)}
              className="gap-1.5"
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {/* TAB 1: Overview & Trends */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Tổng Task</p>
                <p className="mt-1 text-2xl font-bold">{analytics.summary.totalTasks}</p>
              </CardContent>
            </Card>
            <Card className="border-emerald-200 bg-emerald-50/40">
              <CardContent className="pt-4">
                <p className="text-xs text-emerald-700">Hoàn thành</p>
                <p className="mt-1 text-2xl font-bold text-emerald-900">
                  {analytics.summary.completedTasks}
                </p>
              </CardContent>
            </Card>
            <Card className="border-sky-200 bg-sky-50/40">
              <CardContent className="pt-4">
                <p className="text-xs text-sky-700">Đang làm</p>
                <p className="mt-1 text-2xl font-bold text-sky-900">
                  {analytics.summary.inProgressTasks}
                </p>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50/40">
              <CardContent className="pt-4">
                <p className="text-xs text-amber-700">Chờ Review</p>
                <p className="mt-1 text-2xl font-bold text-amber-900">
                  {analytics.summary.reviewTasks}
                </p>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50/40">
              <CardContent className="pt-4">
                <p className="text-xs text-red-700">Đang quá hạn</p>
                <p className="mt-1 text-2xl font-bold text-red-900">
                  {analytics.summary.overdueTasks}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Tỷ lệ duyệt Review</p>
                <p className="mt-1 text-2xl font-bold">
                  {analytics.summary.overallReviewApprovalRatePercent}%
                </p>
              </CardContent>
            </Card>
          </div>

          {(analytics.summary.activeSprints?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers className="h-4 w-4 text-primary" />
                  Sprint đang thực hiện ({analytics.summary.activeSprints.length})
                </CardTitle>
                <CardDescription>
                  Hỗ trợ nhiều Sprint ACTIVE chạy song song trong cùng Project (DEC-006).
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {analytics.summary.activeSprints.map((sp) => (
                  <Link
                    key={sp.id}
                    href={`/projects/${projectId}/sprints/${sp.id}`}
                    className="flex flex-col gap-1.5 rounded-lg border border-border p-3 transition hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{sp.name}</span>
                      <Badge variant="default" className="text-xs">
                        {sp.progressPercent}% ({sp.doneTasks}/{sp.totalTasks})
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatHcmDateVi(sp.startDate)} – {formatHcmDateVi(sp.endDate)}
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Xu hướng Tạo mới &amp; Hoàn thành Task</CardTitle>
                <CardDescription>
                  Số Task tạo mới và chuyển DONE theo{" "}
                  {analytics.window.granularity === "week" ? "tuần ISO" : "ngày"} (múi giờ
                  Asia/Ho_Chi_Minh).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SvgDualLineTrendChart
                  ariaLabel="Biểu đồ xu hướng tạo và hoàn thành Task"
                  primaryLabel="Hoàn thành (DONE)"
                  secondaryLabel="Tạo mới"
                  points={analytics.completionTrend.map((pt) => ({
                    bucketKey: pt.bucketKey,
                    label: pt.label,
                    primaryValue: pt.completedCount,
                    secondaryValue: pt.createdCount,
                  }))}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Phân bổ Trạng thái Task</CardTitle>
                <CardDescription>Ảnh chụp trạng thái hiện tại của toàn Project.</CardDescription>
              </CardHeader>
              <CardContent>
                <SvgDonutChart
                  ariaLabel="Biểu đồ phân bổ trạng thái Task"
                  centerLabel="Task"
                  slices={analytics.statusDistribution.map((item) => ({
                    key: item.status,
                    label: STATUS_LABELS[item.status],
                    value: item.count,
                    color: STATUS_COLORS[item.status],
                    sublabel: `${item.plannedEstimateHours}h kế hoạch`,
                  }))}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Phân bổ Mức độ Ưu tiên</CardTitle>
                <CardDescription>Số Task và giờ kế hoạch theo độ ưu tiên.</CardDescription>
              </CardHeader>
              <CardContent>
                <SvgDonutChart
                  ariaLabel="Biểu đồ phân bổ độ ưu tiên Task"
                  centerLabel="Task"
                  slices={analytics.priorityDistribution.map((item) => ({
                    key: item.priority,
                    label: PRIORITY_LABELS[item.priority],
                    value: item.totalCount,
                    color: PRIORITY_COLORS[item.priority],
                    sublabel: `${item.doneCount} DONE`,
                  }))}
                />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">
                  Lịch sử Duyệt / Từ chối Review (Rework Trend)
                </CardTitle>
                <CardDescription>
                  Trong kỳ: {analytics.reviewAnalytics.summary.approvedInWindow} Approved ·{" "}
                  {analytics.reviewAnalytics.summary.rejectedInWindow} Rejected (Rework Rate:{" "}
                  {analytics.reviewAnalytics.summary.reworkRateInWindowPercent}%).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SvgStackedBarChart
                  ariaLabel="Biểu đồ quyết định Review APPROVED và REJECTED"
                  firstLabel="Approved"
                  secondLabel="Rejected"
                  points={analytics.reviewAnalytics.trend.map((item) => ({
                    bucketKey: item.bucketKey,
                    label: item.label,
                    firstValue: item.approvedCount,
                    secondValue: item.rejectedCount,
                  }))}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: Sprint Analysis (DEC-058, P0-01) */}
      {activeTab === "sprints" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Tổng Sprint</p>
                <p className="mt-1 text-2xl font-bold">{sprintReport.totalSprints}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Đã hoàn thành</p>
                <p className="mt-1 text-2xl font-bold">{sprintReport.completedSprints}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Tỷ lệ hoàn thành TB</p>
                <p className="mt-1 text-2xl font-bold">
                  {sprintReport.averageCompletionRatePercent}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Tổng Task Rollover</p>
                <p className="mt-1 text-2xl font-bold">{sprintReport.totalRolledOverTasks}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                So sánh Tỷ lệ hoàn thành &amp; Cam kết 6 chỉ số Sprint (DEC-058)
              </CardTitle>
              <CardDescription>
                Tái dựng từ TaskHistory &amp; ActivityLog (không dùng snapshot table); estimate của
                Sprint đã đóng được đóng băng chống chỉnh sửa sau đó (P0-01).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <HorizontalBreakdownBars
                items={sprintReport.sprints.map((s) => ({
                  key: s.sprintId,
                  label: `${s.name} (${formatHcmDateVi(s.startDate)} – ${formatHcmDateVi(s.endDate)})`,
                  value: s.completedTasks.completionRatePercent,
                  maxValue: 100,
                  displayValue: `${s.completedTasks.completionRatePercent}% (${s.completedTasks.taskCount}/${s.finalScopeTaskCount} Task)`,
                  sublabel: s.isBaselineAvailable
                    ? `Baseline: ${s.baselineCommitment.taskCount} Task (${s.baselineCommitment.estimateHours}h) · Coverage: ${s.estimateCoveragePercent}%`
                    : `Chưa kích hoạt (Kế hoạch hiện có: ${s.plannedTaskCount} Task)`,
                  colorClass: "bg-emerald-600",
                }))}
                emptyMessage="Project chưa có Sprint nào."
              />

              {sprintReport.sprints.length > 0 && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sprint</TableHead>
                        <TableHead className="text-right">Baseline</TableHead>
                        <TableHead className="text-right">Thêm (+)</TableHead>
                        <TableHead className="text-right">Gỡ (-)</TableHead>
                        <TableHead className="text-right">Hoàn thành</TableHead>
                        <TableHead className="text-right">Về Backlog</TableHead>
                        <TableHead className="text-right">Sang Sprint</TableHead>
                        <TableHead className="text-right">Độ tin cậy &amp; Coverage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sprintReport.sprints.map((s) => (
                        <TableRow key={s.sprintId}>
                          <TableCell className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                href={`/projects/${projectId}/sprints/${s.sprintId}`}
                                className="font-semibold text-slate-900 hover:text-primary hover:underline"
                              >
                                {s.name}
                              </Link>
                              <SprintStatusBadge status={s.status as SprintStatus} />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatHcmDateVi(s.startDate)} → {formatHcmDateVi(s.endDate)}
                            </p>
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            <span className="font-semibold">{s.baselineCommitment.taskCount}</span>{" "}
                            Task
                            <br />
                            <span className="text-muted-foreground">
                              {s.baselineCommitment.estimateHours}h
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-xs text-sky-700">
                            +{s.scopeAdded.taskCount} Task
                            <br />+{s.scopeAdded.estimateHours}h
                          </TableCell>
                          <TableCell className="text-right text-xs text-amber-700">
                            -{s.scopeRemoved.taskCount} Task
                            <br />-{s.scopeRemoved.estimateHours}h
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            <span className="font-semibold text-emerald-700">
                              {s.completedTasks.taskCount} ({s.completedTasks.completionRatePercent}
                              %)
                            </span>
                            <br />
                            <span className="text-muted-foreground">
                              {s.completedTasks.estimateHours}h
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {s.rolledOverToBacklog.taskCount} Task
                            <br />
                            <span className="text-muted-foreground">
                              {s.rolledOverToBacklog.estimateHours}h
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {s.rolledOverToSprint.taskCount} Task
                            <br />
                            <span className="text-muted-foreground">
                              {s.rolledOverToSprint.estimateHours}h
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            <Badge variant="outline">{s.reconstructionConfidence}</Badge>
                            <div className="mt-1 text-muted-foreground">
                              Est: {s.estimateCoveragePercent}%
                            </div>
                            {s.hasPostSprintEstimateEdits && (
                              <div className="mt-0.5 text-[10px] text-amber-700">
                                Đã khóa hậu Sprint (P0-01)
                              </div>
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

          {canReadSprints && sprintReport.sprints.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-900">
                  Burndown Chart chi tiết từng Sprint
                </h2>
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedSprintIdForBurndown}
                    onValueChange={handleSelectSprintBurndown}
                  >
                    <SelectTrigger className="w-64" aria-label="Chọn Sprint xem Burndown">
                      <SelectValue placeholder="Chọn Sprint" />
                    </SelectTrigger>
                    <SelectContent>
                      {sprintReport.sprints.map((s) => (
                        <SelectItem key={s.sprintId} value={s.sprintId}>
                          {s.name} ({s.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {burndownLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                </div>
              </div>
              {burndownData && <SprintBurndownChart analytics={burndownData} />}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Member Contribution (DEC-047..050, DEC-052, P0-02, P1-03) */}
      {activeTab === "members" && (
        <div className="space-y-5">
          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>
              Nguyên tắc minh bạch &amp; phi cộng dồn (DEC-047 / DEC-048 / DEC-049)
            </AlertTitle>
            <AlertDescription className="space-y-1 text-xs">
              {memberContribution.disclaimers.map((d) => (
                <p key={d}>• {d}</p>
              ))}
            </AlertDescription>
          </Alert>

          {memberContribution.viewScope === "SELF_ONLY" && (
            <Alert>
              <UserCheck className="h-4 w-4" />
              <AlertTitle>Phạm vi dữ liệu cá nhân (Quyền MEMBER · DEC-052)</AlertTitle>
              <AlertDescription>
                Để đảm bảo bảo mật đồng đội, bạn chỉ xem được dòng đóng góp của riêng mình cùng tổng
                hợp chung của toàn Project.
              </AlertDescription>
            </Alert>
          )}

          {/* Project Totals Header */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Tổng hợp đối chiếu toàn Project (Project Totals)
              </CardTitle>
              <CardDescription>
                Phân loại quyền sở hữu Task hiện tại:{" "}
                {memberContribution.projectTotals.soleAssignedTasks} Sole-Assigned ·{" "}
                {memberContribution.projectTotals.coAssignedTasks} Co-Assigned ·{" "}
                {memberContribution.projectTotals.unassignedTasks} Chưa giao ·{" "}
                {memberContribution.projectTotals.unestimatedTaskCount} Task chưa có Estimate.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Tổng Task Project</p>
                <p className="text-xl font-bold">{memberContribution.projectTotals.totalTasks}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">DONE (Project)</p>
                <p className="text-xl font-bold text-emerald-700">
                  {memberContribution.projectTotals.doneTasks}
                </p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Quá hạn (Project)</p>
                <p className="text-xl font-bold text-red-700">
                  {memberContribution.projectTotals.overdueTasks}
                </p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Estimate kế hoạch</p>
                <p className="text-xl font-bold">
                  {memberContribution.projectTotals.totalPlannedEstimateHours}h
                </p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Độ phủ Estimate</p>
                <p className="text-xl font-bold">
                  {memberContribution.projectTotals.estimateCoveragePercent}%
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <CardTitle className="text-base">
                  Chi tiết tham gia &amp; hành động ghi nhận được (
                  {memberContribution.members.length})
                </CardTitle>
                <CardDescription>
                  Sắp xếp theo vai trò và bảng chữ cái; không xếp hạng theo chỉ số hoàn thành.
                </CardDescription>
              </div>

              {memberContribution.viewScope === "ALL_MEMBERS" &&
                memberContribution.hasDepartedMembers && (
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={includeRemoved}
                      disabled={isLoading}
                      onChange={(e) => void refreshMembersOnly(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Hiển thị thành viên đã rời Project (DEC-050)
                  </label>
                )}
            </CardHeader>

            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thành viên</TableHead>
                    <TableHead className="text-right">Đang giao (Sole / Co)</TableHead>
                    <TableHead className="text-right">Đã xong (Sole / Co)</TableHead>
                    <TableHead className="text-right">In Prog / Rev / Overdue</TableHead>
                    <TableHead className="text-right">Estimate kế hoạch</TableHead>
                    <TableHead className="text-right">Lịch sử tham gia (P0-02)</TableHead>
                    <TableHead className="text-right">Hành động trong kỳ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberContribution.members.map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-slate-900">{row.fullName}</span>
                          <Badge
                            variant={
                              row.membershipStatus === "LEFT_PROJECT" ? "outline" : "secondary"
                            }
                            className={
                              row.membershipStatus === "LEFT_PROJECT"
                                ? "border-amber-300 bg-amber-50 text-amber-800"
                                : ""
                            }
                          >
                            {row.membershipBadge}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {row.email} · {row.projectRole}
                        </p>
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        <span className="font-bold text-slate-900">
                          {row.currentAssigned.total}
                        </span>{" "}
                        ({row.currentAssigned.soleAssignedCount} /{" "}
                        {row.currentAssigned.coAssignedCount})
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        <span className="font-semibold text-emerald-700">
                          {row.currentAssigned.completedCount} (
                          {row.currentAssigned.completionRatePercent}%)
                        </span>
                        <br />
                        <span className="text-muted-foreground">
                          {row.currentAssigned.completedSoleCount} Sole ·{" "}
                          {row.currentAssigned.completedCoAssignedCount} Co
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {row.currentAssigned.inProgressCount} / {row.currentAssigned.reviewCount} /{" "}
                        <span
                          className={
                            row.currentAssigned.overdueCount > 0 ? "font-semibold text-red-700" : ""
                          }
                        >
                          {row.currentAssigned.overdueCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        <span className="font-semibold">
                          {row.currentAssigned.plannedEstimateHours.total}h
                        </span>
                        <br />
                        <span className="text-muted-foreground">
                          {row.currentAssigned.plannedEstimateHours.sole}h Sole ·{" "}
                          {row.currentAssigned.plannedEstimateHours.coAssigned}h Co
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        <span>
                          Từng tham gia:{" "}
                          <strong>{row.historicalAssignments.uniqueTasksEverAssigned}</strong> Task
                        </span>
                        <br />
                        <span className="text-muted-foreground">
                          Cũ: {row.historicalAssignments.formerTasksDistinctCount} (
                          {row.historicalAssignments.historicalDoneDistinctCount} DONE) ·{" "}
                          {row.historicalAssignments.totalAssignmentEpisodes} lượt gán
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        <span>
                          <strong>{row.verifiableActivity.taskHistoryActionsTotal}</strong>{" "}
                          TaskHistory
                        </span>
                        <br />
                        <span className="text-muted-foreground">
                          Review: {row.verifiableActivity.reviewsConductedTotal} (
                          {row.verifiableActivity.reviewsApprovedCount}A/
                          {row.verifiableActivity.reviewsRejectedCount}R) ·{" "}
                          {row.verifiableActivity.activityLogsCount} Logs
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: Planned Effort & Overdue Aging (DEC-048, DEC-052) */}
      {activeTab === "workload" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Tổng Estimate kế hoạch</p>
                <p className="mt-1 text-2xl font-bold">
                  {analytics.workloadSummary.totalPlannedEstimateHours}h
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Estimate đã xong (DONE)</p>
                <p className="mt-1 text-2xl font-bold text-emerald-700">
                  {analytics.workloadSummary.donePlannedEstimateHours}h
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Độ phủ Estimate</p>
                <p className="mt-1 text-2xl font-bold">
                  {analytics.workloadSummary.estimateCoveragePercent}%
                </p>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50/40">
              <CardContent className="pt-4">
                <p className="text-xs text-amber-800">Task chưa ước lượng (Unestimated)</p>
                <p className="mt-1 text-2xl font-bold text-amber-950">
                  {analytics.workloadSummary.unestimatedTaskCount}/
                  {analytics.workloadSummary.totalTasks}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Khối lượng kế hoạch theo Sprint &amp; Backlog (Aggregate)
                </CardTitle>
                <CardDescription>
                  Tổng hợp cấp Project (không hiển thị giờ thực tế hay chia bảng cá nhân).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <HorizontalBreakdownBars
                  items={analytics.workloadSummary.bySprint.map((bucket) => ({
                    key: bucket.sprintId ?? "backlog",
                    label: bucket.sprintName,
                    value: bucket.plannedEstimateHours,
                    displayValue: `${bucket.plannedEstimateHours}h (${bucket.completedEstimateHours}h xong)`,
                    sublabel: `${bucket.totalTasks} Task · ${bucket.unestimatedTaskCount} chưa có Estimate`,
                    colorClass: bucket.sprintId ? "bg-sky-600" : "bg-slate-500",
                  }))}
                />
                <div className="space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                  {analytics.workloadSummary.limitations.map((note) => (
                    <p key={note}>• {note}</p>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Tuổi nợ Quá hạn hiện tại (Overdue Aging ·{" "}
                  {analytics.overdueAnalytics.totalOverdueNow} Task)
                </CardTitle>
                <CardDescription>
                  To Do: {analytics.overdueAnalytics.overdueByStatus.TODO} · In Progress:{" "}
                  {analytics.overdueAnalytics.overdueByStatus.IN_PROGRESS} · Chờ Review:{" "}
                  {analytics.overdueAnalytics.overdueByStatus.REVIEW}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <HorizontalBreakdownBars
                  items={analytics.overdueAnalytics.agingBuckets.map((bucket) => ({
                    key: bucket.key,
                    label: `Quá hạn ${bucket.label}`,
                    value: bucket.count,
                    maxValue: Math.max(1, analytics.overdueAnalytics.totalOverdueNow),
                    displayValue: `${bucket.count} Task`,
                    colorClass:
                      bucket.key === "OVER_14_DAYS"
                        ? "bg-red-700"
                        : bucket.key === "8_14_DAYS"
                          ? "bg-red-500"
                          : bucket.key === "4_7_DAYS"
                            ? "bg-orange-500"
                            : "bg-amber-500",
                  }))}
                />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">
                  Xu hướng Trễ Deadline trong kỳ (Overdue Slip Trend)
                </CardTitle>
                <CardDescription>
                  Task có deadline nằm trong kỳ đã chọn nhưng chưa xong hoặc hoàn thành trễ hạn.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SvgStackedBarChart
                  ariaLabel="Biểu đồ xu hướng Task trễ deadline"
                  firstLabel="Hoàn thành trễ hạn"
                  secondLabel="Đang mở & Quá hạn"
                  firstColor="#f59e0b"
                  secondColor="#dc2626"
                  points={analytics.overdueAnalytics.slipTrend.map((pt) => ({
                    bucketKey: pt.bucketKey,
                    label: pt.label,
                    firstValue: pt.lateCompletedCount,
                    secondValue: pt.overdueActiveCount,
                  }))}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Footer Note */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
        <span>
          Báo cáo trực tiếp (View-only, DEC-054) · Nguồn sự thật duy nhất từ PostgreSQL/Prisma.
        </span>
      </div>
    </div>
  );
}
