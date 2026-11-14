import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AccountStatusBadge, RoleBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserDetailActions } from "@/components/users/user-detail-actions";
import { isAppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { uuidSchema } from "@/lib/validations/common";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { hasPermission } from "@/modules/authorization/policy.service";
import { requirePermissionOrRedirect } from "@/modules/authorization/require-auth";
import { getUserDetailService } from "@/modules/users/user.service";

export const metadata: Metadata = {
  title: "Chi tiết tài khoản",
};

type AdminUserDetailPageProps = {
  params: Promise<{ userId: string }>;
};

export default async function AdminUserDetailPage({ params }: AdminUserDetailPageProps) {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.ACCOUNT_READ);
  const { userId } = await params;

  if (!uuidSchema.safeParse(userId).success) {
    notFound();
  }

  let targetUser;
  try {
    targetUser = await getUserDetailService(actor, userId);
  } catch (error) {
    if (isAppError(error) && error.statusCode === 404) {
      notFound();
    }
    throw error;
  }

  const auditLogs = await prisma.auditLog.findMany({
    where: {
      entityType: "User",
      entityId: targetUser.id,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      action: true,
      oldValue: true,
      newValue: true,
      createdAt: true,
      actor: {
        select: {
          fullName: true,
          email: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/admin/users">
              <ArrowLeft className="h-4 w-4" />
              Quay lại danh sách
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {targetUser.fullName}
          </h1>
          <p className="text-sm text-muted-foreground">{targetUser.email}</p>
        </div>

        <div className="flex items-center gap-2">
          <AccountStatusBadge status={targetUser.status} />
          {targetUser.roles.map((role) => (
            <RoleBadge key={role} role={role} />
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Thông tin chi tiết</CardTitle>
            <CardDescription>Dữ liệu tài khoản được bảo vệ an toàn phía Server.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">User ID</dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-slate-800">
                  {targetUser.id}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Email</dt>
                <dd className="mt-0.5 text-slate-900">{targetUser.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Ngày tạo</dt>
                <dd className="mt-0.5 text-slate-900" suppressHydrationWarning>
                  {formatDateTime(targetUser.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Ngày phê duyệt</dt>
                <dd className="mt-0.5 text-slate-900" suppressHydrationWarning>
                  {formatDateTime(targetUser.approvedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Người phê duyệt</dt>
                <dd className="mt-0.5 text-slate-900">
                  {targetUser.approvedBy
                    ? `${targetUser.approvedBy.fullName} (${targetUser.approvedBy.email})`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Cập nhật gần nhất</dt>
                <dd className="mt-0.5 text-slate-900" suppressHydrationWarning>
                  {formatDateTime(targetUser.updatedAt)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <UserDetailActions
          key={`${targetUser.id}:${targetUser.roles.join(",")}:${targetUser.status}`}
          user={targetUser}
          capabilities={{
            canApprove: hasPermission(actor, PERMISSIONS.ACCOUNT_APPROVE),
            canManage: hasPermission(actor, PERMISSIONS.ACCOUNT_MANAGE),
            canManageRoles: hasPermission(actor, PERMISSIONS.ROLE_MANAGE),
          }}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lịch sử thay đổi (Audit Log)</CardTitle>
          <CardDescription>
            10 thao tác thay đổi trạng thái hoặc phân quyền gần nhất đối với tài khoản này.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có bản ghi Audit Log nào.</p>
          ) : (
            <div className="space-y-3">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col justify-between gap-2 rounded-md border border-border p-3 text-xs sm:flex-row sm:items-center"
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-900">{log.action}</div>
                    <div className="text-muted-foreground">
                      Thực hiện bởi:{" "}
                      {log.actor ? `${log.actor.fullName} (${log.actor.email})` : "System"}
                    </div>
                  </div>
                  <div className="space-y-1 text-left sm:text-right">
                    <div className="font-mono text-[11px] text-slate-700">
                      {JSON.stringify(log.oldValue)} &rarr; {JSON.stringify(log.newValue)}
                    </div>
                    <div className="text-muted-foreground" suppressHydrationWarning>
                      {formatDateTime(log.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
