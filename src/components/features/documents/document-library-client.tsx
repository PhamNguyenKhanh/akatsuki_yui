"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { DocumentCategory, ProjectStatus } from "@prisma/client";
import { toast } from "sonner";
import { UrlPaginationControls } from "@/components/shared/url-pagination-controls";
import { sanitizeGoogleDriveReadUrl } from "@/lib/safe-url";
import { buildUpdatedQueryUrl } from "@/lib/search-params";
import { usePropSyncedState } from "@/lib/use-prop-synced-state";
import {
  Archive,
  ExternalLink,
  FileText,
  FolderKanban,
  Layers,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  createDocumentAction,
  deleteDocumentAction,
  updateDocumentAction,
} from "@/modules/documents/document.actions";
import type {
  AccessibleProjectOptionDTO,
  DocumentDTO,
  DocumentSprintSummaryDTO,
} from "@/modules/documents/document.types";
import { validateGoogleDriveUrl } from "@/modules/documents/document.validation";

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  SPECIFICATION: "Đặc tả (Specification)",
  DESIGN: "Thiết kế (Design)",
  REPORT: "Báo cáo (Report)",
  OTHER: "Khác (Other)",
};

function getCategoryBadgeVariant(
  category: DocumentCategory
): "default" | "secondary" | "outline" | "destructive" {
  switch (category) {
    case DocumentCategory.SPECIFICATION:
      return "default";
    case DocumentCategory.DESIGN:
      return "secondary";
    case DocumentCategory.REPORT:
      return "outline";
    default:
      return "outline";
  }
}

function formatDateTime(isoString: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoString));
}

interface DocumentLibraryClientProps {
  mode: "global" | "project";
  initialDocuments: DocumentDTO[];
  fixedProject?: {
    id: string;
    name: string;
    status: ProjectStatus;
    canManageDocuments: boolean;
    sprints: DocumentSprintSummaryDTO[];
  };
  accessibleProjects?: AccessibleProjectOptionDTO[];
  initialPagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  initialFilters?: {
    search?: string;
    category?: string;
    projectId?: string;
    sprintId?: string;
  };
}

