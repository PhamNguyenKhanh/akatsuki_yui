"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TaskPriority } from "@prisma/client";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { TaskAssignableMemberOption } from "@/components/tasks/task-list-client";
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
import { createTaskAction, updateTaskAction } from "@/modules/tasks/task.actions";
import type { TaskDetailDTO } from "@/modules/tasks/task.repository";
import { createTaskSchema, updateTaskSchema } from "@/modules/tasks/task.schema";

function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

interface TaskFormValues {
  title: string;
  description: string;
  priority: TaskPriority;
  startDate: string;
  deadline: string;
  estimateHours: string;
  referenceLinksText: string;
}

interface TaskFormProps {
  mode: "create" | "edit";
  projectId: string;
  initialTask?: TaskDetailDTO;
  initialValues?: {
    title?: string;
    description?: string;
  };
  assignableMembers?: TaskAssignableMemberOption[];
  canAssignOnCreate?: boolean;
}

export function TaskForm({
  mode,
  projectId,
  initialTask,
  initialValues,
  assignableMembers = [],
  canAssignOnCreate = false,
}: TaskFormProps) {
  const router = useRouter();
  const [selectedAssigneeIds, setSelectedAssigneeIds] = React.useState<string[]>([]);
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<TaskFormValues>({
    defaultValues: {
      title: initialTask?.title ?? initialValues?.title ?? "",
      description: initialTask?.description ?? initialValues?.description ?? "",
      priority: initialTask?.priority ?? TaskPriority.MEDIUM,
      startDate: toDateInputValue(initialTask?.startDate),
      deadline: toDateInputValue(initialTask?.deadline),
      estimateHours:
        initialTask?.estimateHours !== null && initialTask?.estimateHours !== undefined
          ? String(initialTask.estimateHours)
          : "",
      referenceLinksText: initialTask?.referenceLinks.join("\n") ?? "",
    },
  });

  function toggleAssignee(userId: string) {
    setSelectedAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  async function onSubmit(values: TaskFormValues) {
    setFormError(null);

    const referenceLinks = values.referenceLinksText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (values.startDate && values.deadline && values.deadline < values.startDate) {
      setFormError("Deadline phải lớn hơn hoặc bằng ngày bắt đầu.");
      return;
    }

    if (mode === "create") {
      const candidatePayload = {
        title: values.title,
        description: values.description.trim() ? values.description : null,
        priority: values.priority,
        startDate: values.startDate || null,
        deadline: values.deadline,
        estimateHours: values.estimateHours.trim() === "" ? null : values.estimateHours,
        referenceLinks,
        assigneeIds: selectedAssigneeIds,
      };

      const validation = createTaskSchema.safeParse(candidatePayload);
      if (!validation.success) {
        setFormError(validation.error.issues[0]?.message ?? "Dữ liệu tạo Task không hợp lệ.");
        return;
      }

      const result = await createTaskAction(projectId, candidatePayload);
      if (!result.ok) {
        setFormError(result.error.message);
        toast.error(result.error.message);
        return;
      }

      toast.success(`Đã tạo Task ${result.data.code} thành công.`);
      router.push(`/projects/${projectId}/tasks/${result.data.id}`);
      router.refresh();
      return;
    }

    if (!initialTask) return;

    const editPayload = {
      title: values.title,
      description: values.description.trim() ? values.description : null,
      priority: values.priority,
      startDate: values.startDate || null,
      deadline: values.deadline,
      estimateHours: values.estimateHours.trim() === "" ? null : values.estimateHours,
      referenceLinks,
      expectedUpdatedAt:
        typeof initialTask.updatedAt === "string"
          ? initialTask.updatedAt
          : initialTask.updatedAt.toISOString(),
    };

    const validation = updateTaskSchema.safeParse(editPayload);
    if (!validation.success) {
      setFormError(validation.error.issues[0]?.message ?? "Dữ liệu cập nhật Task không hợp lệ.");
      return;
    }

    const result = await updateTaskAction(initialTask.id, editPayload);
    if (!result.ok) {
      setFormError(result.error.message);
      toast.error(result.error.message);
      return;
    }

    toast.success("Đã cập nhật thông tin Task.");
    router.push(`/projects/${projectId}/tasks/${initialTask.id}`);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {mode === "create" ? "Thông tin Task mới" : "Chỉnh sửa thông tin Task"}
        </CardTitle>
        <CardDescription>
          {mode === "create"
            ? "Thiết lập mô tả, độ ưu tiên, thời hạn và thành viên thực hiện ngay từ đầu."
            : "Cập nhật thông tin công việc. Mọi thay đổi sẽ được ghi lại vào Task History."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {formError && (
            <Alert variant="destructive">
              <AlertTitle>Không thể lưu Task</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="task-title">
              Tiêu đề Task <span className="text-red-600">*</span>
            </Label>
            <Input
              id="task-title"
              placeholder="Ví dụ: Xây dựng API Task Review Workflow"
              {...register("title")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-description">Mô tả chi tiết</Label>
            <Textarea
              id="task-description"
              rows={4}
              placeholder="Mô tả yêu cầu kỹ thuật, tiêu chí hoàn thành (Acceptance Criteria)..."
              {...register("description")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Độ ưu tiên</Label>
              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => field.onChange(value as TaskPriority)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn độ ưu tiên" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TaskPriority.LOW}>Low</SelectItem>
                      <SelectItem value={TaskPriority.MEDIUM}>Medium</SelectItem>
                      <SelectItem value={TaskPriority.HIGH}>High</SelectItem>
                      <SelectItem value={TaskPriority.CRITICAL}>Critical</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-startDate">Ngày bắt đầu</Label>
              <Input id="task-startDate" type="date" {...register("startDate")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-deadline">
                Deadline <span className="text-red-600">*</span>
              </Label>
              <Input id="task-deadline" type="date" {...register("deadline")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-estimate">Ước lượng (giờ)</Label>
              <Input
                id="task-estimate"
                type="number"
                step="0.5"
                min="0"
                placeholder="Ví dụ: 8"
                {...register("estimateHours")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-links">
              Liên kết tham chiếu (mỗi dòng 1 URL http/https, tối đa 20)
            </Label>
            <Textarea
              id="task-links"
              rows={3}
              placeholder="https://github.com/org/repo/pull/12&#10;https://figma.com/file/..."
              {...register("referenceLinksText")}
            />
          </div>

          {mode === "create" && canAssignOnCreate && (
            <div className="space-y-2">
              <Label>Phân công thành viên thực hiện (tuỳ chọn)</Label>
              {assignableMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Chưa có thành viên thực thi (Leader/Member) nào trong Project. Bạn có thể giao
                  việc sau khi tạo Task.
                </p>
              ) : (
                <div className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2">
                  {assignableMembers.map((member) => {
                    const checked = selectedAssigneeIds.includes(member.userId);
                    return (
                      <label
                        key={member.userId}
                        className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 text-sm hover:bg-muted/60"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAssignee(member.userId)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span className="font-medium text-slate-900">{member.fullName}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {member.activeTaskCount !== undefined
                            ? `(${member.activeTaskCount} task · ${member.activeEstimateHours ?? 0}h)`
                            : `(${member.email})`}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button asChild type="button" variant="outline">
              <Link
                href={
                  mode === "edit" && initialTask
                    ? `/projects/${projectId}/tasks/${initialTask.id}`
                    : `/projects/${projectId}/tasks`
                }
              >
                <span>Hủy bỏ</span>
              </Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Đang lưu..." : mode === "create" ? "Tạo Task" : "Lưu thay đổi"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
