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
import { useProjectCandidateSearch } from "@/lib/use-project-candidate-search";
import type { ProjectTemplateDTO } from "@/modules/project-templates/template.repository";
import { createProjectAction, updateProjectAction } from "@/modules/projects/project.actions";
import type { ProjectCandidateUserDTO, ProjectDTO } from "@/modules/projects/project.repository";

const NONE_VALUE = "__NONE__";

function toDateInputValue(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return date.toISOString().slice(0, 10);
}

export function ProjectForm({
  mode,
  initialProject,
  templates,
  instructorOptions: initialInstructorOptions,
  leaderOptions: initialLeaderOptions = [],
  memberOptions: initialMemberOptions = [],
  currentUserId,
  currentUserName,
  isAdminCreator,
}: {
  mode: "create" | "edit";
  initialProject?: ProjectDTO;
  templates: ProjectTemplateDTO[];
  instructorOptions: ProjectCandidateUserDTO[];
  leaderOptions?: ProjectCandidateUserDTO[];
  memberOptions?: ProjectCandidateUserDTO[];
  currentUserId: string;
  currentUserName?: string;
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

  const instructorSearch = useProjectCandidateSearch({
    initialItems: initialInstructorOptions,
    kind: "instructor",
    projectId: initialProject?.id,
  });

  const memberSearch = useProjectCandidateSearch({
    initialItems: initialMemberOptions,
    kind: "member",
    enabled: mode === "create",
  });

  const instructorOptions = React.useMemo(() => {
    if (
      initialProject?.instructor &&
      !instructorSearch.items.some((u) => u.id === initialProject.instructor!.id)
    ) {
      return [
        { id: initialProject.instructor.id, fullName: initialProject.instructor.fullName },
        ...instructorSearch.items,
      ];
    }
    return instructorSearch.items;
  }, [initialProject, instructorSearch.items]);

  const leaderOptions = initialLeaderOptions;
  const currentLeaderUser = leaderOptions.find((u) => u.id === leaderId);

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
            ? "Project mới được tạo ở trạng thái CREATED. Template và Giảng viên hướng dẫn là thông tin tùy chọn."
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
                          {user.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex h-9 items-center rounded-md border border-input bg-slate-50 px-3 text-sm text-slate-700">
                    {currentUserName ?? currentLeaderUser?.fullName
                      ? `${currentUserName ?? currentLeaderUser?.fullName} ()`
                      : "Bạn sẽ tự động trở thành Project Leader"}
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
                      {user.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={instructorSearch.query}
                onChange={(e) => instructorSearch.setQuery(e.target.value)}
                placeholder="Tìm Giảng viên theo họ tên..."
                aria-label="Tìm Giảng viên theo họ tên"
                className="h-8 text-xs"
              />
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

          {mode === "create" &&
            (initialMemberOptions.length > 0 || memberSearch.query.trim().length > 0) && (
              <div className="space-y-3 rounded-md border border-border p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      Thêm thành viên ban đầu (Tùy chọn)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Chỉ hiển thị tối đa 50 ứng viên ACTIVE phù hợp mỗi lần tải. Bạn vẫn có thể
                      thêm/gỡ thành viên sau trong trang chi tiết Project.
                    </p>
                  </div>
                  <Input
                    value={memberSearch.query}
                    onChange={(e) => memberSearch.setQuery(e.target.value)}
                    placeholder="Tìm thành viên theo họ tên..."
                    aria-label="Tìm thành viên theo họ tên"
                    className="h-8 w-full text-xs sm:w-64"
                  />
                </div>
                <div className="grid max-h-48 gap-2 overflow-y-auto pt-1 sm:grid-cols-2 lg:grid-cols-3">
                  {memberSearch.items
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
                        <span className="truncate font-medium text-slate-900">{user.fullName}</span>
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
