"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ProjectStatus } from "@prisma/client";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Plus,
  Repeat,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  addDaysToYmd,
  formatHcmDateVi,
  HCM_UTC_OFFSET_MS,
  hcmDateTimeInstant,
} from "@/lib/timezone";
import { cn } from "@/lib/utils";
import {
  createScheduleEntryAction,
  deleteScheduleEntryAction,
  updateScheduleEntryAction,
} from "@/modules/schedule/schedule.actions";
import {
  computeRepeatUntilFromWeeks,
  minutesToHhmm,
  SCHEDULE_TIME_BLOCKS,
  type ProjectWeeklyScheduleDTO,
  type ScheduleOccurrenceDTO,
  type ScheduleRecurrenceScope,
} from "@/modules/schedule/schedule.types";

const ALL_MEMBERS_VALUE = "__ALL__";

type ViewMode = "TEAM" | "MINE";
type RepeatMode = "SPECIFIC_WEEKS" | "UNTIL_PROJECT_END";

interface ModalState {
  mode: "create" | "edit";
  occurrence?: ScheduleOccurrenceDTO;
  date: string;
  startTime: string;
  endTime: string;
  endAtMidnight: boolean;
  isRecurring: boolean;
  repeatMode: RepeatMode;
  repeatWeeks: string;
  note: string;
  scope: ScheduleRecurrenceScope;
  errorMessage: string | null;
}

function getShortMemberName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName;
  return parts.slice(-2).join(" ");
}

function formatShortDdMm(ymd: string): string {
  const [, month, day] = ymd.split("-");
  return `${day}/${month}`;
}

