"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProjectMemberRole, ProjectStatus } from "@prisma/client";
import { Crown, History, Loader2, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { ProjectMemberRoleBadge } from "@/components/shared/status-badge";
import type { ApiErrorDetail } from "@/types/api";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  addProjectMemberAction,
  changeProjectLeaderAction,
  removeProjectMemberAction,
} from "@/modules/project-members/member.actions";
import type { ProjectMemberDTO } from "@/modules/project-members/member.repository";
import { useProjectCandidateSearch } from "@/lib/use-project-candidate-search";
import type { ProjectCandidateUserDTO } from "@/modules/projects/project.repository";

function formatDateTime(isoString: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoString));
}

export function ProjectMembersPanel({
  projectId,
  projectStatus,
  currentLeaderId,
  members,
  addableUserCandidates,
  leaderChangeCandidates: initialLeaderCandidates,
  canManageMembers,
}: {
  projectId: string;
  projectStatus: ProjectStatus;
  currentLeaderId: string;
  members: ProjectMemberDTO[];
  addableUserCandidates: ProjectCandidateUserDTO[];
  leaderChangeCandidates: ProjectCandidateUserDTO[];
  canManageMembers: boolean;
}) {
  const router = useRouter();
  const [selectedUserId, setSelectedUserId] = React.useState<string>("");
  const [selectedRole, setSelectedRole] = React.useState<"MEMBER" | "INSTRUCTOR">("MEMBER");
  const [nextLeaderId, setNextLeaderId] = React.useState<string>("");
  const [showHistory, setShowHistory] = React.useState(false);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [errorDetails, setErrorDetails] = React.useState<ApiErrorDetail[]>([]);
  const [blockedMemberUserId, setBlockedMemberUserId] = React.useState<string | null>(null);

  const isArchived = projectStatus === ProjectStatus.ARCHIVED;
  const activeMembers = React.useMemo(() => members.filter((m) => m.leftAt === null), [members]);
  const historyMembers = React.useMemo(() => members.filter((m) => m.leftAt !== null), [members]);

  const activeUserIdSet = React.useMemo(
    () => new Set(activeMembers.map((m) => m.userId)),
    [activeMembers]
  );

  const addMemberSearch = useProjectCandidateSearch({
    initialItems: addableUserCandidates,
    kind: "member",
    projectId,
    excludeCurrentMembers: true,
    enabled: canManageMembers && !isArchived,
  });

  const leaderSearch = useProjectCandidateSearch({
    initialItems: initialLeaderCandidates,
    kind: "member",
    projectId,
    excludeCurrentMembers: false,
    enabled: canManageMembers && !isArchived,
  });

  const addableUsers = React.useMemo(
    () => addMemberSearch.items.filter((u) => !activeUserIdSet.has(u.id)),
    [addMemberSearch.items, activeUserIdSet]
  );

  const leaderChangeCandidates = React.useMemo(
    () => leaderSearch.items.filter((u) => u.id !== currentLeaderId),
    [leaderSearch.items, currentLeaderId]
  );

  async function handleAddMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUserId) return;

    setBusyKey("add");
    setErrorMessage(null);
    const result = await addProjectMemberAction(projectId, {
      userId: selectedUserId,
      projectRole: selectedRole,
    });
    setBusyKey(null);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      toast.error(result.error.message);
      return;
    }

    toast.success(`Đã thêm ${result.data.user.fullName} vào Project.`);
    setSelectedUserId("");
    router.refresh();
  }

  async function handleChangeLeader() {
    if (!nextLeaderId) return;

    setBusyKey("leader");
    setErrorMessage(null);
    const result = await changeProjectLeaderAction(projectId, { leaderId: nextLeaderId });
    setBusyKey(null);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      toast.error(result.error.message);
      return;
    }

    toast.success("Đã chuyển giao vai trò Project Leader.");
    setNextLeaderId("");
    router.refresh();
  }

  async function handleRemoveMember(member: ProjectMemberDTO) {
    setBusyKey(`remove:${member.userId}`);
    setErrorMessage(null);
    setErrorDetails([]);
    setBlockedMemberUserId(null);
    const result = await removeProjectMemberAction(projectId, member.userId);
    setBusyKey(null);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      setErrorDetails(result.error.details ?? []);
      if (result.error.code === "TASK_ASSIGNEE_REASSIGN_REQUIRED") {
        setBlockedMemberUserId(member.userId);
      }
      toast.error(result.error.message);
      return;
    }

    toast.success(`Đã loại bỏ ${member.user.fullName} khỏi Project (giữ lại lịch sử).`);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg">
            Thành viên Project ({activeMembers.length} đang tham gia)
          </CardTitle>
          <CardDescription>
            Chỉ tài khoản ACTIVE mới được thêm vào Project (BR-MEM-001). Thành viên bị loại bỏ được
            đánh dấu leftAt để bảo toàn lịch sử (BR-MEM-003, DEC-009).
          </CardDescription>
        </div>
        {historyMembers.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowHistory((prev) => !prev)}
          >
            <History className="h-4 w-4" />
            <span>
              {showHistory
                ? "Ẩn lịch sử rời nhóm"
                : `Xem lịch sử rời nhóm (${historyMembers.length})`}
            </span>
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {isArchived && canManageMembers && (
          <Alert>
            <AlertTitle>Project đã lưu trữ (ARCHIVED)</AlertTitle>
            <AlertDescription>
              Không thể thêm, xóa thành viên hoặc đổi Leader khi Project đang ở trạng thái ARCHIVED
              (BR-PROJ-008).
            </AlertDescription>
          </Alert>
        )}

        {errorMessage && (
          <Alert variant="destructive">
            <AlertTitle>Không thể cập nhật thành viên</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{errorMessage}</p>
              {errorDetails.some((detail) => detail.taskId) && (
                <ul className="list-disc space-y-1 pl-4 text-xs">
                  {errorDetails
                    .filter((detail) => detail.taskId)
                    .map((detail, idx) => (
                      <li key={`${detail.taskId}-${idx}`}>
                        <Link
                          href={`/projects/${projectId}/tasks/${detail.taskId}`}
                          className="font-medium underline"
                        >
                          {detail.message ?? detail.taskTitle}
                        </Link>
                      </li>
                    ))}
                </ul>
              )}
              {blockedMemberUserId && (
                <p className="text-xs">
                  <Link
                    href={`/projects/${projectId}/tasks?assigneeId=${blockedMemberUserId}`}
                    className="font-medium underline"
                  >
                    Xem tất cả Task đang giao cho thành viên này →
                  </Link>
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {canManageMembers && !isArchived && (
          <div className="grid gap-4 lg:grid-cols-2">
            <form
              onSubmit={handleAddMember}
              className="space-y-3 rounded-md border border-border bg-slate-50/60 p-4"
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <UserPlus className="h-4 w-4" />
                <span>Thêm thành viên vào Project</span>
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="add-member-user" className="text-xs">
                    Tài khoản ACTIVE
                  </Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger id="add-member-user">
                      <SelectValue
                        placeholder={
                          addableUsers.length === 0
                            ? "Không còn user khả dụng"
                            : "Chọn thành viên..."
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {addableUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={addMemberSearch.query}
                    onChange={(e) => addMemberSearch.setQuery(e.target.value)}
                    placeholder="Tìm thành viên theo họ tên..."
                    aria-label="Tìm thành viên thêm vào Project"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="add-member-role" className="text-xs">
                    Vai trò Project
                  </Label>
                  <Select
                    value={selectedRole}
                    onValueChange={(v) => setSelectedRole(v as "MEMBER" | "INSTRUCTOR")}
                  >
                    <SelectTrigger id="add-member-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBER">MEMBER</SelectItem>
                      <SelectItem value="INSTRUCTOR">INSTRUCTOR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" size="sm" disabled={!selectedUserId || busyKey !== null}>
                {busyKey === "add" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                <span>Thêm thành viên</span>
              </Button>
            </form>

            <div className="space-y-3 rounded-md border border-border bg-slate-50/60 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Crown className="h-4 w-4 text-amber-600" />
                <span>Chuyển giao vai trò Project Leader</span>
              </p>
              <div className="space-y-1">
                <Label htmlFor="change-leader-user" className="text-xs">
                  Chọn Leader mới (Leader cũ sẽ chuyển về vai trò MEMBER)
                </Label>
                <Select value={nextLeaderId} onValueChange={setNextLeaderId}>
                  <SelectTrigger id="change-leader-user">
                    <SelectValue
                      placeholder={
                        leaderChangeCandidates.length === 0
                          ? "Không có thành viên khác"
                          : "Chọn Leader mới..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {leaderChangeCandidates.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={leaderSearch.query}
                  onChange={(e) => leaderSearch.setQuery(e.target.value)}
                  placeholder="Tìm ứng viên Leader theo họ tên..."
                  aria-label="Tìm ứng viên Leader mới"
                  className="h-8 text-xs"
                />
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!nextLeaderId || busyKey !== null}
                  >
                    {busyKey === "leader" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Crown className="h-4 w-4" />
                    )}
                    <span>Đổi Project Leader</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Xác nhận đổi Project Leader</AlertDialogTitle>
                    <AlertDialogDescription>
                      Leader mới sẽ nhận quyền điều phối Project này, đồng thời Leader hiện tại sẽ
                      trở thành thành viên (MEMBER) để đảm bảo Project luôn có đúng một Leader
                      (BR-PROJ-002).
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void handleChangeLeader()}>
                      Xác nhận đổi Leader
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}

        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Họ và tên</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Vai trò Project</TableHead>
                <TableHead>Role Workspace</TableHead>
                <TableHead>Ngày tham gia</TableHead>
                {canManageMembers && <TableHead className="text-right">Thao tác</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeMembers.map((member) => {
                const isProjectLeader = member.userId === currentLeaderId;
                const isRemoving = busyKey === `remove:${member.userId}`;
                return (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium text-slate-900">
                      {member.user.fullName}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {member.user.email}
                    </TableCell>
                    <TableCell>
                      <ProjectMemberRoleBadge role={member.projectRole} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {member.user.workspaceRoles.map((roleName) => (
                          <Badge key={roleName} variant="outline" className="text-[11px]">
                            {roleName}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(member.joinedAt)}
                    </TableCell>
                    {canManageMembers && (
                      <TableCell className="text-right">
                        {isProjectLeader || member.projectRole === ProjectMemberRole.LEADER ? (
                          <span className="text-xs text-muted-foreground">Leader chính</span>
                        ) : (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={isArchived || busyKey !== null}
                              >
                                {isRemoving ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <UserMinus className="h-3.5 w-3.5" />
                                )}
                                <span>Loại bỏ</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Loại bỏ {member.user.fullName} khỏi Project?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Thành viên sẽ ngừng tham gia từ thời điểm hiện tại nhưng toàn bộ
                                  lịch sử tham gia và đóng góp vẫn được bảo lưu (BR-MEM-003,
                                  DEC-009). Nếu thành viên còn Task đang phụ trách, thao tác sẽ bị
                                  từ chối cho đến khi bạn phân công lại.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                <AlertDialogAction onClick={() => void handleRemoveMember(member)}>
                                  Xác nhận loại bỏ
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {showHistory && historyMembers.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-800">
              Lịch sử thành viên đã rời nhóm ({historyMembers.length})
            </h3>
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Họ và tên</TableHead>
                    <TableHead>Vai trò trước đây</TableHead>
                    <TableHead>Tham gia lúc</TableHead>
                    <TableHead>Rời nhóm lúc</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="text-sm">
                        {member.user.fullName}{" "}
                        <span className="text-xs text-muted-foreground">({member.user.email})</span>
                      </TableCell>
                      <TableCell>
                        <ProjectMemberRoleBadge role={member.projectRole} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(member.joinedAt)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {member.leftAt ? formatDateTime(member.leftAt) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
