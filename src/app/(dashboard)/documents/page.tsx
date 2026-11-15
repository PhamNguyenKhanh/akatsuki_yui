import type { Metadata } from "next";
import { DocumentLibraryClient } from "@/components/features/documents/document-library-client";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { requirePermissionOrRedirect } from "@/modules/authorization/require-auth";
import {
  listAccessibleProjectsForDocumentsService,
  listGlobalDocumentsService,
} from "@/modules/documents/document.service";

export const metadata: Metadata = {
  title: "Thư viện Tài liệu",
};

export default async function GlobalDocumentsPage() {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.DOCUMENT_READ);

  const [documentList, accessibleProjects] = await Promise.all([
    listGlobalDocumentsService(actor, { pageSize: 100 }),
    listAccessibleProjectsForDocumentsService(actor),
  ]);

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
      />
    </div>
  );
}
