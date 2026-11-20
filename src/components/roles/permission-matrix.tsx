"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Lock, Search, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROLES, type PermissionCode } from "@/modules/authorization/constants";
import { toggleRolePermissionAction } from "@/modules/roles/role.actions";
import type { PermissionMatrixDTO } from "@/modules/roles/role.repository";

const CATEGORY_LABELS: Record<string, string> = {
  account: "Tài khoản",
  role: "Phân quyền",
  project: "Dự án",
  task: "Công việc (Task)",
  sprint: "Sprint",
  schedule: "Lịch bận (Schedule)",
  meeting: "Cuộc họp (Google Meet)",
  document: "Tài liệu",
  notification: "Thông báo",
  report: "Báo cáo",
  activity: "Nhật ký hoạt động",
};

function getCategoryLabel(code: string): string {
  const prefix = code.split(".")[0] ?? "";
  return CATEGORY_LABELS[prefix] ?? "Khác";
}

export function PermissionMatrix({ initialMatrix }: { initialMatrix: PermissionMatrixDTO }) {
  const router = useRouter();
  const roles = initialMatrix.roles;
  const [searchTerm, setSearchTerm] = React.useState("");
  const [pendingCellKey, setPendingCellKey] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const normalizedQuery = searchTerm.trim().toLowerCase();
  const filteredPermissions = initialMatrix.permissions.filter((perm) => {
    if (!normalizedQuery) return true;
    return (
      perm.code.toLowerCase().includes(normalizedQuery) ||
      perm.name.toLowerCase().includes(normalizedQuery) ||
      (perm.description?.toLowerCase().includes(normalizedQuery) ?? false)
    );
  });

  async function handleToggle(
    roleId: string,
    roleName: string,
    permissionId: string,
    permissionCode: PermissionCode,
    currentlyGranted: boolean
  ) {
    const cellKey = `${roleId}:${permissionId}`;
    setPendingCellKey(cellKey);
    setErrorMessage(null);

    const nextGranted = !currentlyGranted;
    const result = await toggleRolePermissionAction(roleId, {
      permissionId,
      granted: nextGranted,
    });

    setPendingCellKey(null);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      toast.error(result.error.message);
      return;
    }

    toast.success(
      nextGranted
        ? `Đã cấp quyền ${permissionCode} cho Role ${roleName}.`
        : `Đã thu hồi quyền ${permissionCode} khỏi Role ${roleName}.`
    );
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {roles.map((role) => (
          <Card key={role.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{role.name}</CardTitle>
                <Badge variant={role.name === ROLES.ADMIN ? "default" : "secondary"}>
                  {role.permissionCodes.length}/{initialMatrix.permissions.length} quyền
                </Badge>
              </div>
              <CardDescription className="line-clamp-2 min-h-[2.5rem] text-xs">
                {role.description ?? "Không có mô tả"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              Thành viên đang gán: <strong className="text-slate-900">{role.userCount}</strong>
            </CardContent>
          </Card>
        ))}
      </div>

      {errorMessage && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Không thể cập nhật phân quyền</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Ma trận Phân quyền (Permission Matrix)</CardTitle>
            <CardDescription>
              Thay đổi có hiệu lực ngay lập tức ở server và được ghi nhận vào AuditLog. Các quyền
              quản trị cốt lõi của ADMIN được khóa bảo vệ.
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm mã quyền hoặc mô tả..."
              className="pl-9"
              aria-label="Tìm kiếm permission"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[280px]">Permission</TableHead>
                  <TableHead className="min-w-[140px]">Phân hệ</TableHead>
                  {roles.map((role) => (
                    <TableHead key={role.id} className="w-32 text-center">
                      {role.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPermissions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={2 + roles.length}
                      className="h-24 text-center text-sm text-muted-foreground"
                    >
                      Không tìm thấy Permission nào khớp với từ khóa &ldquo;{searchTerm}&rdquo;.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPermissions.map((perm) => (
                    <TableRow key={perm.id}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-900">
                              {perm.code}
                            </code>
                            <span className="text-xs font-medium text-slate-700">{perm.name}</span>
                          </div>
                          {perm.description && (
                            <p className="text-xs text-muted-foreground">{perm.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getCategoryLabel(perm.code)}</Badge>
                      </TableCell>
                      {roles.map((role) => {
                        const granted = role.permissionCodes.includes(perm.code);
                        const isCoreLocked =
                          role.name === ROLES.ADMIN &&
                          initialMatrix.coreAdminPermissions.includes(perm.code);
                        const cellKey = `${role.id}:${perm.id}`;
                        const isPending = pendingCellKey === cellKey;

                        return (
                          <TableCell key={cellKey} className="text-center">
                            <button
                              type="button"
                              disabled={isCoreLocked || pendingCellKey !== null}
                              onClick={() =>
                                void handleToggle(role.id, role.name, perm.id, perm.code, granted)
                              }
                              aria-label={`${granted ? "Thu hồi" : "Cấp"} quyền ${perm.code} cho ${role.name}`}
                              aria-pressed={granted}
                              title={
                                isCoreLocked
                                  ? "Quyền quản trị cốt lõi của ADMIN được bảo vệ"
                                  : granted
                                    ? `Đang bật — nhấn để thu hồi ${perm.code} khỏi ${role.name}`
                                    : `Đang tắt — nhấn để cấp ${perm.code} cho ${role.name}`
                              }
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                                isCoreLocked
                                  ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500"
                                  : granted
                                    ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                                    : "border-slate-300 bg-white text-slate-400 hover:border-slate-400 hover:bg-slate-50"
                              }`}
                            >
                              {isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : isCoreLocked ? (
                                <Lock className="h-3.5 w-3.5" />
                              ) : granted ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <span className="h-2 w-2 rounded-full bg-slate-200" />
                              )}
                            </button>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
