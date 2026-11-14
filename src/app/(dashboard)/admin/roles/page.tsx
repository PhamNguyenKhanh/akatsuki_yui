import type { Metadata } from "next";
import { PermissionMatrix } from "@/components/roles/permission-matrix";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { requirePermissionOrRedirect } from "@/modules/authorization/require-auth";
import { getPermissionMatrixService } from "@/modules/roles/role.service";

export const metadata: Metadata = {
  title: "Quản lý Role & Permission",
};

export default async function AdminRolesPage() {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.ROLE_MANAGE);
  const matrix = await getPermissionMatrixService(actor);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Quản lý Role &amp; Permission Matrix
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Xem cấu hình 4 Role và 25 Permission của hệ thống, cấp hoặc thu hồi quyền theo thời gian
          thực.
        </p>
      </div>

      <PermissionMatrix initialMatrix={matrix} />
    </div>
  );
}
