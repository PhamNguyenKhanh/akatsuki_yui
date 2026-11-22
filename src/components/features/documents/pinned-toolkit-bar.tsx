import Link from "next/link";
import {
  Code2,
  ExternalLink,
  FileText,
  FolderGit2,
  Globe,
  HardDrive,
  LayoutGrid,
  NotebookPen,
  Palette,
  PenTool,
  Pin,
  Rocket,
  Webhook,
  Wrench,
} from "lucide-react";
import { detectDocumentBrand, type DocumentBrandKey } from "@/lib/document-brand";
import { cn } from "@/lib/utils";
import type { DocumentDTO } from "@/modules/documents/document.types";

function BrandIcon({ brandKey, className }: { brandKey: DocumentBrandKey; className?: string }) {
  switch (brandKey) {
    case "google-drive":
      return <HardDrive className={className} />;
    case "google-docs":
      return <FileText className={className} />;
    case "figma":
      return <PenTool className={className} />;
    case "github":
      return <FolderGit2 className={className} />;
    case "postman":
      return <Webhook className={className} />;
    case "notion":
      return <NotebookPen className={className} />;
    case "canva":
      return <Palette className={className} />;
    case "vercel":
      return <Rocket className={className} />;
    case "miro":
    case "trello":
      return <LayoutGrid className={className} />;
    case "swagger":
      return <Code2 className={className} />;
    default:
      return <Globe className={className} />;
  }
}

export function PinnedToolkitBar({
  projectId,
  pinnedDocuments,
  showManageLink = true,
}: {
  projectId: string;
  pinnedDocuments: readonly DocumentDTO[];
  showManageLink?: boolean;
}) {
  if (pinnedDocuments.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card/80 p-3 shadow-xs">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-foreground uppercase">
          <Wrench className="h-3.5 w-3.5 text-primary" />
          <span>Đồ nghề dự án ({pinnedDocuments.length})</span>
        </div>
        {showManageLink && (
          <Link
            href={`/projects/${projectId}/documents`}
            className="text-xs font-medium text-primary hover:underline"
          >
            Quản lý kho đồ nghề →
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {pinnedDocuments.map((doc) => {
          const brand = detectDocumentBrand(doc.url);
          if (!doc.url) return null;

          return (
            <a
              key={doc.id}
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`${brand.label}: ${doc.title}${doc.description ? ` — ${doc.description}` : ""}`}
              className={cn(
                "inline-flex max-w-[260px] items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition hover:opacity-85",
                brand.badgeClassName
              )}
            >
              <Pin className="h-3 w-3 shrink-0 opacity-70" />
              <BrandIcon brandKey={brand.key} className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{doc.title}</span>
              <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
            </a>
          );
        })}
      </div>
    </div>
  );
}
