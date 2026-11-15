import Link from "next/link";
import { ArrowRight, ExternalLink, FileText } from "lucide-react";
import { DOCUMENT_CATEGORY_LABELS } from "@/components/features/documents/document-library-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DocumentDTO } from "@/modules/documents/document.types";

interface ProjectDocumentSummaryCardProps {
  projectId: string;
  documents: DocumentDTO[];
  totalCount: number;
}

export function ProjectDocumentSummaryCard({
  projectId,
  documents,
  totalCount,
}: ProjectDocumentSummaryCardProps) {
  const recentDocs = documents.slice(0, 3);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-700" />
            <CardTitle className="text-base">Thư viện Tài liệu (Google Drive)</CardTitle>
          </div>
          <CardDescription>
            Tài liệu đặc tả, thiết kế và báo cáo liên kết trực tiếp từ Google Drive / Docs.
          </CardDescription>
        </div>

        <Button asChild size="sm">
          <Link href={`/projects/${projectId}/documents`}>
            <span>Thư viện tài liệu ({totalCount})</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>

      <CardContent>
        {recentDocs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Chưa có tài liệu nào được đăng tải trong Project này.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {recentDocs.map((doc) => (
              <a
                key={doc.id}
                href={doc.url}
                target="_blank"
                rel="noreferrer noopener"
                className="block space-y-2 rounded-lg border border-border bg-muted/20 p-3 transition hover:border-slate-400"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="line-clamp-1 font-medium text-slate-900">{doc.title}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="text-xs">
                    {DOCUMENT_CATEGORY_LABELS[doc.category]}
                  </Badge>
                  {doc.sprint && (
                    <span className="text-xs text-muted-foreground">· {doc.sprint.name}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Đăng bởi {doc.uploadedBy.fullName}</p>
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
