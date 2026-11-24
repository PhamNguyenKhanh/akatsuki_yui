"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AccountStatusActions } from "@/components/users/account-status-actions";
import { ROLES, type RoleName } from "@/modules/authorization/constants";
import { assignUserRoleAction } from "@/modules/users/user.actions";
import type { SafeUserDTO } from "@/types/auth";

export function UserDetailActions({
  user,
  capabilities,
}: {
  user: SafeUserDTO;
  capabilities: {
    canApprove: boolean;
    canManage: boolean;
    canManageRoles: boolean;
  };
}) {
  const router = useRouter();
  const initialRole = (user.roles[0] as RoleName | undefined) ?? ROLES.MEMBER;
  const [selectedRole, setSelectedRole] = React.useState<RoleName>(initialRole);
  const [roleSaving, setRoleSaving] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  async function handleRoleSave() {
    setRoleSaving(true);
    setErrorMessage(null);

    const result = await assignUserRoleAction(user.id, selectedRole);
    setRoleSaving(false);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      toast.error(result.error.message);
      return;
    }

    toast.success(`Đã cập nhật Role thành ${selectedRole}.`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {errorMessage && (
        <Alert variant="destructive">
          <AlertTitle>Thao tác bị từ chối</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {(capabilities.canApprove || capabilities.canManage) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quản lý trạng thái tài khoản</CardTitle>
            <CardDescription>
              Phê duyệt, từ chối, tạm khóa hoặc kích hoạt lại tài khoản này. Mọi thay đổi đều được
              ghi AuditLog.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AccountStatusActions
              userId={user.id}
              userEmail={user.email}
              currentStatus={user.status}
              canApprove={capabilities.canApprove}
              canManage={capabilities.canManage}
              onErrorMessage={setErrorMessage}
            />
            {user.status === "REJECTED" && (
              <p className="text-xs text-muted-foreground">
                Tài khoản đã ở trạng thái REJECTED không có thao tác chuyển trạng thái khả dụng.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {capabilities.canManageRoles && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gán vai trò (Role)</CardTitle>
            <CardDescription>
              Thay đổi Role sẽ áp dụng ngay từ phía Server ở request tiếp theo. Hệ thống bảo vệ
              Admin hoạt động cuối cùng.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select
              value={selectedRole}
              onValueChange={(value) => setSelectedRole(value as RoleName)}
            >
              <SelectTrigger className="w-full sm:w-[220px]" aria-label="Chọn Role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ROLES.ADMIN}>ADMIN</SelectItem>
                <SelectItem value={ROLES.INSTRUCTOR}>INSTRUCTOR</SelectItem>
                <SelectItem value={ROLES.LEADER}>LEADER</SelectItem>
                <SelectItem value={ROLES.REVIEWER}>REVIEWER</SelectItem>
                <SelectItem value={ROLES.MEMBER}>MEMBER</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              isLoading={roleSaving}
              disabled={selectedRole === user.roles[0]}
              onClick={handleRoleSave}
            >
              Cập nhật vai trò
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
