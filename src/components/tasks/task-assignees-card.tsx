"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import type { TaskAssignableMemberOption } from "@/components/tasks/task-list-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addTaskAssigneeAction, removeTaskAssigneeAction } from "@/modules/tasks/task.actions";
import type { TaskAssigneeDTO } from "@/modules/tasks/task.repository";

interface TaskAssigneesCardProps {
  projectId: string;
  taskId: string;
  assignees: TaskAssigneeDTO[];
  assignableMembers: TaskAssignableMemberOption[];
  canManageAssignees: boolean;
  isArchived: boolean;
}

export function TaskAssigneesCard({
  projectId,
  taskId,
  assignees,
  assignableMembers,
  canManageAssignees,
  isArchived,
}: TaskAssigneesCardProps) {
  const router = useRouter();
  const [selectedUserId, setSelectedUserId] = React.useState<string>("");
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const assignedIds = React.useMemo(
    () => new Set(assignees.map((item) => item.userId)),
    [assignees]
  );

  const availableMembers = React.useMemo(
    () => assignableMembers.filter((member) => !assignedIds.has(member.userId)),
    [assignableMembers, assignedIds]
  );

  async function handleAddAssignee() {
    if (!selectedUserId) return;
    setBusyKey("add");
    setErrorMessage(null);

    const result = await addTaskAssigneeAction(taskId, { userId: selectedUserId }, projectId);
    setBusyKey(null);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      toast.error(result.error.message);
      return;
    }

    setSelectedUserId("");
    toast.success("Đã phân công thành viên vào Task.");
    router.refresh();
  }

  async function handleRemoveAssignee(userId: string, fullName: string) {
    setBusyKey(`remove:${userId}`);
    setErrorMessage(null);

    const result = await removeTaskAssigneeAction(taskId, userId, projectId);
    setBusyKey(null);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      toast.error(result.error.message);
      return;
    }

    toast.success(`Đã gỡ phân công ${fullName}.`);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Người thực hiện ({assignees.length})</CardTitle>
        <CardDescription>
          Chỉ thành viên thực thi (Leader/Member) đang hoạt động trong Project mới có thể nhận Task.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {canManageAssignees && !isArchived && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      availableMembers.length === 0
                        ? "Đã phân công hết thành viên khả dụng"
                        : "Chọn thành viên để giao việc..."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableMembers.map((member) => (
                    <SelectItem key={member.userId} value={member.userId}>
                      {member.fullName} ({member.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={!selectedUserId || busyKey !== null}
              onClick={handleAddAssignee}
            >
              <UserPlus className="h-4 w-4" />
              <span>{busyKey === "add" ? "Đang giao..." : "Giao việc"}</span>
            </Button>
          </div>
        )}

        {assignees.length === 0 ? (
          <p className="text-sm text-muted-foreground">Task này hiện chưa được giao cho ai.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {assignees.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{item.user.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.user.email} · Giao bởi {item.assignedBy.fullName}
                  </p>
                </div>
                {canManageAssignees && !isArchived && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-muted-foreground hover:text-destructive"
                    disabled={busyKey !== null}
                    onClick={() => handleRemoveAssignee(item.userId, item.user.fullName)}
                  >
                    <X className="h-4 w-4" />
                    <span>Gỡ</span>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
