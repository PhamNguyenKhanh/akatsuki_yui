"use client";

import * as React from "react";
import Link from "next/link";
import { ProjectStatus } from "@prisma/client";
import {
  Activity,
  Archive,
  Clock,
  Filter,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { sanitizeInternalTargetPath } from "@/lib/safe-url";
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
import { formatHcmDateTimeVi } from "@/lib/timezone";
import { ACTIVITY_ENTITY_TYPES } from "@/modules/activity/activity.schema";
import type { ActivityEntryDTO } from "@/modules/activity/activity.repository";
import type {
  ActivityFeedPageDTO,
  ActivityFilterOptionsDTO,
} from "@/modules/activity/activity.service";

const ENTITY_TYPE_LABELS: Record<(typeof ACTIVITY_ENTITY_TYPES)[number], string> = {
  Project: "Project",
  ProjectMember: "Thành viên Project",
  Sprint: "Sprint",
  Document: "Tài liệu (Document)",
  Task: "Task & Review",
  User: "Tài khoản (User)",
  Role: "Vai trò (Role)",
  ProjectTemplate: "Mẫu dự án (Template)",
};

interface ActivityLogClientProps {
  initialFeed: ActivityFeedPageDTO;
  filterOptions: ActivityFilterOptionsDTO;
  initialProjectId?: string;
}

export function ActivityLogClient({
  initialFeed,
  filterOptions,
  initialProjectId = "",
}: ActivityLogClientProps) {
  const [items, setItems] = React.useState<ActivityEntryDTO[]>(initialFeed.items);
  const [nextCursor, setNextCursor] = React.useState<string | null>(
    initialFeed.pageInfo.nextCursor
  );
  const [hasNextPage, setHasNextPage] = React.useState<boolean>(initialFeed.pageInfo.hasNextPage);
  const [isRestrictedScope, setIsRestrictedScope] = React.useState<boolean>(
    initialFeed.scope.hasRestrictedMemberProjects
  );

  const [projectId, setProjectId] = React.useState<string>(initialProjectId || "ALL");
  const [sourceFilter, setSourceFilter] = React.useState<string>("ALL");
  const [entityTypeFilter, setEntityTypeFilter] = React.useState<string>("ALL");
  const [actionFilter, setActionFilter] = React.useState<string>("");
  const [actorId, setActorId] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [fromDate, setFromDate] = React.useState<string>("");
  const [toDate, setToDate] = React.useState<string>("");

  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState<boolean>(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  function buildParams(
    cursor: string | null,
    override?: {
      projectId?: string;
      source?: string;
      entityType?: string;
      action?: string;
      actorId?: string;
      search?: string;
      from?: string;
      to?: string;
    }
  ): URLSearchParams {
    const params = new URLSearchParams();
    params.set("limit", "25");

    const pId = override?.projectId ?? projectId;
    const src = override?.source ?? sourceFilter;
    const ent = override?.entityType ?? entityTypeFilter;
    const act = override?.action ?? actionFilter;
    const aId = override?.actorId ?? actorId;
    const q = override?.search ?? searchQuery;
    const fDate = override?.from ?? fromDate;
    const tDate = override?.to ?? toDate;

    if (pId && pId !== "ALL") params.set("projectId", pId);
    if (src && src !== "ALL") params.set("source", src);
    if (ent && ent !== "ALL") params.set("entityType", ent);
    if (act.trim()) params.set("action", act.trim());
    if (aId && aId !== "ALL") params.set("userId", aId);
    if (q.trim()) params.set("search", q.trim());
    if (fDate) params.set("from", fDate);
    if (tDate) params.set("to", tDate);
    if (cursor) params.set("cursor", cursor);

    return params;
  }

  async function fetchFreshPage(override?: {
    projectId?: string;
    source?: string;
    entityType?: string;
    action?: string;
    actorId?: string;
    search?: string;
    from?: string;
    to?: string;
  }) {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const params = buildParams(null, override);
      const res = await fetch(`/api/v1/activity?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Không thể tải nhật ký hoạt động.");
      }
      const feed = json.data as ActivityFeedPageDTO;
      setItems(feed.items);
      setNextCursor(feed.pageInfo.nextCursor);
      setHasNextPage(feed.pageInfo.hasNextPage);
      setIsRestrictedScope(feed.scope.hasRestrictedMemberProjects);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Đã xảy ra lỗi khi tải hoạt động.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLoadMore() {
    if (!hasNextPage || !nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setErrorMessage(null);
    try {
      const params = buildParams(nextCursor);
      const res = await fetch(`/api/v1/activity?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Không thể tải thêm hoạt động cũ hơn.");
      }
      const feed = json.data as ActivityFeedPageDTO;
      setItems((prev) => {
        const seen = new Set(prev.map((row) => row.cursorKey));
        const appended = feed.items.filter((row) => !seen.has(row.cursorKey));
        return [...prev, ...appended];
      });
      setNextCursor(feed.pageInfo.nextCursor);
      setHasNextPage(feed.pageInfo.hasNextPage);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Không thể tải thêm dữ liệu từ cursor.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  function handleApplyFilters(e: React.FormEvent) {
    e.preventDefault();
    void fetchFreshPage();
  }

  function handleResetFilters() {
    setProjectId("ALL");
    setSourceFilter("ALL");
    setEntityTypeFilter("ALL");
    setActionFilter("");
    setActorId("ALL");
    setSearchQuery("");
    setFromDate("");
    setToDate("");
    void fetchFreshPage({
      projectId: "ALL",
      source: "ALL",
      entityType: "ALL",
      action: "",
      actorId: "ALL",
      search: "",
      from: "",
      to: "",
    });
  }

  const selectedProjectOption = filterOptions.projects.find((p) => p.id === projectId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <Activity className="h-6 w-6 text-primary" />
            Lịch sử Hoạt động Thống nhất
          </h1>
          <p className="text-sm text-muted-foreground">
            Dòng thời gian hợp nhất giữa ActivityLog (Project/Sprint/Document) và TaskHistory (Task
            &amp; Review) theo múi giờ Asia/Ho_Chi_Minh.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void fetchFreshPage()}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Làm mới
        </Button>
      </div>

      {isRestrictedScope && (
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Phạm vi hiển thị dành cho Member (DEC-052)</AlertTitle>
          <AlertDescription>
            Trong các Project bạn tham gia với vai trò Member, bạn chỉ xem được hành động của chính
            mình hoặc hoạt động trên các Task bạn được giao, và không bao gồm nhật ký cấp Workspace.
          </AlertDescription>
        </Alert>
      )}

      {selectedProjectOption?.status === ProjectStatus.ARCHIVED && (
        <Alert>
          <Archive className="h-4 w-4" />
          <AlertTitle>Đang lọc Project Đã lưu trữ (Archived · Read-only)</AlertTitle>
          <AlertDescription>
            Bạn đang xem lại nhật ký lịch sử của Project {selectedProjectOption.name}.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4 text-primary" />
            Bộ lọc hoạt động
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleApplyFilters} className="grid gap-3 md:grid-cols-6">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700">Project</label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger aria-label="Lọc theo Project">
                  <SelectValue placeholder="Tất cả Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả Project được phép</SelectItem>
                  {filterOptions.projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Nguồn sự kiện</label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger aria-label="Lọc theo nguồn sự kiện">
                  <SelectValue placeholder="Tất cả nguồn" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả nguồn</SelectItem>
                  <SelectItem value="TASK">Task &amp; Review</SelectItem>
                  <SelectItem value="WORKSPACE">Workspace &amp; Sprint</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Người thực hiện
              </label>
              <Select value={actorId} onValueChange={setActorId}>
                <SelectTrigger aria-label="Lọc theo người thực hiện">
                  <SelectValue placeholder="Tất cả" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả người thực hiện</SelectItem>
                  {filterOptions.actors.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="act-from" className="mb-1 block text-xs font-medium text-slate-700">
                Từ ngày
              </label>
              <Input
                id="act-from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="act-to" className="mb-1 block text-xs font-medium text-slate-700">
                Đến ngày
              </label>
              <Input
                id="act-to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="act-search" className="mb-1 block text-xs font-medium text-slate-700">
                Từ khóa (Mô tả / Task)
              </label>
              <Input
                id="act-search"
                type="text"
                placeholder="Tìm theo nội dung, tiêu đề Task..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                maxLength={200}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700">Đối tượng (Entity)</label>
              <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                <SelectTrigger aria-label="Lọc theo loại đối tượng">
                  <SelectValue placeholder="Tất cả đối tượng" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả đối tượng</SelectItem>
                  {ACTIVITY_ENTITY_TYPES.map((ent) => (
                    <SelectItem key={ent} value={ent}>
                      {ENTITY_TYPE_LABELS[ent]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="act-action" className="mb-1 block text-xs font-medium text-slate-700">
                Mã hành động (Action)
              </label>
              <Input
                id="act-action"
                type="text"
                placeholder="VD: PROJECT_CREATED, REVIEW_APPROVED..."
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 md:col-span-6">
              <Button type="submit" size="sm" disabled={isLoading}>
                Áp dụng bộ lọc
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                disabled={isLoading}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Đặt lại
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertTitle>Không thể tải lịch sử</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Nhật ký dòng thời gian ({items.length} mục đã tải)
          </CardTitle>
          <CardDescription>
            Phân trang bằng cursor ổn định theo thứ tự thời gian giảm dần (không bỏ sót khi có sự
            kiện mới).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Không có hoạt động nào khớp với điều kiện lọc hiện tại.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => (
                <div
                  key={item.cursorKey}
                  className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={item.source === "TASK" ? "secondary" : "outline"}>
                        {item.source === "TASK" ? "Task" : "Workspace"}
                      </Badge>
                      {item.projectName && (
                        <Badge variant="outline" className="font-normal">
                          {item.projectName}
                          {item.projectStatus === ProjectStatus.ARCHIVED ? " · Archived" : ""}
                        </Badge>
                      )}
                      {(() => {
                        const safeTargetUrl = sanitizeInternalTargetPath(item.targetUrl);
                        return safeTargetUrl ? (
                          <Link
                            href={safeTargetUrl}
                            className="font-medium text-slate-900 hover:text-primary hover:underline"
                          >
                            {item.summary}
                          </Link>
                        ) : (
                          <span className="font-medium text-slate-900">{item.summary}</span>
                        );
                      })()}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.actor ? `${item.actor.fullName} (${item.actor.email})` : "Hệ thống"} ·{" "}
                      <span className="font-mono">{item.action}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatHcmDateTimeVi(item.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasNextPage && nextCursor && (
            <div className="mt-4 flex justify-center border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleLoadMore()}
                disabled={isLoadingMore}
              >
                {isLoadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                Xem thêm hoạt động cũ hơn
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