export function DocumentLibraryClient({
  mode,
  initialDocuments,
  fixedProject,
  accessibleProjects = [],
  initialPagination,
  initialFilters,
}: DocumentLibraryClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, startTransition] = React.useTransition();
  const [documents, setDocuments] = usePropSyncedState<DocumentDTO[]>(initialDocuments);

  // Filter states
  const [searchTerm, setSearchTerm] = React.useState(initialFilters?.search ?? "");
  const [categoryFilter, setCategoryFilter] = usePropSyncedState<string>(
    initialFilters?.category ?? "ALL"
  );
  const [projectFilter, setProjectFilter] = usePropSyncedState<string>(
    fixedProject ? fixedProject.id : (initialFilters?.projectId ?? "ALL")
  );
  const [sprintFilter, setSprintFilter] = usePropSyncedState<string>(
    initialFilters?.sprintId ?? "ALL"
  );

  const navigateWithQuery = React.useCallback(
    (overrides?: {
      page?: number;
      search?: string;
      category?: string;
      projectId?: string;
      sprintId?: string;
    }) => {
      const nextPage = overrides?.page ?? 1;
      const nextSearch = (overrides?.search ?? searchTerm).trim();
      const nextCategory = overrides?.category ?? categoryFilter;
      const nextProjectId = overrides?.projectId ?? projectFilter;
      const nextSprintId = overrides?.sprintId ?? sprintFilter;

      const targetUrl = buildUpdatedQueryUrl(pathname, {
        page: nextPage > 1 ? nextPage : undefined,
        search: nextSearch || undefined,
        category: nextCategory !== "ALL" ? nextCategory : undefined,
        projectId: mode === "global" && nextProjectId !== "ALL" ? nextProjectId : undefined,
        sprintId: nextSprintId !== "ALL" ? nextSprintId : undefined,
      });

      startTransition(() => {
        router.push(targetUrl);
      });
    },
    [pathname, router, mode, searchTerm, categoryFilter, projectFilter, sprintFilter]
  );

  React.useEffect(() => {
    if (!initialFilters) return;
    const trimmedCurrent = searchTerm.trim();
    const trimmedInitial = (initialFilters.search ?? "").trim();
    if (trimmedCurrent === trimmedInitial) return;

    const timer = window.setTimeout(() => {
      navigateWithQuery({ page: 1, search: trimmedCurrent });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [searchTerm, initialFilters, navigateWithQuery]);

  // Create / Edit Dialog state
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingDoc, setEditingDoc] = React.useState<DocumentDTO | null>(null);
  const [formProjectId, setFormProjectId] = React.useState<string>(
    fixedProject?.id ?? accessibleProjects.find((p) => p.canManageDocuments)?.id ?? ""
  );
  const [formTitle, setFormTitle] = React.useState("");
  const [formUrl, setFormUrl] = React.useState("");
  const [formCategory, setFormCategory] = React.useState<DocumentCategory>(
    DocumentCategory.SPECIFICATION
  );
  const [formSprintId, setFormSprintId] = React.useState<string>("NONE");
  const [formDescription, setFormDescription] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Delete AlertDialog state
  const [deletingDoc, setDeletingDoc] = React.useState<DocumentDTO | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const manageableProjects = React.useMemo(
    () => accessibleProjects.filter((p) => p.canManageDocuments),
    [accessibleProjects]
  );

  const canCreateAny =
    mode === "project" ? Boolean(fixedProject?.canManageDocuments) : manageableProjects.length > 0;

  const canManageDocumentRow = React.useCallback(
    (doc: DocumentDTO): boolean => {
      if (mode === "project" && fixedProject) {
        return fixedProject.canManageDocuments;
      }
      const proj = accessibleProjects.find((p) => p.id === doc.projectId);
      return Boolean(proj?.canManageDocuments);
    },
    [mode, fixedProject, accessibleProjects]
  );

  const availableSprintsForFilter = React.useMemo(() => {
    if (mode === "project" && fixedProject) {
      return fixedProject.sprints;
    }
    if (projectFilter !== "ALL") {
      return accessibleProjects.find((p) => p.id === projectFilter)?.sprints ?? [];
    }
    return [];
  }, [mode, fixedProject, projectFilter, accessibleProjects]);

  const availableSprintsForForm = React.useMemo(() => {
    if (mode === "project" && fixedProject) {
      return fixedProject.sprints;
    }
    const targetProjectId = editingDoc ? editingDoc.projectId : formProjectId;
    return accessibleProjects.find((p) => p.id === targetProjectId)?.sprints ?? [];
  }, [mode, fixedProject, editingDoc, formProjectId, accessibleProjects]);

  const filteredDocuments = React.useMemo(() => {
    return documents.filter((doc) => {
      if (mode === "global" && projectFilter !== "ALL" && doc.projectId !== projectFilter) {
        return false;
      }
      if (categoryFilter !== "ALL" && doc.category !== categoryFilter) {
        return false;
      }
      if (sprintFilter === "NONE" && doc.sprintId !== null) {
        return false;
      }
      if (sprintFilter !== "ALL" && sprintFilter !== "NONE" && doc.sprintId !== sprintFilter) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const matchTitle = doc.title.toLowerCase().includes(q);
        const matchDesc = doc.description?.toLowerCase().includes(q) ?? false;
        const matchUrl = (doc.url ?? "").toLowerCase().includes(q);
        const matchProject = doc.project.name.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchUrl && !matchProject) {
          return false;
        }
      }
      return true;
    });
  }, [documents, mode, projectFilter, categoryFilter, sprintFilter, searchTerm]);

  function openCreateDialog() {
    setEditingDoc(null);
    const defaultProjId =
      fixedProject?.id ??
      (projectFilter !== "ALL" && manageableProjects.some((p) => p.id === projectFilter)
        ? projectFilter
        : (manageableProjects[0]?.id ?? ""));
    setFormProjectId(defaultProjId);
    setFormTitle("");
    setFormUrl("");
    setFormCategory(DocumentCategory.SPECIFICATION);
    setFormSprintId("NONE");
    setFormDescription("");
    setFormError(null);
    setDialogOpen(true);
  }

  function openEditDialog(doc: DocumentDTO) {
    setEditingDoc(doc);
    setFormProjectId(doc.projectId);
    setFormTitle(doc.title);
    setFormUrl(doc.url ?? "");
    setFormCategory(doc.category);
    setFormSprintId(doc.sprintId ?? "NONE");
    setFormDescription(doc.description ?? "");
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    const urlValidation = validateGoogleDriveUrl(formUrl);
    if (!urlValidation.valid) {
      setFormError(urlValidation.reason ?? "Liên kết Google Drive không hợp lệ.");
      return;
    }

    const targetProjectId = fixedProject ? fixedProject.id : formProjectId;
    if (!targetProjectId) {
      setFormError("Vui lòng chọn Project cho tài liệu.");
      return;
    }

    setSubmitting(true);
    try {
      if (editingDoc) {
        const res = await updateDocumentAction(editingDoc.id, {
          title: formTitle,
          url: formUrl,
          category: formCategory,
          description: formDescription || null,
          sprintId: formSprintId === "NONE" ? null : formSprintId,
        });
        if (!res.ok) {
          setFormError(res.error.message);
          toast.error(res.error.message);
          return;
        }
        setDocuments((prev) => prev.map((d) => (d.id === res.data.id ? res.data : d)));
        toast.success(`Đã cập nhật tài liệu "${res.data.title}".`);
      } else {
        const res = await createDocumentAction(targetProjectId, {
          title: formTitle,
          url: formUrl,
          category: formCategory,
          description: formDescription || null,
          sprintId: formSprintId === "NONE" ? null : formSprintId,
        });
        if (!res.ok) {
          setFormError(res.error.message);
          toast.error(res.error.message);
          return;
        }
        setDocuments((prev) => [res.data, ...prev]);
        toast.success(`Đã thêm tài liệu "${res.data.title}".`);
      }

      setDialogOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingDoc) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      const deletedTitle = deletingDoc.title;
      const res = await deleteDocumentAction(deletingDoc.id);
      if (!res.ok) {
        setDeleteError(res.error.message);
        toast.error(res.error.message);
        return;
      }
      setDocuments((prev) => prev.filter((d) => d.id !== deletingDoc.id));
      setDeletingDoc(null);
      toast.success(`Đã xóa tài liệu "${deletedTitle}".`);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {mode === "project" && fixedProject?.status === ProjectStatus.ARCHIVED && (
        <Alert>
          <Archive className="h-4 w-4" />
          <AlertTitle>Project đang ở trạng thái Lưu trữ (ARCHIVED)</AlertTitle>
          <AlertDescription>
            Thư viện tài liệu của Project này đang ở chế độ chỉ đọc (Read-only). Mọi thao tác thêm,
            cập nhật hoặc xóa tài liệu đã bị khóa theo quy tắc.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-slate-700" />
              <span>
                {mode === "project"
                  ? `Tài liệu Project (${initialPagination?.totalItems ?? filteredDocuments.length})`
                  : `Danh mục Tài liệu (${initialPagination?.totalItems ?? filteredDocuments.length})`}
              </span>
            </CardTitle>
            <CardDescription>
              Lưu trữ và phân loại liên kết tài liệu chính thức trên Google Drive / Google Docs.
            </CardDescription>
          </div>

          {canCreateAny && (
            <Button onClick={openCreateDialog} size="sm">
              <Plus className="h-4 w-4" />
              <span>Thêm tài liệu</span>
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filter Bar */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tiêu đề, mô tả, URL..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    navigateWithQuery({ page: 1, search: e.currentTarget.value });
                  }
                }}
                className="pl-9"
              />
            </div>

            {mode === "global" && (
              <select
                value={projectFilter}
                onChange={(e) => {
                  const nextProj = e.target.value;
                  setProjectFilter(nextProj);
                  setSprintFilter("ALL");
                  if (initialFilters) {
                    navigateWithQuery({ page: 1, projectId: nextProj, sprintId: "ALL" });
                  }
                }}
                aria-label="Lọc theo Project"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="ALL">Tất cả Project ({accessibleProjects.length})</option>
                {accessibleProjects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name} {proj.status === ProjectStatus.ARCHIVED ? "(Archived)" : ""}
                  </option>
                ))}
              </select>
            )}

            <select
              value={categoryFilter}
              onChange={(e) => {
                const nextCategory = e.target.value;
                setCategoryFilter(nextCategory);
                if (initialFilters) {
                  navigateWithQuery({ page: 1, category: nextCategory });
                }
              }}
              aria-label="Lọc theo danh mục"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="ALL">Tất cả danh mục</option>
              {(Object.keys(DOCUMENT_CATEGORY_LABELS) as DocumentCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {DOCUMENT_CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>

            {(mode === "project" || projectFilter !== "ALL") && (
              <select
                value={sprintFilter}
                onChange={(e) => {
                  const nextSprint = e.target.value;
                  setSprintFilter(nextSprint);
                  if (initialFilters) {
                    navigateWithQuery({ page: 1, sprintId: nextSprint });
                  }
                }}
                aria-label="Lọc theo Sprint"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="ALL">Tất cả Sprint</option>
                <option value="NONE">Tài liệu chung (Không gắn Sprint)</option>
                {availableSprintsForFilter.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    Sprint: {sp.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Document Table */}
          {filteredDocuments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium text-slate-900">
                Chưa có tài liệu nào phù hợp
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Hãy thêm liên kết Google Drive hoặc Google Docs để chia sẻ tài liệu với nhóm.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tài liệu</TableHead>
                    {mode === "global" && <TableHead>Project</TableHead>}
                    <TableHead>Danh mục</TableHead>
                    <TableHead>Sprint liên kết</TableHead>
                    <TableHead>Người đăng</TableHead>
                    <TableHead>Cập nhật</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((doc) => {
                    const rowManageable = canManageDocumentRow(doc);
                    const safeDocUrl = sanitizeGoogleDriveReadUrl(doc.url);
                    return (
                      <TableRow key={doc.id}>
                        <TableCell className="max-w-xs space-y-1">
                          {safeDocUrl ? (
                            <a
                              href={safeDocUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex items-center gap-1.5 font-medium text-slate-900 hover:text-primary hover:underline"
                            >
                              <span>{doc.title}</span>
                              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 font-medium text-slate-900">
                              <span>{doc.title}</span>
                              <Badge variant="outline" className="text-[10px]">
                                Liên kết không hợp lệ
                              </Badge>
                            </span>
                          )}
                          {doc.description && (
                            <p className="line-clamp-2 text-xs text-muted-foreground">
                              {doc.description}
                            </p>
                          )}
                        </TableCell>

                        {mode === "global" && (
                          <TableCell>
                            <Link
                              href={`/projects/${doc.projectId}/documents`}
                              className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:underline"
                            >
                              <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{doc.project.name}</span>
                            </Link>
                          </TableCell>
                        )}

                        <TableCell>
                          <Badge variant={getCategoryBadgeVariant(doc.category)}>
                            {DOCUMENT_CATEGORY_LABELS[doc.category]}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-xs text-slate-700">
                          {doc.sprint ? (
                            <Link
                              href={`/projects/${doc.projectId}/sprints/${doc.sprint.id}`}
                              className="inline-flex items-center gap-1 hover:underline"
                            >
                              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{doc.sprint.name}</span>
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">Chung toàn Project</span>
                          )}
                        </TableCell>

                        <TableCell className="text-xs">
                          <div className="font-medium text-slate-900">
                            {doc.uploadedBy.fullName}
                          </div>
                          <div className="text-muted-foreground">{doc.uploadedBy.email}</div>
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(doc.updatedAt)}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {safeDocUrl && (
                              <Button asChild variant="ghost" size="sm">
                                <a
                                  href={safeDocUrl}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  title="Mở trên Google Drive / Docs"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  <span className="sr-only">Mở liên kết</span>
                                </a>
                              </Button>
                            )}

                            {rowManageable && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditDialog(doc)}
                                  title="Chỉnh sửa tài liệu"
                                >
                                  <Pencil className="h-4 w-4" />
                                  <span className="sr-only">Chỉnh sửa</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => {
                                    setDeleteError(null);
                                    setDeletingDoc(doc);
                                  }}
                                  title="Xóa tài liệu"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Xóa</span>
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {initialPagination && (
            <UrlPaginationControls
              page={initialPagination.page}
              pageSize={initialPagination.pageSize}
              totalItems={initialPagination.totalItems}
              totalPages={initialPagination.totalPages}
              itemLabel="tài liệu"
              isLoading={isNavigating}
              onPageChange={(nextPage) => navigateWithQuery({ page: nextPage })}
            />
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Document Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingDoc ? "Cập nhật thông tin tài liệu" : "Thêm tài liệu Google Drive"}
            </DialogTitle>
            <DialogDescription>
              Chỉ chấp nhận liên kết chính thức từ <code>https://drive.google.com</code> hoặc{" "}
              <code>https://docs.google.com</code>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            {mode === "global" && !editingDoc && (
              <div className="space-y-1.5">
                <Label htmlFor="doc-project">Project *</Label>
                <select
                  id="doc-project"
                  value={formProjectId}
                  onChange={(e) => {
                    setFormProjectId(e.target.value);
                    setFormSprintId("NONE");
                  }}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="" disabled>
                    -- Chọn Project --
                  </option>
                  {manageableProjects.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="doc-title">Tiêu đề tài liệu *</Label>
              <Input
                id="doc-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="VD: Đặc tả yêu cầu phần mềm SRS v1.2"
                maxLength={200}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="doc-url">Liên kết Google Drive / Google Docs *</Label>
              <Input
                id="doc-url"
                type="url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://docs.google.com/document/d/..."
                required
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="doc-category">Danh mục *</Label>
                <select
                  id="doc-category"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as DocumentCategory)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {(Object.keys(DOCUMENT_CATEGORY_LABELS) as DocumentCategory[]).map((cat) => (
                    <option key={cat} value={cat}>
                      {DOCUMENT_CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="doc-sprint">Gắn với Sprint (Tùy chọn)</Label>
                <select
                  id="doc-sprint"
                  value={formSprintId}
                  onChange={(e) => setFormSprintId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="NONE">Không gắn Sprint (Tài liệu chung)</option>
                  {availableSprintsForForm.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="doc-description">Mô tả ngắn (Tùy chọn)</Label>
              <Textarea
                id="doc-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Ghi chú phiên bản, nội dung chính hoặc phạm vi áp dụng..."
                rows={3}
                maxLength={2000}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Đang lưu..." : editingDoc ? "Lưu thay đổi" : "Thêm tài liệu"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Soft Delete Confirmation Dialog */}
      <AlertDialog
        open={Boolean(deletingDoc)}
        onOpenChange={(open) => {
          if (!open) setDeletingDoc(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa tài liệu khỏi hệ thống?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn đang xóa bản ghi tài liệu <strong>{deletingDoc?.title}</strong> khỏi thư viện
              Project. Tệp gốc trên Google Drive sẽ <strong>không</strong> bị ảnh hưởng.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <Alert variant="destructive">
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? "Đang xóa..." : "Xác nhận xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
