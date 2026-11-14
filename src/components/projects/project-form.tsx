"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectTemplateDTO } from "@/modules/project-templates/template.repository";
import { createProjectAction, updateProjectAction } from "@/modules/projects/project.actions";
import type { ProjectDTO, SelectableUserOptionDTO } from "@/modules/projects/project.repository";

const NONE_VALUE = "__NONE__";

function toDateInputValue(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return date.toISOString().slice(0, 10);
}

export function ProjectForm({
  mode,
  initialProject,
  templates,
  userOptions,
  currentUserId,
  isAdminCreator,
}: {
  mode: "create" | "edit";
  initialProject?: ProjectDTO;
  templates: ProjectTemplateDTO[];
  userOptions: SelectableUserOptionDTO[];
  currentUserId: string;
  isAdminCreator: boolean;
}) {
  const router = useRouter();

  const today = React.useMemo(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }, []);
  const defaultEnd = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  }, []);

  const [name, setName] = React.useState(initialProject?.name ?? "");
  const [description, setDescription] = React.useState(initialProject?.description ?? "");
  const [objectives, setObjectives] = React.useState(initialProject?.objectives ?? "");
  const [scope, setScope] = React.useState(initialProject?.scope ?? "");
  const [startDate, setStartDate] = React.useState(
    initialProject ? toDateInputValue(initialProject.startDate) : today
  );
  const [endDate, setEndDate] = React.useState(
    initialProject ? toDateInputValue(initialProject.endDate) : defaultEnd
  );
  const [repositoryUrl, setRepositoryUrl] = React.useState(initialProject?.repositoryUrl ?? "");
  const [technologiesText, setTechnologiesText] = React.useState(
    initialProject ? initialProject.technologies.join(", ") : ""
  );
  const [templateId, setTemplateId] = React.useState<string>(
    initialProject?.templateId ?? NONE_VALUE
  );
  const [leaderId, setLeaderId] = React.useState<string>(initialProject?.leaderId ?? currentUserId);
  const [instructorId, setInstructorId] = React.useState<string>(
    initialProject?.instructorId ?? NONE_VALUE
  );
  const [selectedMemberIds, setSelectedMemberIds] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const mergedTemplates = React.useMemo(() => {
    if (
      initialProject?.template &&
      !templates.some((tpl) => tpl.id === initialProject.template?.id)
    ) {
      return [
        {
          id: initialProject.template.id,
          name: `${initialProject.template.name} (Đã tạm ngưng)`,
          description: null,
          configuration: null,
          isActive: initialProject.template.isActive,
          projectCount: 0,
          createdAt: "",
          updatedAt: "",
        },
        ...templates,
      ];
    }
    return templates;
  }, [initialProject, templates]);

  const selectedTemplate = React.useMemo(
    () => mergedTemplates.find((tpl) => tpl.id === templateId) ?? null,
    [mergedTemplates, templateId]
  );

  function handleTemplateChange(nextTemplateId: string) {
    setTemplateId(nextTemplateId);
    if (mode !== "create" || nextTemplateId === NONE_VALUE) return;

    const chosen = mergedTemplates.find((tpl) => tpl.id === nextTemplateId);
    if (!chosen) return;

    const cfg = chosen.configuration;
    if (cfg) {
      const defaultTechs = cfg.defaultTechnologies;
      if (!technologiesText.trim() && Array.isArray(defaultTechs)) {
        const stringItems = defaultTechs.filter((item): item is string => typeof item === "string");
        if (stringItems.length > 0) {
          setTechnologiesText(stringItems.join(", "));
        }
      }
      if (!scope.trim() && typeof cfg.defaultScope === "string") {
        setScope(cfg.defaultScope);
      }
      if (!objectives.trim() && typeof cfg.defaultObjectives === "string") {
        setObjectives(cfg.defaultObjectives);
      }
    }
  }

  function toggleInitialMember(userId: string) {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  const instructorOptions = React.useMemo(() => {
    const prioritized = userOptions.filter((u) => u.roles.includes("INSTRUCTOR"));
    return prioritized.length > 0 ? prioritized : userOptions;
  }, [userOptions]);

  const leaderOptions = React.useMemo(() => {
    const prioritized = userOptions.filter(
      (u) => u.roles.includes("LEADER") || u.roles.includes("ADMIN")
    );
    return prioritized.length > 0 ? prioritized : userOptions;
  }, [userOptions]);

  const currentLeaderUser = userOptions.find((u) => u.id === leaderId);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (endDate < startDate) {
      setErrorMessage("Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.");
      return;
    }

    const technologies = technologiesText
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    setSubmitting(true);

    if (mode === "create") {
      const result = await createProjectAction({
        name,
        description: description.trim() || null,
        objectives: objectives.trim() || null,
        scope: scope.trim() || null,
        startDate,
        endDate,
        repositoryUrl: repositoryUrl.trim() || null,
        technologies,
        templateId: templateId === NONE_VALUE ? null : templateId,
        leaderId: isAdminCreator ? leaderId : null,
        instructorId: instructorId === NONE_VALUE ? null : instructorId,
        memberIds: selectedMemberIds,
      });

      setSubmitting(false);
      if (!result.ok) {
        setErrorMessage(result.error.message);
        toast.error(result.error.message);
        return;
      }

      toast.success(`Đã tạo Project "${result.data.name}" thành công.`);
      router.push(`/projects/${result.data.id}`);
      router.refresh();
      return;
    }

    if (!initialProject) return;

    const result = await updateProjectAction(initialProject.id, {
      name,
      description: description.trim() || null,
      objectives: objectives.trim() || null,
      scope: scope.trim() || null,
      startDate,
      endDate,
      repositoryUrl: repositoryUrl.trim() || null,
      technologies,
      templateId: templateId === NONE_VALUE ? null : templateId,
      instructorId: instructorId === NONE_VALUE ? null : instructorId,
    });

    setSubmitting(false);
    if (!result.ok) {
      setErrorMessage(result.error.message);
      toast.error(result.error.message);
      return;
    }

    toast.success(`Đã lưu cập nhật Project "${result.data.name}".`);
    router.push(`/projects/${result.data.id}`);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {mode === "create" ? "Thông tin khởi tạo Project" : "Chỉnh sửa thông tin Project"}
        </CardTitle>
        <CardDescription>
          {mode === "create"
            ? "Project mới được tạo ở trạng thái CREATED. Template và Giảng viên hướng dẫn là thông tin tùy chọn (DEC-001, DEC-002)."
            : "Cập nhật thông tin tổng quan, thời gian, công nghệ và Giảng viên hướng dẫn."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {errorMessage && (
            <Alert variant="destructive">
              <AlertTitle>Không thể lưu Project</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="project-name">Tên Project *</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Đồ án tốt nghiệp — Hệ thống Akatsuki Yui"
                required
                maxLength={200}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="project-template">Project Template (Tùy chọn)</Label>
              <Select value={templateId} onValueChange={handleTemplateChange}>
                <SelectTrigger id="project-template">
                  <SelectValue placeholder="Không sử dụng Template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Không sử dụng Template (Tự cấu hình)</SelectItem>
                  {mergedTemplates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTemplate?.configuration && (
                <p className="text-xs text-muted-foreground">
                  Cấu hình mẫu:{" "}
                  <code className="rounded bg-slate-100 px-1 py-0.5">
                    {JSON.stringify(selectedTemplate.configuration)}
                  </code>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="project-repo">Repository URL</Label>
              <Input
                id="project-repo"
                type="url"
                value={repositoryUrl}
                onChange={(e) => setRepositoryUrl(e.target.value)}
                placeholder="https://github.com/org/repository"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="project-start-date">Ngày bắt đầu *</Label>
              <Input
                id="project-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="project-end-date">Ngày kết thúc *</Label>
              <Input
                id="project-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>

            {mode === "create" && (
              <div className="space-y-1.5">
                <Label htmlFor="project-leader">Project Leader *</Label>
                {isAdminCreator ? (
                  <Select value={leaderId} onValueChange={setLeaderId}>
                    <SelectTrigger id="project-leader">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {leaderOptions.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.fullName} ({user.roles.join(", ")})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex h-9 items-center rounded-md border border-input bg-slate-50 px-3 text-sm text-slate-700">
                    {currentLeaderUser
                      ? `${currentLeaderUser.fullName} (Tự động theo BR-PROJ-003)`
                      : "Bạn sẽ tự động trở thành Project Leader (BR-PROJ-003)"}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="project-instructor">Giảng viên hướng dẫn (Tùy chọn)</Label>
              <Select value={instructorId} onValueChange={setInstructorId}>
                <SelectTrigger id="project-instructor">
                  <SelectValue placeholder="Chưa chỉ định" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Không chỉ định Instructor (Tùy chọn)</SelectItem>
                  {instructorOptions.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.fullName} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="project-technologies">
                Công nghệ sử dụng (phân cách bằng dấu phẩy)
              </Label>
              <Input
                id="project-technologies"
                value={technologiesText}
                onChange={(e) => setTechnologiesText(e.target.value)}
                placeholder="Ví dụ: Next.js, TypeScript, Prisma, PostgreSQL, Tailwind CSS"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="project-description">Mô tả tổng quan</Label>
              <Textarea
                id="project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tóm tắt bài toán, bối cảnh môn học hoặc đồ án..."
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="project-objectives">Mục tiêu (Objectives)</Label>
              <Textarea
                id="project-objectives"
                value={objectives}
                onChange={(e) => setObjectives(e.target.value)}
                placeholder="Các mục tiêu chính cần đạt được..."
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="project-scope">Phạm vi (Scope)</Label>
              <Textarea
                id="project-scope"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                placeholder="Phạm vi chức năng và giới hạn đề tài..."
                rows={3}
              />
            </div>
          </div>

          {mode === "create" && userOptions.length > 0 && (
            <div className="space-y-2 rounded-md border border-border p-4">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Thêm thành viên ban đầu (Tùy chọn)
                </p>
                <p className="text-xs text-muted-foreground">
                  Chỉ các tài khoản ACTIVE mới được hiển thị. Bạn vẫn có thể thêm/gỡ thành viên sau
                  trong trang chi tiết Project.
                </p>
              </div>
              <div className="grid max-h-48 gap-2 overflow-y-auto pt-1 sm:grid-cols-2 lg:grid-cols-3">
                {userOptions
                  .filter((u) => u.id !== leaderId && u.id !== instructorId)
                  .map((user) => (
                    <label
                      key={user.id}
                      className="flex cursor-pointer items-center gap-2 rounded border border-border px-3 py-2 text-xs hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMemberIds.includes(user.id)}
                        onChange={() => toggleInitialMember(user.id)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span className="truncate">
                        <strong className="font-medium text-slate-900">{user.fullName}</strong>
                        <span className="block text-[11px] text-muted-foreground">
                          {user.roles.join(", ")} · {user.email}
                        </span>
                      </span>
                    </label>
                  ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button asChild type="button" variant="outline" disabled={submitting}>
              <Link href={initialProject ? `/projects/${initialProject.id}` : "/projects"}>
                Hủy
              </Link>
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{mode === "create" ? "Khởi tạo Project" : "Lưu thay đổi"}</span>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
