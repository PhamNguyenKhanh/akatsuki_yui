import type { Metadata } from "next";
import { ProjectListClient } from "@/components/projects/project-list-client";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { hasPermission } from "@/modules/authorization/policy.service";
import { requirePermissionOrRedirect } from "@/modules/authorization/require-auth";
import { projectListQuerySchema } from "@/modules/projects/project.schema";
import { listProjectsService } from "@/modules/projects/project.service";

export const metadata: Metadata = {
  title: "Quản lý Project",
};

type ProjectsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readSingleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.PROJECT_READ);
  const rawSearchParams = await searchParams;

  const candidateQuery = {
    search: readSingleParam(rawSearchParams.search) || undefined,
    status: readSingleParam(rawSearchParams.status) || undefined,
    page: readSingleParam(rawSearchParams.page) || undefined,
    pageSize: readSingleParam(rawSearchParams.pageSize) || undefined,
  };

  const parsed = projectListQuerySchema.safeParse(candidateQuery);
  const safeQuery = parsed.success ? parsed.data : projectListQuerySchema.parse({});
  const result = await listProjectsService(actor, safeQuery);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Quản lý Project</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Theo dõi danh sách Project trong phạm vi được phân công, vòng đời CREATED / ACTIVE /
          ARCHIVED và thành viên tham gia.
        </p>
      </div>

      <ProjectListClient
        projects={result.items}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        totalPages={result.totalPages}
        filters={{
          search: safeQuery.search ?? "",
          status: safeQuery.status ?? "",
        }}
        canCreate={hasPermission(actor, PERMISSIONS.PROJECT_CREATE)}
        canManageAny={hasPermission(actor, PERMISSIONS.PROJECT_UPDATE)}
      />
    </div>
  );
}
