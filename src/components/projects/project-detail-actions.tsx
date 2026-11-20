"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProjectStatus } from "@prisma/client";
import { Archive, Loader2, Pencil, PlayCircle, RotateCcw } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  activateProjectAction,
  archiveProjectAction,
  restoreProjectAction,
} from "@/modules/projects/project.actions";
import type { ProjectDTO } from "@/modules/projects/project.repository";

export function ProjectDetailActions({
  project,
  capabilities,
}: {
  project: ProjectDTO;
  capabilities: {
    canEdit: boolean;
    canActivate: boolean;
    canArchive: boolean;
    canRestore: boolean;
  };
}) {
  const router = useRouter();
  const [busyAction, setBusyAction] = React.useState<"activate" | "archive" | "restore" | null>(
    null
  );
  const [restoreTarget, setRestoreTarget] = React.useState<"CREATED" | "ACTIVE">("CREATED");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  async function handleActivate() {
    setBusyAction("activate");
    setErrorMessage(null);
    const result = await activateProjectAction(project.id);
    setBusyAction(null);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      toast.error(result.error.message);
      return;
    }

    toast.success(`Đã kích hoạt Project "${result.data.name}" sang trạng thái ACTIVE.`);
    router.refresh();
  }

  async function handleArchive() {
    setBusyAction("archive");
    setErrorMessage(null);
    const result = await archiveProjectAction(project.id);
    setBusyAction(null);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      toast.error(result.error.message);
      return;
    }

    toast.success(`Đã lưu trữ (Archive) Project "${result.data.name}".`);
    router.refresh();
  }

  async function handleRestore() {
    setBusyAction("restore");
    setErrorMessage(null);
    const result = await restoreProjectAction(project.id, { targetStatus: restoreTarget });
    setBusyAction(null);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      toast.error(result.error.message);
      return;
    }

    toast.success(`Đã khôi phục Project "${result.data.name}" về trạng thái ${restoreTarget}.`);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {capabilities.canEdit && project.status !== ProjectStatus.ARCHIVED && (
          <Button asChild variant="outline">
            <Link href={`/projects/${project.id}/edit`}>
              <Pencil className="h-4 w-4" />
              <span>Chỉnh sửa thông tin</span>
            </Link>
          </Button>
        )}

        {capabilities.canActivate && project.status === ProjectStatus.CREATED && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={busyAction !== null}>
                {busyAction === "activate" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4" />
                )}
                <span>Kích hoạt Project</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Kích hoạt Project sang ACTIVE?</AlertDialogTitle>
                <AlertDialogDescription>
                  Workspace chỉ cho phép duy nhất 01 Project ở trạng thái ACTIVE. Nếu
                  đang có Project khác ACTIVE, thao tác này sẽ bị từ chối cho đến khi Project kia
                  được Archive.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Hủy</AlertDialogCancel>
                <AlertDialogAction onClick={() => void handleActivate()}>
                  Xác nhận kích hoạt
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {capabilities.canArchive && project.status !== ProjectStatus.ARCHIVED && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="secondary" disabled={busyAction !== null}>
                {busyAction === "archive" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Archive className="h-4 w-4" />
                )}
                <span>Lưu trữ (Archive)</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Lưu trữ Project &ldquo;{project.name}&rdquo;?</AlertDialogTitle>
                <AlertDialogDescription>
                  Toàn bộ dữ liệu và lịch sử sẽ được giữ nguyên, nhưng sau khi Archive không thể
                  chỉnh sửa thông tin hoặc thêm/xóa thành viên. Chỉ Admin mới có thể
                  khôi phục lại.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Hủy</AlertDialogCancel>
                <AlertDialogAction onClick={() => void handleArchive()}>
                  Xác nhận Archive
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {capabilities.canRestore && project.status === ProjectStatus.ARCHIVED && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={busyAction !== null}>
                {busyAction === "restore" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                <span>Khôi phục (Restore)</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Khôi phục Project đã Archive</AlertDialogTitle>
                <AlertDialogDescription>
                  Chọn trạng thái đích sau khi khôi phục Project &ldquo;{project.name}&rdquo;. Khôi
                  phục sang ACTIVE yêu cầu Workspace hiện chưa có Project ACTIVE nào khác (DEC-008).
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-1.5 py-2">
                <Label htmlFor="restore-target-status">Trạng thái sau khôi phục</Label>
                <Select
                  value={restoreTarget}
                  onValueChange={(value) => setRestoreTarget(value as "CREATED" | "ACTIVE")}
                >
                  <SelectTrigger id="restore-target-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CREATED">CREATED (Mới tạo — an toàn)</SelectItem>
                    <SelectItem value="ACTIVE">ACTIVE (Hoạt động ngay)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Hủy</AlertDialogCancel>
                <AlertDialogAction onClick={() => void handleRestore()}>
                  Xác nhận khôi phục
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertTitle>Không thể thực hiện thao tác</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