function getHcmCurrentMinutes(nowMs: number): number {
  const d = new Date(nowMs + HCM_UTC_OFFSET_MS);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

const SCOPE_OPTIONS: ReadonlyArray<{
  value: ScheduleRecurrenceScope;
  label: string;
  description: string;
}> = [
  {
    value: "THIS_WEEK",
    label: "Chỉ áp dụng tuần này",
    description: "Chỉ thay đổi hoặc bỏ riêng ngày này, các tuần khác giữ nguyên.",
  },
  {
    value: "THIS_AND_FUTURE",
    label: "Từ tuần này trở đi",
    description: "Giữ các tuần trước đó nguyên vẹn và áp dụng thay đổi từ tuần này về sau.",
  },
  {
    value: "ALL_SERIES",
    label: "Toàn bộ chuỗi lặp lại",
    description: "Áp dụng cho toàn bộ các tuần của lịch lặp lại này.",
  },
];

export function ProjectScheduleClient({
  projectId,
  projectStatus,
  currentUserId,
  schedule,
}: {
  projectId: string;
  projectStatus: ProjectStatus;
  currentUserId: string;
  schedule: ProjectWeeklyScheduleDTO;
}) {
  const router = useRouter();
  const [viewMode, setViewMode] = React.useState<ViewMode>("TEAM");
  const [selectedMemberId, setSelectedMemberId] = React.useState<string>(ALL_MEMBERS_VALUE);
  const hasNightEntries = React.useMemo(
    () => schedule.occurrences.some((occ) => occ.startMinute < 360),
    [schedule.occurrences]
  );
  const [showNightHours, setShowNightHours] = React.useState<boolean>(false);
  const [modal, setModal] = React.useState<ModalState | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const referenceNowMs = React.useMemo(() => Date.parse(schedule.nowIso), [schedule.nowIso]);
  const effectiveShowNightHours = showNightHours || hasNightEntries;
  const isArchived = projectStatus === ProjectStatus.ARCHIVED;
  const canCreate = schedule.capabilities.canCreateOwn && !isArchived;

  const visibleBlocks = React.useMemo(
    () =>
      effectiveShowNightHours
        ? SCHEDULE_TIME_BLOCKS
        : SCHEDULE_TIME_BLOCKS.filter((block) => !block.isNight),
    [effectiveShowNightHours]
  );

  const filteredOccurrences = React.useMemo(() => {
    if (viewMode === "MINE") {
      return schedule.occurrences.filter((occ) => occ.userId === currentUserId);
    }
    if (selectedMemberId !== ALL_MEMBERS_VALUE) {
      return schedule.occurrences.filter((occ) => occ.userId === selectedMemberId);
    }
    return schedule.occurrences;
  }, [schedule.occurrences, viewMode, selectedMemberId, currentUserId]);

  const totalTrackableMembers = React.useMemo(
    () => schedule.members.filter((m) => m.projectRole !== "INSTRUCTOR").length,
    [schedule.members]
  );

  function navigateWeek(targetYmd: string) {
    router.push(`/projects/${projectId}/schedule?weekStart=${encodeURIComponent(targetYmd)}`);
  }

  function openCreateModal(dateYmd: string, startMinute = 480, endMinute = 600) {
    if (!canCreate) return;

    let effectiveStartMinute = startMinute;
    if (dateYmd === schedule.todayYmd) {
      const nowMinute = getHcmCurrentMinutes(referenceNowMs);
      if (effectiveStartMinute <= nowMinute) {
        effectiveStartMinute = Math.min(endMinute - 1, nowMinute + 1);
      }
    }

    const isMidnight = endMinute >= 1440;
    const safeDate = dateYmd > schedule.projectEndDate ? schedule.projectEndDate : dateYmd;

    setModal({
      mode: "create",
      date: safeDate,
      startTime: minutesToHhmm(effectiveStartMinute),
      endTime: isMidnight ? "23:59" : minutesToHhmm(endMinute),
      endAtMidnight: isMidnight,
      isRecurring: false,
      repeatMode: "SPECIFIC_WEEKS",
      repeatWeeks: "4",
      note: "",
      scope: "ALL_SERIES",
      errorMessage: null,
    });
  }

  function openEditModal(occ: ScheduleOccurrenceDTO) {
    const isMidnight = occ.endMinute >= 1440;
    const isUntilProjectEnd = occ.repeatUntil === schedule.projectEndDate;
    setModal({
      mode: "edit",
      occurrence: occ,
      date: occ.date,
      startTime: occ.startTime,
      endTime: isMidnight ? "23:59" : occ.endTime,
      endAtMidnight: isMidnight,
      isRecurring: occ.isRecurring,
      repeatMode:
        occ.isRecurring && isUntilProjectEnd && !occ.repeatWeeks
          ? "UNTIL_PROJECT_END"
          : "SPECIFIC_WEEKS",
      repeatWeeks: String(occ.repeatWeeks ?? 4),
      note: occ.note ?? "",
      scope: occ.isRecurring ? "THIS_WEEK" : "ALL_SERIES",
      errorMessage: null,
    });
  }

  async function handleSaveModal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal) return;

    const effectiveEndTime = modal.endAtMidnight ? "24:00" : modal.endTime;
    const parsedRepeatWeeks =
      modal.isRecurring && modal.repeatMode === "SPECIFIC_WEEKS"
        ? Number.parseInt(modal.repeatWeeks, 10)
        : null;

    if (
      modal.isRecurring &&
      modal.repeatMode === "SPECIFIC_WEEKS" &&
      (!Number.isInteger(parsedRepeatWeeks) || (parsedRepeatWeeks ?? 0) < 1)
    ) {
      setModal({
        ...modal,
        errorMessage: "Vui lòng nhập số tuần lặp lại hợp lệ (từ 1 tuần trở lên).",
      });
      return;
    }

    setSubmitting(true);
    if (modal.mode === "create") {
      const res = await createScheduleEntryAction(projectId, {
        date: modal.date,
        startTime: modal.startTime,
        endTime: effectiveEndTime,
        isRecurring: modal.isRecurring,
        repeatWeeks: modal.isRecurring ? parsedRepeatWeeks : null,
        note: modal.note.trim() || null,
      });
      setSubmitting(false);

      if (!res.ok) {
        setModal({ ...modal, errorMessage: res.error.message });
        toast.error(res.error.message);
        return;
      }

      toast.success("Đã ghi chú khung giờ bận.");
      setModal(null);
      router.refresh();
      return;
    }

    if (!modal.occurrence) {
      setSubmitting(false);
      return;
    }

    const res = await updateScheduleEntryAction(projectId, modal.occurrence.entryId, {
      scope: modal.occurrence.isRecurring ? modal.scope : "ALL_SERIES",
      occurrenceDate: modal.occurrence.date,
      date: modal.date,
      startTime: modal.startTime,
      endTime: effectiveEndTime,
      isRecurring: modal.isRecurring,
      repeatWeeks: modal.isRecurring ? parsedRepeatWeeks : null,
      note: modal.note.trim() || null,
    });
    setSubmitting(false);

    if (!res.ok) {
      setModal({ ...modal, errorMessage: res.error.message });
      toast.error(res.error.message);
      return;
    }

    toast.success("Đã cập nhật khung giờ bận.");
    setModal(null);
    router.refresh();
  }

  async function handleDeleteFromModal() {
    if (!modal?.occurrence) return;

    setSubmitting(true);
    const res = await deleteScheduleEntryAction(projectId, modal.occurrence.entryId, {
      scope: modal.occurrence.isRecurring ? modal.scope : "ALL_SERIES",
      occurrenceDate: modal.occurrence.date,
    });
    setSubmitting(false);

    if (!res.ok) {
      setModal({ ...modal, errorMessage: res.error.message });
      toast.error(res.error.message);
      return;
    }

    toast.success("Đã xóa khung giờ bận.");
    setModal(null);
    router.refresh();
  }

  const isEditingReadOnly =
    modal?.mode === "edit" && modal.occurrence !== undefined && !modal.occurrence.canEdit;
  const canDeleteModal =
    modal?.mode === "edit" && modal.occurrence !== undefined && modal.occurrence.canDelete;

  const previewRepeatEndYmd = React.useMemo(() => {
    if (!modal || !modal.isRecurring || modal.repeatMode !== "SPECIFIC_WEEKS") {
      return null;
    }
    const weeks = Number.parseInt(modal.repeatWeeks, 10);
    if (!Number.isInteger(weeks) || weeks < 1 || !modal.date) {
      return null;
    }
    return computeRepeatUntilFromWeeks(modal.date, weeks);
  }, [modal]);

  const isPreviewExceedingProject =
    previewRepeatEndYmd !== null && previewRepeatEndYmd > schedule.projectEndDate;

  const defaultCreateDate =
    schedule.todayYmd > schedule.projectEndDate ? schedule.projectEndDate : schedule.todayYmd;
  const canOpenHeaderCreate = canCreate && schedule.todayYmd <= schedule.projectEndDate;

  return (
    <div className="space-y-4">
      {isArchived && (
        <Alert>
          <AlertTitle>Project đã lưu trữ (Archived · Chỉ xem)</AlertTitle>
          <AlertDescription>
            Project đang ở trạng thái ARCHIVED nên toàn bộ thao tác thêm, sửa, xóa lịch bận đã được
            khóa và các lịch từ thời điểm lưu trữ trở đi đã được xóa.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="gap-4 border-b border-border pb-4">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarClock className="h-5 w-5 text-primary" />
                <span>
                  Thời khóa biểu tuần ({formatHcmDateVi(schedule.weekStart)} –{" "}
                  {formatHcmDateVi(schedule.weekEnd)})
                </span>
              </CardTitle>
              <CardDescription className="mt-1">
                Click trực tiếp vào ô 2 giờ từ hiện tại trở đi để ghi chú lịch bận (giới hạn đến hạn
                chót Project: <strong>{formatHcmDateVi(schedule.projectEndDate)}</strong>).
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigateWeek(addDaysToYmd(schedule.weekStart, -7))}
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Tuần trước</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigateWeek(schedule.todayYmd)}
              >
                Tuần hiện tại
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigateWeek(addDaysToYmd(schedule.weekStart, 7))}
              >
                <span>Tuần sau</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Input
                type="date"
                aria-label="Chọn ngày để chuyển tuần"
                value={schedule.weekStart}
                onChange={(e) => {
                  if (e.target.value) navigateWeek(e.target.value);
                }}
                className="h-8 w-auto text-xs"
              />
              {canOpenHeaderCreate && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => openCreateModal(defaultCreateDate, 480, 600)}
                >
                  <Plus className="h-4 w-4" />
                  <span>Thêm lịch bận</span>
                </Button>
              )}
            </div>
          </div>

          {/* Filter & View Mode Toolbar */}
          <div className="flex flex-col justify-between gap-3 pt-1 sm:flex-row sm:items-center">
            <div className="inline-flex rounded-md border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setViewMode("TEAM")}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
                  viewMode === "TEAM"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Lịch cả nhóm</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("MINE")}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
                  viewMode === "MINE"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <User className="h-3.5 w-3.5" />
                <span>Lịch của tôi</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {viewMode === "TEAM" && (
                <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                  <SelectTrigger className="h-8 w-52 text-xs" aria-label="Lọc theo thành viên">
                    <SelectValue placeholder="Tất cả thành viên" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_MEMBERS_VALUE}>
                      Tất cả thành viên ({schedule.members.length})
                    </SelectItem>
                    {schedule.members.map((member) => (
                      <SelectItem key={member.userId} value={member.userId}>
                        {member.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={hasNightEntries}
                onClick={() => setShowNightHours((prev) => !prev)}
                className="h-8 text-xs"
              >
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {effectiveShowNightHours ? "Ẩn khung 00:00–06:00" : "Hiện khung 00:00–06:00"}
                </span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] table-fixed border-collapse text-left text-xs">
              <colgroup>
                <col className="w-28" />
                {schedule.days.map((day) => (
                  <col key={day.date} />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="border-r border-border px-3 py-2.5 font-semibold text-muted-foreground">
                    Khung giờ
                  </th>
                  {schedule.days.map((day) => {
                    const isToday = day.date === schedule.todayYmd;
                    return (
                      <th
                        key={day.date}
                        className={cn(
                          "border-r border-border px-2.5 py-2.5 last:border-r-0",
                          isToday && "bg-primary/10"
                        )}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate font-semibold text-foreground">
                            {day.fullLabel}
                          </span>
                          {isToday && (
                            <Badge variant="default" className="shrink-0 px-1.5 py-0 text-[10px]">
                              Hôm nay
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 font-normal text-muted-foreground">
                          {formatShortDdMm(day.date)}
                        </p>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {visibleBlocks.map((block) => (
                  <tr key={block.startMinute} className="align-top">
                    <td className="border-r border-border bg-muted/20 px-3 py-2.5 font-mono text-[11px] font-medium whitespace-nowrap text-muted-foreground">
                      {block.label}
                    </td>
                    {schedule.days.map((day) => {
                      const isToday = day.date === schedule.todayYmd;
                      const blockEndInstant = hcmDateTimeInstant(
                        day.date,
                        minutesToHhmm(block.endMinute)
                      );
                      const isPastBlock = blockEndInstant.getTime() <= referenceNowMs;
                      const isAfterProjectEnd = day.date > schedule.projectEndDate;
                      const canQuickAddCell = canCreate && !isPastBlock && !isAfterProjectEnd;

                      const cellOccurrences = filteredOccurrences.filter(
                        (occ) =>
                          occ.date === day.date &&
                          occ.startMinute < block.endMinute &&
                          occ.endMinute > block.startMinute
                      );

                      const busyUserCount = new Set(cellOccurrences.map((occ) => occ.userId)).size;
                      const showGroupIndicator =
                        viewMode === "TEAM" &&
                        selectedMemberId === ALL_MEMBERS_VALUE &&
                        totalTrackableMembers > 0;

                      return (
                        <td
                          key={`${day.date}-${block.startMinute}`}
                          className={cn(
                            "group relative min-w-0 border-r border-border p-1.5 align-top transition-colors last:border-r-0",
                            isToday && "bg-primary/[0.03]",
                            canQuickAddCell && "hover:bg-accent/35"
                          )}
                        >
                          <div className="mb-1 flex items-center justify-between gap-1">
                            {showGroupIndicator ? (
                              busyUserCount === 0 ? (
                                <span className="truncate whitespace-nowrap rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                                  Cả nhóm rảnh
                                </span>
                              ) : (
                                <span className="truncate whitespace-nowrap rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-300">
                                  {busyUserCount}/{totalTrackableMembers} bận
                                </span>
                              )
                            ) : (
                              <span />
                            )}

                            {canQuickAddCell && (
                              <button
                                type="button"
                                onClick={() =>
                                  openCreateModal(day.date, block.startMinute, block.endMinute)
                                }
                                title={`Thêm lịch bận ${day.fullLabel} (${block.label})`}
                                aria-label={`Thêm lịch bận ${day.fullLabel} ${block.label}`}
                                className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border border-transparent text-muted-foreground opacity-60 transition hover:border-border hover:bg-card hover:text-foreground group-hover:opacity-100"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="min-w-0 space-y-1">
                            {cellOccurrences.map((occ) => {
                              const isMine = occ.userId === currentUserId;
                              return (
                                <button
                                  key={`${occ.entryId}-${occ.date}-${block.startMinute}`}
                                  type="button"
                                  onClick={() => openEditModal(occ)}
                                  className={cn(
                                    "block w-full min-w-0 cursor-pointer overflow-hidden rounded border px-2 py-1 text-left transition",
                                    isMine
                                      ? "border-primary/40 bg-primary/10 text-foreground hover:bg-primary/15"
                                      : "border-border bg-secondary/70 text-secondary-foreground hover:bg-secondary"
                                  )}
                                >
                                  <div className="flex min-w-0 items-center justify-between gap-1">
                                    <span className="truncate text-[11px] font-semibold">
                                      {viewMode === "TEAM"
                                        ? getShortMemberName(occ.userFullName)
                                        : `${occ.startTime}–${occ.endTime}`}
                                    </span>
                                    {occ.isRecurring && (
                                      <Repeat
                                        className="h-3 w-3 shrink-0 text-muted-foreground"
                                        aria-label="Lặp lại hàng tuần"
                                      />
                                    )}
                                  </div>
                                  {viewMode === "TEAM" && (
                                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                                      {occ.startTime}–{occ.endTime}
                                    </p>
                                  )}
                                  <p className="line-clamp-2 break-words text-[11px] text-muted-foreground">
                                    {occ.note?.trim() || "Bận"}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit / View Modal */}
      <Dialog open={modal !== null} onOpenChange={(open) => !open && setModal(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {modal && (
            <form onSubmit={handleSaveModal} className="space-y-4">
              <DialogHeader>
                <DialogTitle>
                  {modal.mode === "create"
                    ? "Thêm khung giờ bận"
                    : isEditingReadOnly
                      ? `Lịch bận của ${modal.occurrence?.userFullName}`
                      : "Chi tiết khung giờ bận"}
                </DialogTitle>
                <DialogDescription>
                  {modal.mode === "create"
                    ? `Ghi chú khoảng thời gian bạn bận (từ hiện tại đến hạn Project ${formatHcmDateVi(schedule.projectEndDate)}).`
                    : isEditingReadOnly
                      ? "Bạn đang xem ghi chú lịch bận của thành viên khác."
                      : "Cập nhật khoảng thời gian, số tuần lặp lại hoặc xóa ghi chú này."}
                </DialogDescription>
              </DialogHeader>

              {modal.errorMessage && (
                <Alert variant="destructive">
                  <AlertTitle>Không thể lưu lịch bận</AlertTitle>
                  <AlertDescription>{modal.errorMessage}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="schedule-date">Ngày</Label>
                  <Input
                    id="schedule-date"
                    type="date"
                    min={modal.mode === "create" ? schedule.todayYmd : undefined}
                    max={schedule.projectEndDate}
                    value={modal.date}
                    onChange={(e) => setModal({ ...modal, date: e.target.value })}
                    disabled={
                      isEditingReadOnly ||
                      (modal.mode === "edit" &&
                        Boolean(modal.occurrence?.isRecurring) &&
                        modal.scope === "THIS_WEEK")
                    }
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="schedule-start-time">Từ giờ</Label>
                    <Input
                      id="schedule-start-time"
                      type="time"
                      value={modal.startTime}
                      onChange={(e) => setModal({ ...modal, startTime: e.target.value })}
                      disabled={isEditingReadOnly}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="schedule-end-time">Đến giờ</Label>
                      {!isEditingReadOnly && (
                        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={modal.endAtMidnight}
                            onChange={(e) =>
                              setModal({
                                ...modal,
                                endAtMidnight: e.target.checked,
                              })
                            }
                            className="h-3.5 w-3.5 rounded border-input"
                          />
                          <span>24:00 (Hết ngày)</span>
                        </label>
                      )}
                    </div>
                    <Input
                      id="schedule-end-time"
                      type="time"
                      value={modal.endAtMidnight ? "23:59" : modal.endTime}
                      onChange={(e) => setModal({ ...modal, endTime: e.target.value })}
                      disabled={isEditingReadOnly || modal.endAtMidnight}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2 rounded-md border border-border p-3">
                  <label
                    className={cn(
                      "flex items-center gap-2 text-sm",
                      isEditingReadOnly ? "opacity-70" : "cursor-pointer"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={modal.isRecurring}
                      disabled={
                        isEditingReadOnly ||
                        (modal.mode === "edit" &&
                          Boolean(modal.occurrence?.isRecurring) &&
                          modal.scope === "THIS_WEEK")
                      }
                      onChange={(e) => setModal({ ...modal, isRecurring: e.target.checked })}
                      className="h-4 w-4 rounded border-input"
                    />
                    <div>
                      <p className="font-medium text-foreground">Lặp lại hàng tuần</p>
                      <p className="text-xs text-muted-foreground">
                        Tự động lặp lại vào đúng thứ này theo số tuần bạn chọn hoặc đến hết Project.
                      </p>
                    </div>
                  </label>

                  {modal.isRecurring &&
                    !(
                      modal.mode === "edit" &&
                      modal.occurrence?.isRecurring &&
                      modal.scope === "THIS_WEEK"
                    ) && (
                      <div className="mt-2 space-y-2 border-t border-border pt-2.5 text-xs">
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="radio"
                            name="schedule-repeat-mode"
                            value="SPECIFIC_WEEKS"
                            checked={modal.repeatMode === "SPECIFIC_WEEKS"}
                            disabled={isEditingReadOnly}
                            onChange={() => setModal({ ...modal, repeatMode: "SPECIFIC_WEEKS" })}
                          />
                          <span className="font-medium text-foreground">
                            Áp dụng trong số tuần cụ thể (tính từ tuần này):
                          </span>
                        </label>

                        {modal.repeatMode === "SPECIFIC_WEEKS" && (
                          <div className="ml-6 space-y-1">
                            <div className="flex items-center gap-2">
                              <Input
                                id="schedule-repeat-weeks"
                                type="number"
                                min={1}
                                max={260}
                                value={modal.repeatWeeks}
                                disabled={isEditingReadOnly}
                                onChange={(e) =>
                                  setModal({ ...modal, repeatWeeks: e.target.value })
                                }
                                className="h-8 w-24 text-xs"
                              />
                              <span className="text-muted-foreground">
                                tuần (VD: 3, 8, 10 tuần)
                              </span>
                            </div>
                            {previewRepeatEndYmd && (
                              <p
                                className={cn(
                                  "text-[11px]",
                                  isPreviewExceedingProject
                                    ? "font-medium text-destructive"
                                    : "text-muted-foreground"
                                )}
                              >
                                {isPreviewExceedingProject
                                  ? `Vượt quá hạn chót Project (${formatHcmDateVi(schedule.projectEndDate)}) — lịch sẽ đến ngày ${formatHcmDateVi(previewRepeatEndYmd)}.`
                                  : `Áp dụng đến ngày ${formatHcmDateVi(previewRepeatEndYmd)}.`}
                              </p>
                            )}
                          </div>
                        )}

                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="radio"
                            name="schedule-repeat-mode"
                            value="UNTIL_PROJECT_END"
                            checked={modal.repeatMode === "UNTIL_PROJECT_END"}
                            disabled={isEditingReadOnly}
                            onChange={() => setModal({ ...modal, repeatMode: "UNTIL_PROJECT_END" })}
                          />
                          <span className="font-medium text-foreground">
                            Lặp lại đến hết thời hạn Project (
                            {formatHcmDateVi(schedule.projectEndDate)})
                          </span>
                        </label>
                      </div>
                    )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="schedule-note">Ghi chú lý do bận (Tùy chọn)</Label>
                  <Textarea
                    id="schedule-note"
                    value={modal.note}
                    onChange={(e) => setModal({ ...modal, note: e.target.value })}
                    placeholder="VD: Học trên trường, Đi làm thêm, Việc cá nhân..."
                    maxLength={500}
                    rows={3}
                    disabled={isEditingReadOnly}
                  />
                </div>

                {modal.mode === "edit" &&
                  modal.occurrence?.isRecurring &&
                  (modal.occurrence.canEdit || modal.occurrence.canDelete) && (
                    <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
                      <p className="text-xs font-semibold text-foreground">
                        Phạm vi áp dụng cho lịch lặp lại:
                      </p>
                      <div className="space-y-1.5">
                        {SCOPE_OPTIONS.map((opt) => (
                          <label
                            key={opt.value}
                            className="flex cursor-pointer items-start gap-2 text-xs"
                          >
                            <input
                              type="radio"
                              name="schedule-recurrence-scope"
                              value={opt.value}
                              checked={modal.scope === opt.value}
                              onChange={() => setModal({ ...modal, scope: opt.value })}
                              className="mt-0.5"
                            />
                            <div>
                              <span className="font-medium text-foreground">{opt.label}</span>
                              <p className="text-[11px] text-muted-foreground">{opt.description}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
              </div>

              <DialogFooter className="gap-2 sm:justify-between">
                <div>
                  {canDeleteModal && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={submitting}
                      onClick={() => void handleDeleteFromModal()}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Xóa lịch này</span>
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModal(null)}
                    disabled={submitting}
                  >
                    {isEditingReadOnly ? "Đóng" : "Hủy"}
                  </Button>
                  {!isEditingReadOnly && (
                    <Button type="submit" disabled={submitting}>
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      <span>{modal.mode === "create" ? "Lưu lịch bận" : "Lưu thay đổi"}</span>
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
