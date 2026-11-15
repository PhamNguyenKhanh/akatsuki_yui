"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  approveTaskReviewAction,
  rejectTaskReviewAction,
  submitTaskForReviewAction,
} from "@/modules/tasks/task.actions";
import type { ApiErrorDetail } from "@/types/api";

export type TaskReviewModalMode = "submit" | "approve" | "reject";

interface TaskReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: TaskReviewModalMode;
  projectId: string;
  taskId: string;
  taskTitle: string;
  taskCode: string;
}

const MODAL_COPY: Record<
  TaskReviewModalMode,
  {
    title: string;
    description: string;
    label: string;
    placeholder: string;
    confirmLabel: string;
    buttonVariant: "default" | "destructive";
  }
> = {
  submit: {
    title: "Gửi Task để Review",
    description:
      "Chuyển trạng thái Task sang REVIEW để Project Leader hoặc Admin kiểm tra kết quả.",
    label: "Ghi chú bàn giao (tuỳ chọn)",
    placeholder: "Tóm tắt nội dung đã hoàn thành, link PR hoặc lưu ý kiểm thử...",
    confirmLabel: "Xác nhận gửi Review",
    buttonVariant: "default",
  },
  approve: {
    title: "Duyệt hoàn thành (Approve)",
    description:
      "Chuyển Task từ REVIEW sang DONE. Mọi Task tiền điều kiện bắt buộc phải đã đạt DONE.",
    label: "Lý do / Nhận xét phê duyệt *",
    placeholder: "Ví dụ: Đã kiểm tra PR và verify unit test đạt yêu cầu.",
    confirmLabel: "Duyệt hoàn thành (DONE)",
    buttonVariant: "default",
  },
  reject: {
    title: "Từ chối Review (Reject)",
    description:
      "Trả Task về trạng thái IN_PROGRESS để thành viên chỉnh sửa theo góp ý của người review.",
    label: "Lý do từ chối / Yêu cầu chỉnh sửa *",
    placeholder: "Ví dụ: Thiếu validation khi nhập Estimate Hours âm...",
    confirmLabel: "Trả về In Progress",
    buttonVariant: "destructive",
  },
};

export function TaskReviewModal({
  open,
  onOpenChange,
  mode,
  projectId,
  taskId,
  taskTitle,
  taskCode,
}: TaskReviewModalProps) {
  const router = useRouter();
  const [textValue, setTextValue] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [blockingDetails, setBlockingDetails] = React.useState<ApiErrorDetail[]>([]);

  const copy = MODAL_COPY[mode];

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setTextValue("");
      setErrorMessage(null);
      setBlockingDetails([]);
    }
    onOpenChange(nextOpen);
  }

  async function handleConfirm() {
    setErrorMessage(null);
    setBlockingDetails([]);

    const trimmed = textValue.trim();
    if ((mode === "approve" || mode === "reject") && trimmed.length === 0) {
      setErrorMessage("Vui lòng nhập lý do trước khi xác nhận duyệt hoặc từ chối Task.");
      return;
    }

    setSubmitting(true);
    const result =
      mode === "submit"
        ? await submitTaskForReviewAction(taskId, { note: trimmed || null })
        : mode === "approve"
          ? await approveTaskReviewAction(taskId, { reason: trimmed })
          : await rejectTaskReviewAction(taskId, { reason: trimmed });
    setSubmitting(false);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      setBlockingDetails(result.error.details ?? []);
      toast.error(result.error.message);
      return;
    }

    toast.success(
      mode === "submit"
        ? `Đã gửi ${taskCode} sang trạng thái REVIEW.`
        : mode === "approve"
          ? `Đã duyệt hoàn thành ${taskCode}.`
          : `Đã trả ${taskCode} về trạng thái IN_PROGRESS.`
    );
    handleOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {copy.title} · <span className="font-mono text-base">{taskCode}</span>
          </DialogTitle>
          <DialogDescription>
            {taskTitle} — {copy.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {errorMessage && (
            <Alert variant="destructive">
              <AlertTitle>Không thể thực hiện</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>{errorMessage}</p>
                {blockingDetails.some((item) => item.taskId) && (
                  <ul className="list-disc space-y-1 pl-4 text-xs">
                    {blockingDetails
                      .filter((item) => item.taskId)
                      .map((item, idx) => (
                        <li key={`${item.taskId}-${idx}`}>
                          <Link
                            href={`/projects/${projectId}/tasks/${item.taskId}`}
                            className="font-medium underline"
                          >
                            {item.message ?? item.taskTitle}
                          </Link>
                        </li>
                      ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="review-modal-textarea">{copy.label}</Label>
            <Textarea
              id="review-modal-textarea"
              rows={4}
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder={copy.placeholder}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => handleOpenChange(false)}
          >
            Hủy
          </Button>
          <Button
            type="button"
            variant={copy.buttonVariant}
            disabled={submitting}
            onClick={handleConfirm}
          >
            {submitting ? "Đang xử lý..." : copy.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
