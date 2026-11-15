import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DocumentLibraryClient } from "@/components/features/documents/document-library-client";
import { isAppError } from "@/lib/errors";
import {
  parsePositivePageParam,
  parseSafeQueryEnum,
  pickSingleSearchParam,
  type RawSearchParams,
} from "@/lib/search-params";
import { uuidSchema } from "@/lib/validations/common";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { requirePermissionOrRedirect } from "@/modules/authorization/require-auth";
import {
  listAccessibleProjectsForDocumentsService,
  listGlobalDocumentsService,
} from "@/modules/documents/document.service";
import { documentCategorySchema } from "@/modules/documents/document.validation";

export const metadata: Metadata = {
  title: "Thư viện Tài liệu",
};

interface GlobalDocumentsPageProps {
  searchParams?: Promise<RawSearchParams>;
}

export default async function GlobalDocumentsPage({
  searchParams,
}: GlobalDocumentsPageProps = {}) {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.DOCUMENT_READ);
  const resolvedSearchParams = (await searchParams) ?? {};

  const page = parsePositivePageParam(resolvedSearchParams.page, 1);
  const search = pickSingleSearchParam(resolvedSearchParams.search)?.slice(0, 200);
  const category = parseSafeQueryEnum(documentCategorySchema, resolvedSearchParams.category);
  const projectId = parseSafeQueryEnum(uuidSchema, resolvedSearchParams.projectId);
  const rawSprint = pickSingleSearchParam(resolvedSearchParams.sprintId);
  const sprintId =
    rawSprint === "NONE"
      ? "NONE"
      : rawSprint && uuidSchema.safeParse(rawSprint).success
        ? rawSprint
        : undefined;

  let documentList;
  let accessibleProjects;
  try {
    [documentList, accessibleProjects] = await Promise.all([
      listGlobalDocumentsService(actor, {
        page,
        pageSize: 20,
        ...(search ? { search } : {}),
        ...(category ? { category } : {}),
        ...(projectId ? { projectId } : {}),
        ...(sprintId ? { sprintId } : {}),
      }),
      listAccessibleProjectsForDocumentsService(actor),
    ]);
  } catch (error) {
    if (isAppError(error)) {
      if (error.code === "FORBIDDEN") redirect("/access-denied?reason=forbidden");
      if (error.code === "NOT_FOUND" || error.code === "VALIDATION_ERROR") notFound();
    }
    throw error;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Thư viện Tài liệu (Document Library)
        </h1>
        <p className="text-sm text-muted-foreground">
          Tra cứu và quản lý toàn bộ tài liệu Google Drive / Google Docs thuộc các Project bạn tham
          gia.
        </p>
      </div>

      <DocumentLibraryClient
        mode="global"
        initialDocuments={documentList.items}
        accessibleProjects={accessibleProjects}
        initialPagination={{
          page: documentList.page,
          pageSize: documentList.pageSize,
          totalItems: documentList.totalItems,
          totalPages: documentList.totalPages,
        }}
        initialFilters={{
          search: search ?? "",
          category: category ?? "ALL",
          projectId: projectId ?? "ALL",
          sprintId: sprintId ?? "ALL",
        }}
      />
    </div>
  );
}
