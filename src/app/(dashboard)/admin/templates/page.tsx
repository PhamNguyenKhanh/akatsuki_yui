import type { Metadata } from "next";
import { TemplatesManager } from "@/components/templates/templates-manager";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { requireAnyPermissionOrRedirect } from "@/modules/authorization/require-auth";
import { listProjectTemplatesService } from "@/modules/project-templates/template.service";

export const metadata: Metadata = {
  title: "Quản lý Project Templates",
};

export default async function AdminTemplatesPage() {
  const actor = await requireAnyPermissionOrRedirect([
    PERMISSIONS.PROJECT_CREATE,
    PERMISSIONS.ROLE_MANAGE,
  ]);
  const result = await listProjectTemplatesService(actor, { page: 1, pageSize: 100 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Quản lý Project Templates
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Thiết lập các mẫu thông tin dùng chung toàn Workspace (tùy chọn khi tạo Project).
        </p>
      </div>

      <TemplatesManager initialTemplates={result.items} />
    </div>
  );
}
