import type { Metadata } from "next";
import Link from "next/link";
import { UserStatus } from "@prisma/client";
import { ArrowRight, KeyRound, ShieldCheck, UserCheck, Users } from "lucide-react";
import { RoleBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { hasPermission } from "@/modules/authorization/policy.service";
import { requireActiveUserOrRedirect } from "@/modules/authorization/require-auth";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const actor = await requireActiveUserOrRedirect();
  const canReadAccounts = hasPermission(actor, PERMISSIONS.ACCOUNT_READ);

  const accountStats = canReadAccounts
    ? await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { status: UserStatus.PENDING } }),
        prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
        prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
      ])
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Xin chào, {actor.fullName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tổng quan phiên làm việc và quyền truy cập của bạn trong hệ thống Akatsuki Yui.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actor.roles.map((role) => (
            <RoleBadge key={role} role={role} />
          ))}
        </div>
      </div>

      {accountStats && (
        <section
          aria-label="Thống kê tài khoản"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Tổng số tài khoản</CardDescription>
              <CardTitle className="text-2xl">{accountStats[0]}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Đang chờ phê duyệt</CardDescription>
              <CardTitle className="text-2xl text-amber-700">{accountStats[1]}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Đang hoạt động</CardDescription>
              <CardTitle className="text-2xl text-emerald-700">{accountStats[2]}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Đang tạm khóa</CardDescription>
              <CardTitle className="text-2xl text-slate-600">{accountStats[3]}</CardTitle>
            </CardHeader>
          </Card>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-slate-700" />
              <CardTitle className="text-base">Hồ sơ cá nhân &amp; Bảo mật</CardTitle>
            </div>
            <CardDescription>
              Cập nhật họ và tên hoặc thay đổi mật khẩu đăng nhập theo chính sách bảo mật.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-md bg-slate-50 p-3 text-slate-700">
              <p>
                <span className="font-medium">Email:</span> {actor.email}
              </p>
              <p className="mt-1">
                <span className="font-medium">Trạng thái:</span> {actor.status}
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/profile">
                Đi tới Hồ sơ cá nhân
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {canReadAccounts ? (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-slate-700" />
                <CardTitle className="text-base">Quản trị thành viên</CardTitle>
              </div>
              <CardDescription>
                Tìm kiếm, lọc tài khoản, phê duyệt đăng ký PENDING và quản lý trạng thái/vai trò.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Hiện có <strong>{accountStats?.[1] ?? 0}</strong> tài khoản đang chờ phê duyệt.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href="/admin/users">
                    Mở danh sách tài khoản
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                {(accountStats?.[1] ?? 0) > 0 && (
                  <Button asChild variant="outline">
                    <Link href="/admin/users?status=PENDING">Xem tài khoản chờ duyệt</Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-slate-700" />
                <CardTitle className="text-base">Phạm vi Workspace (Sprint 1)</CardTitle>
              </div>
              <CardDescription>
                Nền tảng xác thực và kiểm soát truy cập đã sẵn sàng. Các phân hệ Project và Task sẽ
                được mở khóa ở các Sprint tiếp theo.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-slate-700" />
            <CardTitle className="text-base">
              Quyền hạn đang được cấp ({actor.permissions.length})
            </CardTitle>
          </div>
          <CardDescription>
            Danh sách Permission được truy xuất trực tiếp từ PostgreSQL cho phiên làm việc hiện tại.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {actor.permissions.map((permission) => (
              <code
                key={permission}
                className="rounded-md border border-border bg-slate-50 px-2 py-1 text-xs text-slate-700"
              >
                {permission}
              </code>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
