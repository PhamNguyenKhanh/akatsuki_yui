"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { updateAccountStatusAction } from "@/modules/users/user.actions";
import type { AccountStatusAction } from "@/modules/users/user.schema";
import type { UserStatus } from "@/types/auth";

interface ActionDescriptor {
  action: AccountStatusAction;
  label: string;
  variant: "default" | "outline" | "destructive" | "secondary";
  title: string;
  description: string;
}

const ACTION_CONFIG: Record<AccountStatusAction, Omit<ActionDescriptor, "action">> = {
  APPROVE: {
    label: "Phê duyệt",
    variant: "default",
    title: "Phê duyệt tài khoản?",
    description: "Tài khoản sẽ chuyển sang trạng thái ACTIVE và có thể đăng nhập vào hệ thống.",
  },
  REJECT: {
    label: "Từ chối",
    variant: "destructive",
    title: "Từ chối tài khoản?",
    description: "Tài khoản sẽ chuyển sang trạng thái REJECTED và không thể đăng nhập.",
  },
  SUSPEND: {
    label: "Tạm khóa",
    variant: "destructive",
    title: "Tạm khóa tài khoản?",
    description:
      "Tài khoản sẽ chuyển sang trạng thái SUSPENDED và bị chặn mọi truy cập từ phía Server.",
  },
  ACTIVATE: {
    label: "Kích hoạt",
    variant: "default",
    title: "Kích hoạt lại tài khoản?",
    description: "Tài khoản sẽ được khôi phục về trạng thái ACTIVE.",
  },
};

export function AccountStatusActions({
  userId,
  userEmail,
  currentStatus,
  canApprove,
  canManage,
  compact = false,
  onErrorMessage,
}: {
  userId: string;
  userEmail: string;
  currentStatus: UserStatus;
  canApprove: boolean;
  canManage: boolean;
  compact?: boolean;
  onErrorMessage?: (message: string | null) => void;
}) {
  const router = useRouter();
  const [confirmAction, setConfirmAction] = React.useState<AccountStatusAction | null>(null);
  const [isPending, setIsPending] = React.useState(false);

  const availableActions: AccountStatusAction[] = [];
  if (currentStatus === "PENDING" && canApprove) {
    availableActions.push("APPROVE", "REJECT");
  }
  if (currentStatus === "ACTIVE" && canManage) {
    availableActions.push("SUSPEND");
  }
  if (currentStatus === "SUSPENDED" && canManage) {
    availableActions.push("ACTIVATE");
  }

  if (availableActions.length === 0) {
    return null;
  }

  async function handleConfirm() {
    if (!confirmAction) return;
    setIsPending(true);
    onErrorMessage?.(null);

    const result = await updateAccountStatusAction(userId, confirmAction);
    setIsPending(false);
    setConfirmAction(null);

    if (!result.ok) {
      onErrorMessage?.(result.error.message);
      toast.error(result.error.message);
      return;
    }

    toast.success(`Đã cập nhật trạng thái cho ${userEmail}.`);
    router.refresh();
  }

  const dialogMeta = confirmAction ? ACTION_CONFIG[confirmAction] : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {availableActions.map((actionKey) => {
          const meta = ACTION_CONFIG[actionKey];
          return (
            <Button
              key={actionKey}
              type="button"
              size={compact ? "sm" : "default"}
              variant={meta.variant}
              disabled={isPending}
              onClick={() => setConfirmAction(actionKey)}
            >
              {meta.label}
            </Button>
          );
        })}
      </div>

      <AlertDialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setConfirmAction(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogMeta?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {dialogMeta?.description} ({userEmail})
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
              {isPending ? "Đang xử lý..." : "Xác nhận"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
