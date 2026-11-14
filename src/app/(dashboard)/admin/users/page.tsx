import type { Metadata } from "next";
import { UsersTable } from "@/components/users/users-table";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { hasPermission } from "@/modules/authorization/policy.service";
import { requirePermissionOrRedirect } from "@/modules/authorization/require-auth";
import { userListQuerySchema } from "@/modules/users/user.schema";
import { listUsersService } from "@/modules/users/user.service";

export const metadata: Metadata = {
  title: "Quản lý tài khoản",
};

type AdminUsersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readSingleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.ACCOUNT_READ);
  const rawSearchParams = await searchParams;

  const candidateQuery = {
    search: readSingleParam(rawSearchParams.search) || undefined,
    status: readSingleParam(rawSearchParams.status) || undefined,
    role: readSingleParam(rawSearchParams.role) || undefined,
    page: readSingleParam(rawSearchParams.page) || undefined,
    pageSize: readSingleParam(rawSearchParams.pageSize) || undefined,
  };

  const parsed = userListQuerySchema.safeParse(candidateQuery);
  const safeQuery = parsed.success ? parsed.data : userListQuerySchema.parse({});
  const result = await listUsersService(actor, safeQuery);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Quản lý tài khoản</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Xem danh sách thành viên, phê duyệt tài khoản chờ xử lý, tạm khóa và phân quyền.
        </p>
      </div>

      <UsersTable
        users={result.items}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        totalPages={result.totalPages}
        filters={{
          search: safeQuery.search ?? "",
          status: safeQuery.status ?? "",
          role: safeQuery.role ?? "",
        }}
        capabilities={{
          canApprove: hasPermission(actor, PERMISSIONS.ACCOUNT_APPROVE),
          canManage: hasPermission(actor, PERMISSIONS.ACCOUNT_MANAGE),
        }}
      />
    </div>
  );
}
