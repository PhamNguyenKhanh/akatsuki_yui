"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { AccountStatusBadge, RoleBadge } from "@/components/shared/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { AccountStatusActions } from "@/components/users/account-status-actions";
import { formatDateTime } from "@/lib/utils";
import { ROLES } from "@/modules/authorization/constants";
import type { SafeUserDTO } from "@/types/auth";

interface UsersTableProps {
  users: SafeUserDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: {
    search: string;
    status: string;
    role: string;
  };
  capabilities: {
    canApprove: boolean;
    canManage: boolean;
  };
}

export function UsersTable({
  users,
  total,
  page,
  pageSize,
  totalPages,
  filters,
  capabilities,
}: UsersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [actionError, setActionError] = React.useState<string | null>(null);

  function navigateWithFilters(next: {
    search?: string;
    status?: string;
    role?: string;
    page?: number;
  }) {
    const params = new URLSearchParams();
    const resolvedSearch = next.search !== undefined ? next.search : filters.search;
    const resolvedStatus = next.status !== undefined ? next.status : filters.status;
    const resolvedRole = next.role !== undefined ? next.role : filters.role;
    const resolvedPage = next.page !== undefined ? next.page : 1;

    if (resolvedSearch.trim()) params.set("search", resolvedSearch.trim());
    if (resolvedStatus && resolvedStatus !== "ALL") params.set("status", resolvedStatus);
    if (resolvedRole && resolvedRole !== "ALL") params.set("role", resolvedRole);
    if (resolvedPage > 1) params.set("page", String(resolvedPage));
    if (pageSize !== 10) params.set("pageSize", String(pageSize));

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const search = String(formData.get("search") ?? "");
    navigateWithFilters({ search, page: 1 });
  }

  function handleReset() {
    router.push(pathname);
  }

  const hasFilters = Boolean(filters.search || filters.status || filters.role);

  return (
    <div className="space-y-4">
      {actionError && (
        <Alert variant="destructive">
          <AlertTitle>Không thể thực hiện thao tác</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <form onSubmit={handleSearchSubmit} className="flex flex-1 gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  key={filters.search}
                  name="search"
                  defaultValue={filters.search}
                  placeholder="Tìm theo họ tên hoặc email..."
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="secondary">
                Tìm kiếm
              </Button>
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={filters.status || "ALL"}
                onValueChange={(value) =>
                  navigateWithFilters({ status: value === "ALL" ? "" : value, page: 1 })
                }
              >
                <SelectTrigger className="w-[165px]" aria-label="Lọc theo trạng thái">
                  <SelectValue placeholder="Trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
                  <SelectItem value="PENDING">PENDING</SelectItem>
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="SUSPENDED">SUSPENDED</SelectItem>
                  <SelectItem value="REJECTED">REJECTED</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.role || "ALL"}
                onValueChange={(value) =>
                  navigateWithFilters({ role: value === "ALL" ? "" : value, page: 1 })
                }
              >
                <SelectTrigger className="w-[155px]" aria-label="Lọc theo vai trò">
                  <SelectValue placeholder="Vai trò" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả vai trò</SelectItem>
                  <SelectItem value={ROLES.ADMIN}>ADMIN</SelectItem>
                  <SelectItem value={ROLES.INSTRUCTOR}>INSTRUCTOR</SelectItem>
                  <SelectItem value={ROLES.LEADER}>LEADER</SelectItem>
                  <SelectItem value={ROLES.REVIEWER}>REVIEWER</SelectItem>
                  <SelectItem value={ROLES.MEMBER}>MEMBER</SelectItem>
                </SelectContent>
              </Select>

              {hasFilters && (
                <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
                  <X className="h-4 w-4" />
                  Xóa lọc
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {users.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Không tìm thấy tài khoản nào khớp với bộ lọc hiện tại.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thành viên</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium text-slate-900">{user.fullName}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => (
                          <RoleBadge key={role} role={role} />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <AccountStatusBadge status={user.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground" suppressHydrationWarning>
                      {formatDateTime(user.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <AccountStatusActions
                          userId={user.id}
                          userEmail={user.email}
                          currentStatus={user.status}
                          canApprove={capabilities.canApprove}
                          canManage={capabilities.canManage}
                          compact
                          onErrorMessage={setActionError}
                        />
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/admin/users/${user.id}`}>Chi tiết</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
        <div>
          Hiển thị <strong>{users.length}</strong> / <strong>{total}</strong> tài khoản (Trang{" "}
          {page} / {totalPages})
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => navigateWithFilters({ page: page - 1 })}
          >
            <ChevronLeft className="h-4 w-4" />
            Trước
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => navigateWithFilters({ page: page + 1 })}
          >
            Sau
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
