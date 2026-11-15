"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, FolderKanban, Plus, Search, Users } from "lucide-react";
import { ProjectStatusBadge } from "@/components/shared/status-badge";
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
import type { ProjectDTO } from "@/modules/projects/project.repository";

const ALL_VALUE = "__ALL__";

function formatShortDate(isoString: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(isoString));
}

export function ProjectListClient({
  projects,
  total,
  page,
  pageSize,
  totalPages,
  filters,
  canCreate,
  canManageAny,
}: {
  projects: ProjectDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: {
    search: string;
    status: string;
  };
  canCreate: boolean;
  canManageAny: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = React.useState(filters.search);
  const [status, setStatus] = React.useState(filters.status || ALL_VALUE);

  function pushFilters(nextPage: number, nextSearch = search, nextStatus = status) {
    const params = new URLSearchParams();
    if (nextSearch.trim()) params.set("search", nextSearch.trim());
    if (nextStatus !== ALL_VALUE) params.set("status", nextStatus);
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    router.push(qs ? `/projects?${qs}` : "/projects");
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    pushFilters(1, search, status);
  }

  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FolderKanban className="h-5 w-5 text-slate-700" />
              <span>Danh sách Project ({total})</span>
            </CardTitle>
            <CardDescription>
              Chỉ tối đa 01 Project được phép ACTIVE tại một thời điểm trên toàn Workspace
              (BR-PROJ-004).
            </CardDescription>
          </div>
          {canCreate && (
            <Button asChild>
              <Link href="/projects/new">
                <Plus className="h-4 w-4" />
                <span>Tạo Project mới</span>
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên Project, mô tả hoặc mục tiêu..."
                className="pl-9"
              />
            </div>

            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                pushFilters(1, search, value);
              }}
            >
              <SelectTrigger className="w-full sm:w-48" aria-label="Lọc theo trạng thái">
                <SelectValue placeholder="Tất cả trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Tất cả trạng thái</SelectItem>
                <SelectItem value="ACTIVE">Đang hoạt động (ACTIVE)</SelectItem>
                <SelectItem value="CREATED">Mới tạo (CREATED)</SelectItem>
                <SelectItem value="ARCHIVED">Đã lưu trữ (ARCHIVED)</SelectItem>
              </SelectContent>
            </Select>

            <Button type="submit" variant="secondary">
              Lọc
            </Button>
          </form>

          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Leader &amp; Giảng viên</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead className="text-center">Thành viên</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-28 text-center text-sm text-muted-foreground"
                    >
                      Không có Project nào phù hợp trong phạm vi truy cập của bạn.
                    </TableCell>
                  </TableRow>
                ) : (
                  projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="max-w-xs align-top">
                        <Link
                          href={`/projects/${project.id}`}
                          className="font-semibold text-slate-900 hover:underline"
                        >
                          {project.name}
                        </Link>
                        {project.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {project.description}
                          </p>
                        )}
                        {project.technologies.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {project.technologies.slice(0, 4).map((tech) => (
                              <Badge key={tech} variant="outline" className="text-[11px]">
                                {tech}
                              </Badge>
                            ))}
                            {project.technologies.length > 4 && (
                              <Badge variant="outline" className="text-[11px]">
                                +{project.technologies.length - 4}
                              </Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <ProjectStatusBadge status={project.status} />
                        {project.template && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Mẫu: {project.template.name}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="align-top text-xs">
                        <p className="font-medium text-slate-900">
                          Leader: {project.leader.fullName}
                        </p>
                        <p className="mt-0.5 text-muted-foreground">
                          GVHD: {project.instructor ? project.instructor.fullName : "Chưa chỉ định"}
                        </p>
                      </TableCell>
                      <TableCell className="align-top text-xs text-slate-700">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {formatShortDate(project.startDate)} – {formatShortDate(project.endDate)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center align-top text-sm font-medium">
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          {project.activeMemberCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <div className="flex justify-end gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/projects/${project.id}`}>Chi tiết</Link>
                          </Button>
                          {canManageAny && project.status !== "ARCHIVED" && (
                            <Button asChild size="sm" variant="secondary">
                              <Link href={`/projects/${project.id}/edit`}>Sửa</Link>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
            <p>
              Hiển thị {startItem}–{endItem} trên tổng {total} Project
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => pushFilters(page - 1)}
              >
                Trang trước
              </Button>
              <span>
                Trang {page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => pushFilters(page + 1)}
              >
                Trang sau
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
