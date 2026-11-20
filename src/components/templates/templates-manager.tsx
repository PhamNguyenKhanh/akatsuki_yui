"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Power, Trash2, X } from "lucide-react";
import { toast } from "sonner";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  createProjectTemplateAction,
  deleteProjectTemplateAction,
  updateProjectTemplateAction,
} from "@/modules/project-templates/template.actions";
import type { ProjectTemplateDTO } from "@/modules/project-templates/template.repository";

function parseConfigurationText(rawText: string):
  | {
      ok: true;
      value: Record<string, unknown> | null;
    }
  | { ok: false; message: string } {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        ok: false,
        message: 'Cấu hình JSON phải là một JSON Object (ví dụ: {"sprintDurationDays": 14}).',
      };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, message: "Nội dung Cấu hình JSON không hợp lệ." };
  }
}

export function TemplatesManager({ initialTemplates }: { initialTemplates: ProjectTemplateDTO[] }) {
  const router = useRouter();
  const templates = initialTemplates;
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [configurationText, setConfigurationText] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  function resetForm() {
    setEditingId(null);
    setName("");
    setDescription("");
    setConfigurationText("");
    setIsActive(true);
    setErrorMessage(null);
  }

  function startEdit(template: ProjectTemplateDTO) {
    setEditingId(template.id);
    setName(template.name);
    setDescription(template.description ?? "");
    setConfigurationText(
      template.configuration ? JSON.stringify(template.configuration, null, 2) : ""
    );
    setIsActive(template.isActive);
    setErrorMessage(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const parsedConfig = parseConfigurationText(configurationText);
    if (!parsedConfig.ok) {
      setErrorMessage(parsedConfig.message);
      return;
    }

    setSubmitting(true);
    const result = editingId
      ? await updateProjectTemplateAction(editingId, {
          name,
          description: description.trim() || null,
          configuration: parsedConfig.value,
          isActive,
        })
      : await createProjectTemplateAction({
          name,
          description: description.trim() || null,
          configuration: parsedConfig.value,
          isActive,
        });
    setSubmitting(false);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      toast.error(result.error.message);
      return;
    }

    if (editingId) {
      toast.success(`Đã cập nhật Template "${result.data.name}".`);
    } else {
      toast.success(`Đã tạo Template "${result.data.name}".`);
    }

    resetForm();
    router.refresh();
  }

  async function handleToggleActive(template: ProjectTemplateDTO) {
    setBusyId(template.id);
    setErrorMessage(null);

    const result = await updateProjectTemplateAction(template.id, {
      isActive: !template.isActive,
    });
    setBusyId(null);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      toast.error(result.error.message);
      return;
    }

    toast.success(
      result.data.isActive
        ? `Đã kích hoạt Template "${result.data.name}".`
        : `Đã tạm ngưng Template "${result.data.name}".`
    );
    router.refresh();
  }

  async function handleDelete(template: ProjectTemplateDTO) {
    setBusyId(template.id);
    setErrorMessage(null);

    const result = await deleteProjectTemplateAction(template.id);
    setBusyId(null);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      toast.error(result.error.message);
      return;
    }

    if (editingId === template.id) {
      resetForm();
    }
    toast.success(`Đã xóa Template "${template.name}".`);
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Card className="lg:col-span-4">
        <CardHeader>
          <CardTitle className="text-lg">
            {editingId ? "Cập nhật Template" : "Tạo Project Template"}
          </CardTitle>
          <CardDescription>
            Template là tùy chọn dùng chung toàn Workspace giúp gợi ý thông tin cấu hình khi khởi
            tạo Project mới.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <Alert variant="destructive">
                <AlertTitle>Thao tác không hợp lệ</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="template-name">Tên Template *</Label>
              <Input
                id="template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Đồ án Web Full-stack"
                required
                maxLength={150}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="template-description">Mô tả</Label>
              <Textarea
                id="template-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả mục đích, quy chuẩn tài liệu hoặc gợi ý sử dụng..."
                rows={3}
                maxLength={2000}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="template-config">Cấu hình gợi ý (JSON Object, tùy chọn)</Label>
              <Textarea
                id="template-config"
                value={configurationText}
                onChange={(e) => setConfigurationText(e.target.value)}
                placeholder='{"defaultTechnologies": ["Next.js", "PostgreSQL"], "sprintLengthDays": 14}'
                rows={4}
                className="font-mono text-xs"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span>Hiển thị để chọn khi tạo Project (Active)</span>
            </label>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editingId ? (
                  <Pencil className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                <span>{editingId ? "Lưu thay đổi" : "Tạo Template"}</span>
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm} disabled={submitting}>
                  <X className="h-4 w-4" />
                  <span>Hủy</span>
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="lg:col-span-8">
        <CardHeader>
          <CardTitle className="text-lg">Danh sách Template ({templates.length})</CardTitle>
          <CardDescription>
            Template đang được liên kết với Project không thể xóa cứng mà cần tạm ngưng (Deactivate)
            để bảo toàn tham chiếu lịch sử.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên &amp; Mô tả</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-center">Số Project</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-28 text-center text-sm text-muted-foreground">
                    Chưa có Project Template nào. Bạn có thể tạo Template mới ở biểu mẫu bên cạnh
                    hoặc bỏ qua bước này khi tạo Project (Template là tùy chọn).
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((template) => {
                  const isBusy = busyId === template.id;
                  return (
                    <TableRow key={template.id}>
                      <TableCell className="max-w-md align-top">
                        <p className="font-medium text-slate-900">{template.name}</p>
                        {template.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {template.description}
                          </p>
                        )}
                        {template.configuration && (
                          <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2 text-[11px] text-slate-600">
                            {JSON.stringify(template.configuration)}
                          </pre>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant={template.isActive ? "success" : "secondary"}>
                          {template.isActive ? "Đang hoạt động" : "Tạm ngưng"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center align-top font-medium">
                        {template.projectCount}
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => startEdit(template)}
                            disabled={isBusy}
                            title="Chỉnh sửa Template"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Sửa</span>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleToggleActive(template)}
                            disabled={isBusy}
                            title={template.isActive ? "Tạm ngưng Template" : "Kích hoạt lại"}
                          >
                            <Power className="h-3.5 w-3.5" />
                            <span>{template.isActive ? "Tạm ngưng" : "Kích hoạt"}</span>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={isBusy || template.projectCount > 0}
                                title={
                                  template.projectCount > 0
                                    ? "Template đang được sử dụng bởi Project nên không thể xóa"
                                    : "Xóa Template"
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Xác nhận xóa Template</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Bạn có chắc muốn xóa vĩnh viễn Template &ldquo;{template.name}
                                  &rdquo;? Hành động này được ghi nhận vào AuditLog.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                <AlertDialogAction onClick={() => void handleDelete(template)}>
                                  Xác nhận xóa
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
