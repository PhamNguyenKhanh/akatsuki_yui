"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SprintStatus } from "@prisma/client";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createSprintAction, updateSprintAction } from "@/modules/sprints/sprint.actions";
import type { SprintDetailDTO } from "@/modules/sprints/sprint.repository";
import {
  createSprintSchema,
  formatSprintDateYmd,
  updateSprintSchema,
} from "@/modules/sprints/sprint.schema";

function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return formatSprintDateYmd(date);
}

interface SprintFormValues {
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
}

interface SprintFormProps {
  mode: "create" | "edit";
  projectId: string;
  projectName: string;
  initialSprint?: SprintDetailDTO;
}

export function SprintForm({ mode, projectId, projectName, initialSprint }: SprintFormProps) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);

  const isActiveSprint = mode === "edit" && initialSprint?.status === SprintStatus.ACTIVE;
  const isLockedClosedSprint =
    mode === "edit" &&
    initialSprint !== undefined &&
    (initialSprint.status === SprintStatus.COMPLETED ||
      initialSprint.status === SprintStatus.CANCELLED);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SprintFormValues>({
    defaultValues: {
      name: initialSprint?.name ?? "",
      goal: initialSprint?.goal ?? "",
      startDate: toDateInputValue(initialSprint?.startDate),
      endDate: toDateInputValue(initialSprint?.endDate),
    },
  });

  async function onSubmit(values: SprintFormValues) {
    setFormError(null);
    if (isLockedClosedSprint) {
      setFormError("Sprint đã hoàn thành hoặc đã hủy nên không thể chỉnh sửa.");
      return;
    }

    if (mode === "create") {
      const parsed = createSprintSchema.safeParse({
        name: values.name,
        goal: values.goal.trim() ? values.goal : null,
        startDate: values.startDate,
        endDate: values.endDate,
      });
      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? "Dữ liệu Sprint không hợp lệ.");
        return;
      }

      const result = await createSprintAction(projectId, {
        name: values.name.trim(),
        goal: values.goal.trim() ? values.goal.trim() : null,
        startDate: values.startDate,
        endDate: values.endDate,
      });

      if (!result.ok) {
        setFormError(result.error.message);
        toast.error(result.error.message);
        return;
      }

      toast.success(`Đã tạo Sprint "${result.data.sprint.name}".`);
      if (result.data.overlappingSprints.length > 0) {
        const names = result.data.overlappingSprints.map((s) => s.name).join(", ");
        toast.warning(`Lưu ý: Thời gian Sprint trùng với: ${names}.`);
      }

      const overlapParam =
        result.data.overlappingSprints.length > 0
          ? `?overlap=${encodeURIComponent(
              result.data.overlappingSprints.map((s) => s.name).join(", ")
            )}`
          : "";
      router.push(`/projects/${projectId}/sprints/${result.data.sprint.id}${overlapParam}`);
      router.refresh();
      return;
    }

    if (!initialSprint) return;

    const rawUpdatePayload: {
      name: string;
      goal: string | null;
      startDate?: string;
      endDate: string;
      expectedUpdatedAt?: string;
    } = {
      name: values.name.trim(),
      goal: values.goal.trim() ? values.goal.trim() : null,
      endDate: values.endDate,
      expectedUpdatedAt:
        typeof initialSprint.updatedAt === "string"
          ? initialSprint.updatedAt
          : initialSprint.updatedAt.toISOString(),
    };

    if (!isActiveSprint) {
      rawUpdatePayload.startDate = values.startDate;
    }

    const parsedUpdate = updateSprintSchema.safeParse(rawUpdatePayload);
    if (!parsedUpdate.success) {
      setFormError(
        parsedUpdate.error.issues[0]?.message ?? "Dữ liệu cập nhật Sprint không hợp lệ."
      );
      return;
    }

    if (isActiveSprint && values.endDate < toDateInputValue(initialSprint.startDate)) {
      setFormError("Ngày kết thúc Sprint phải lớn hơn hoặc bằng ngày bắt đầu hiện tại.");
      return;
    }

    const result = await updateSprintAction(initialSprint.id, rawUpdatePayload);
    if (!result.ok) {
      setFormError(result.error.message);
      toast.error(result.error.message);
      return;
    }

    toast.success("Đã cập nhật thông tin Sprint.");
    if (result.data.overlappingSprints.length > 0) {
      const names = result.data.overlappingSprints.map((s) => s.name).join(", ");
      toast.warning(`Lưu ý: Thời gian Sprint trùng với: ${names}.`);
    }

    const overlapParam =
      result.data.overlappingSprints.length > 0
        ? `?overlap=${encodeURIComponent(
            result.data.overlappingSprints.map((s) => s.name).join(", ")
          )}`
        : "";
    router.push(`/projects/${projectId}/sprints/${initialSprint.id}${overlapParam}`);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {mode === "create" ? "Thông tin Sprint mới" : "Chỉnh sửa Sprint"}
        </CardTitle>
        <CardDescription>
          Project: <strong>{projectName}</strong> · Thời gian Sprint hỗ trợ trùng lịch có cảnh báo
          giữa nhiều Sprint trong cùng Project.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {formError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Không thể lưu Sprint</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        {isActiveSprint && (
          <Alert className="mb-4 border-sky-200 bg-sky-50 text-sky-900">
            <AlertTitle>Sprint đang ở trạng thái ACTIVE</AlertTitle>
            <AlertDescription>
              Bạn vẫn có thể chỉnh sửa tên, mục tiêu và ngày kết thúc (endDate ≥ startDate), nhưng
              ngày bắt đầu đã được khóa để giữ nguyên baseline theo dõi.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sprint-name">Tên Sprint *</Label>
            <Input
              id="sprint-name"
              placeholder="Ví dụ: Sprint 1 - Core Foundation & Auth"
              disabled={isSubmitting || isLockedClosedSprint}
              {...register("name")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sprint-goal">Mục tiêu Sprint (Goal)</Label>
            <Textarea
              id="sprint-goal"
              rows={4}
              placeholder="Mô tả mục tiêu cần đạt được trong Sprint này..."
              disabled={isSubmitting || isLockedClosedSprint}
              {...register("goal")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sprint-start-date">Ngày bắt đầu *</Label>
              <Input
                id="sprint-start-date"
                type="date"
                disabled={isSubmitting || isActiveSprint || isLockedClosedSprint}
                {...register("startDate")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sprint-end-date">Ngày kết thúc *</Label>
              <Input
                id="sprint-end-date"
                type="date"
                disabled={isSubmitting || isLockedClosedSprint}
                {...register("endDate")}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <Button asChild type="button" variant="outline" disabled={isSubmitting}>
              <Link
                href={
                  mode === "edit" && initialSprint
                    ? `/projects/${projectId}/sprints/${initialSprint.id}`
                    : `/projects/${projectId}/sprints`
                }
              >
                Hủy
              </Link>
            </Button>
            <Button type="submit" disabled={isSubmitting || isLockedClosedSprint}>
              {isSubmitting
                ? "Đang lưu..."
                : mode === "create"
                  ? "Tạo Sprint (PLANNED)"
                  : "Lưu thay đổi"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
