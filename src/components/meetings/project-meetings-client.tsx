"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProjectMeetingStatus, ProjectStatus } from "@prisma/client";
import {
  Ban,
  Calendar,
  Clock,
  Copy,
  ExternalLink,
  Link2,
  ListPlus,
  Loader2,
  Pencil,
  Plus,
  Star,
  Trash2,
  Users,
  Video,
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
import { formatHcmDateVi } from "@/lib/timezone";
import { formatMeetingZaloSummary } from "@/lib/zalo-summary";
import { CopyZaloButton } from "@/components/shared/copy-zalo-button";
import { FreeSlotFinderDialog } from "@/components/schedule/free-slot-finder-dialog";
import {
  cancelProjectMeetingAction,
  createMeetLinkAction,
  createProjectMeetingAction,
  deleteMeetLinkAction,
  deleteProjectMeetingAction,
  updateMeetLinkAction,
  updateProjectMeetingAction,
} from "@/modules/meetings/meeting.actions";
import {
  addMinutesToHhmm,
  type MeetLinkDTO,
  type ProjectMeetingDTO,
  type ProjectMeetingsBundleDTO,
} from "@/modules/meetings/meeting.types";

const CUSTOM_MEET_LINK_VALUE = "__CUSTOM__";

type MeetingFilter = "UPCOMING" | "ALL" | "CANCELLED";

interface MeetingFormState {
  mode: "create" | "edit";
  meetingId?: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  endAtMidnight: boolean;
  selectedLinkId: string;
  customUrl: string;
  participantUserIds: string[];
  errorMessage: string | null;
}

interface LinkFormState {
  mode: "create" | "edit";
  linkId?: string;
  label: string;
  url: string;
  description: string;
  isDefault: boolean;
  errorMessage: string | null;
}

function getDefaultStartTime(): string {
  const now = new Date();
  const hcmMs = now.getTime() + 7 * 60 * 60 * 1000;
  const hcm = new Date(hcmMs);
  const roundedMinutes = Math.ceil((hcm.getUTCHours() * 60 + hcm.getUTCMinutes() + 15) / 15) * 15;
  if (roundedMinutes >= 23 * 60) {
    return "09:00";
  }
  const hh = String(Math.floor(roundedMinutes / 60)).padStart(2, "0");
  const mm = String(roundedMinutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function ProjectMeetingsClient({
  projectId,
  projectStatus,
  bundle,
}: {
  projectId: string;
  projectStatus: ProjectStatus;
  bundle: ProjectMeetingsBundleDTO;
}) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<MeetingFilter>("UPCOMING");
  const [meetingModal, setMeetingModal] = React.useState<MeetingFormState | null>(null);
  const [linkModal, setLinkModal] = React.useState<LinkFormState | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const isArchived = projectStatus === ProjectStatus.ARCHIVED;
  const canManage = bundle.capabilities.canManage && !isArchived;

  const eligibleMembers = React.useMemo(
    () => bundle.members.filter((m) => m.projectRole !== "INSTRUCTOR"),
    [bundle.members]
  );

  const defaultMeetLink = React.useMemo(
    () => bundle.meetLinks.find((l) => l.isDefault) ?? bundle.meetLinks[0] ?? null,
    [bundle.meetLinks]
  );

  const referenceNowMs = React.useMemo(() => Date.parse(bundle.nowIso), [bundle.nowIso]);

  const visibleMeetings = React.useMemo(() => {
    return bundle.meetings.filter((m) => {
      if (filter === "CANCELLED") return m.status === ProjectMeetingStatus.CANCELLED;
      if (filter === "UPCOMING") {
        return (
          m.status === ProjectMeetingStatus.SCHEDULED &&
          new Date(m.endAt).getTime() >= referenceNowMs
        );
      }
      return true;
    });
  }, [bundle.meetings, filter, referenceNowMs]);

  function openCreateMeetingModal() {
    const defaultStart = getDefaultStartTime();
    const { hhmm: defaultEnd, endAtMidnight } = addMinutesToHhmm(defaultStart, 60);
    setMeetingModal({
      mode: "create",
      title: "",
      description: "",
      date: bundle.todayYmd,
      startTime: defaultStart,
      endTime: endAtMidnight ? "23:59" : defaultEnd,
      endAtMidnight,
      selectedLinkId: defaultMeetLink ? defaultMeetLink.id : CUSTOM_MEET_LINK_VALUE,
      customUrl: "",
      participantUserIds: eligibleMembers.map((m) => m.userId),
      errorMessage: null,
    });
  }

  function openEditMeetingModal(meeting: ProjectMeetingDTO) {
    const isMidnight = meeting.endMinute >= 1440;
    const matchedSavedLink = meeting.meetLinkId
      ? bundle.meetLinks.find((l) => l.id === meeting.meetLinkId)
      : undefined;

    setMeetingModal({
      mode: "edit",
      meetingId: meeting.id,
      title: meeting.title,
      description: meeting.description ?? "",
      date: meeting.date,
      startTime: meeting.startTime,
      endTime: isMidnight ? "23:59" : meeting.endTime,
      endAtMidnight: isMidnight,
      selectedLinkId: matchedSavedLink ? matchedSavedLink.id : CUSTOM_MEET_LINK_VALUE,
      customUrl: matchedSavedLink ? "" : meeting.meetUrl,
      participantUserIds: meeting.participants.map((p) => p.userId),
      errorMessage: null,
    });
  }

  function applyDurationPreset(minutes: number) {
    if (!meetingModal) return;
    const { hhmm, endAtMidnight } = addMinutesToHhmm(meetingModal.startTime, minutes);
    setMeetingModal({
      ...meetingModal,
      endTime: endAtMidnight ? "23:59" : hhmm,
      endAtMidnight,
    });
  }

  function toggleParticipant(userId: string) {
    if (!meetingModal) return;
    const exists = meetingModal.participantUserIds.includes(userId);
    const next = exists
      ? meetingModal.participantUserIds.filter((id) => id !== userId)
      : [...meetingModal.participantUserIds, userId];
    setMeetingModal({ ...meetingModal, participantUserIds: next });
  }

  async function handleSubmitMeeting(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!meetingModal) return;

    const effectiveEnd = meetingModal.endAtMidnight ? "24:00" : meetingModal.endTime;
    const isSavedLink = meetingModal.selectedLinkId !== CUSTOM_MEET_LINK_VALUE;

    setSubmitting(true);
    const payload = {
      title: meetingModal.title,
      description: meetingModal.description.trim() || null,
      date: meetingModal.date,
      startTime: meetingModal.startTime,
      endTime: effectiveEnd,
      meetLinkId: isSavedLink ? meetingModal.selectedLinkId : null,
      meetUrl: isSavedLink ? undefined : meetingModal.customUrl,
      participantUserIds: meetingModal.participantUserIds,
    };

    const result =
      meetingModal.mode === "create"
        ? await createProjectMeetingAction(projectId, payload)
        : await updateProjectMeetingAction(projectId, meetingModal.meetingId!, payload);

    setSubmitting(false);

    if (!result.ok) {
      setMeetingModal({ ...meetingModal, errorMessage: result.error.message });
      toast.error(result.error.message);
      return;
    }

    toast.success(
      meetingModal.mode === "create" ? "Đã tạo cuộc họp thành công." : "Đã cập nhật cuộc họp."
    );
    setMeetingModal(null);
    router.refresh();
  }

  async function handleCancelMeeting(meetingId: string) {
    setSubmitting(true);
    const res = await cancelProjectMeetingAction(projectId, meetingId);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Đã hủy cuộc họp.");
    router.refresh();
  }

  async function handleDeleteMeeting(meetingId: string) {
    setSubmitting(true);
    const res = await deleteProjectMeetingAction(projectId, meetingId);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Đã xóa cuộc họp.");
    router.refresh();
  }

  function openCreateLinkModal() {
    setLinkModal({
      mode: "create",
      label: "",
      url: "",
      description: "",
      isDefault: bundle.meetLinks.length === 0,
      errorMessage: null,
    });
  }

  function openEditLinkModal(link: MeetLinkDTO) {
    setLinkModal({
      mode: "edit",
      linkId: link.id,
      label: link.label,
      url: link.url,
      description: link.description ?? "",
      isDefault: link.isDefault,
      errorMessage: null,
    });
  }

  async function handleSubmitLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!linkModal) return;

    setSubmitting(true);
    const payload = {
      label: linkModal.label,
      url: linkModal.url,
      description: linkModal.description.trim() || null,
      isDefault: linkModal.isDefault,
    };
    const res =
      linkModal.mode === "create"
        ? await createMeetLinkAction(projectId, payload)
        : await updateMeetLinkAction(projectId, linkModal.linkId!, payload);
    setSubmitting(false);

    if (!res.ok) {
      setLinkModal({ ...linkModal, errorMessage: res.error.message });
      toast.error(res.error.message);
      return;
    }

    toast.success(
      linkModal.mode === "create" ? "Đã thêm link Google Meet." : "Đã cập nhật link Google Meet."
    );
    setLinkModal(null);
    router.refresh();
  }

  async function handleDeleteLink(linkId: string) {
    setSubmitting(true);
    const res = await deleteMeetLinkAction(projectId, linkId);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Đã xóa link Google Meet.");
    router.refresh();
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Đã sao chép link Google Meet.");
    } catch {
      toast.error("Không thể sao chép tự động, vui lòng copy trực tiếp.");
    }
  }

  return (
    <div className="space-y-6">
      {isArchived && (
        <Alert>
          <AlertTitle>Project đã lưu trữ (Archived · Chỉ xem)</AlertTitle>
          <AlertDescription>
            Project đang ở trạng thái ARCHIVED nên không thể tạo, sửa hoặc hủy cuộc họp / link Meet.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Meetings List Column */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Video className="h-5 w-5 text-primary" />
                  <span>Lịch cuộc họp ({visibleMeetings.length})</span>
                </CardTitle>
                <CardDescription>
                  Hệ thống tự động chặn tạo cuộc họp trong quá khứ hoặc trùng lịch bận Schedule.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <FreeSlotFinderDialog projectId={projectId} />
                {canManage && (
                  <Button type="button" size="sm" onClick={openCreateMeetingModal}>
                    <Plus className="h-4 w-4" />
                    <span>Tạo cuộc họp mới</span>
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="inline-flex rounded-md border border-border bg-muted/40 p-1">
                {(
                  [
                    { key: "UPCOMING", label: "Sắp tới" },
                    { key: "ALL", label: "Tất cả" },
                    { key: "CANCELLED", label: "Đã hủy" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setFilter(tab.key)}
                    className={`cursor-pointer rounded px-3 py-1 text-xs font-medium transition-colors ${
                      filter === tab.key
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {visibleMeetings.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  Chưa có cuộc họp nào trong danh mục này.
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleMeetings.map((meeting) => {
                    const isCancelled = meeting.status === ProjectMeetingStatus.CANCELLED;
                    const startMs = new Date(meeting.startAt).getTime();
                    const endMs = new Date(meeting.endAt).getTime();
                    const isPast = endMs < referenceNowMs;
                    const isOngoing =
                      !isCancelled && startMs <= referenceNowMs && endMs >= referenceNowMs;

                    return (
                      <div
                        key={meeting.id}
                        className="space-y-3 rounded-lg border border-border bg-card p-4"
                      >
                        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-foreground">{meeting.title}</h3>
                              {isCancelled ? (
                                <Badge variant="destructive">Đã hủy</Badge>
                              ) : isOngoing ? (
                                <Badge variant="default">Đang diễn ra</Badge>
                              ) : isPast ? (
                                <Badge variant="secondary">Đã kết thúc</Badge>
                              ) : (
                                <Badge variant="outline">Sắp diễn ra</Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                {formatHcmDateVi(meeting.date)}
                              </span>
                              <span className="inline-flex items-center gap-1 font-mono">
                                <Clock className="h-3.5 w-3.5" />
                                {meeting.startTime} – {meeting.endTime}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Users className="h-3.5 w-3.5" />
                                {meeting.participants.length} thành viên
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {!isCancelled && (
                              <Button asChild size="sm" variant="default">
                                <a href={meeting.meetUrl} target="_blank" rel="noreferrer noopener">
                                  <Video className="h-3.5 w-3.5" />
                                  <span>Tham gia Meet</span>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void copyUrl(meeting.meetUrl)}
                              title="Sao chép link Meet"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <CopyZaloButton
                              getText={() =>
                                formatMeetingZaloSummary({
                                  title: meeting.title,
                                  status: meeting.status,
                                  isOngoing,
                                  isPast,
                                  dateText: formatHcmDateVi(meeting.date),
                                  startTime: meeting.startTime,
                                  endTime: meeting.endTime,
                                  meetUrl: meeting.meetUrl,
                                  participantNames: meeting.participants.map((p) => p.fullName),
                                  description: meeting.description,
                                  meetingsUrl:
                                    typeof window !== "undefined"
                                      ? `${window.location.origin}/projects/${projectId}/meetings`
                                      : undefined,
                                })
                              }
                              successMessage="Đã copy biên bản cuộc họp chuẩn Zalo."
                            />
                            {!isArchived && (
                              <Button asChild size="sm" variant="outline" title="Tạo Task từ cuộc họp">
                                <Link
                                  href={`/projects/${projectId}/tasks/new?title=${encodeURIComponent(
                                    `[Họp] ${meeting.title}`
                                  )}${
                                    meeting.description
                                      ? `&description=${encodeURIComponent(meeting.description)}`
                                      : ""
                                  }`}
                                >
                                  <ListPlus className="h-3.5 w-3.5" />
                                  <span>Tạo Task</span>
                                </Link>
                              </Button>
                            )}
                            {canManage && !isCancelled && !isPast && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => openEditMeetingModal(meeting)}
                                title="Sửa cuộc họp"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {canManage && !isCancelled && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={submitting}
                                onClick={() => void handleCancelMeeting(meeting.id)}
                                title="Hủy cuộc họp"
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {canManage && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={submitting}
                                onClick={() => void handleDeleteMeeting(meeting.id)}
                                title="Xóa cuộc họp"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {meeting.description && (
                          <p className="whitespace-pre-line text-xs text-muted-foreground">
                            {meeting.description}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-1.5">
                          {meeting.participants.map((p) => (
                            <Badge key={p.userId} variant="secondary" className="text-[11px]">
                              {p.fullName}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Saved Meet Links Column */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Link2 className="h-4 w-4 text-primary" />
                  <span>Link Meet có sẵn ({bundle.meetLinks.length})</span>
                </CardTitle>
                <CardDescription className="mt-1 text-xs">
                  Lưu trữ link Google Meet cố định của nhóm để dùng lại nhanh.
                </CardDescription>
              </div>
              {canManage && (
                <Button type="button" size="sm" variant="outline" onClick={openCreateLinkModal}>
                  <Plus className="h-4 w-4" />
                  <span>Thêm</span>
                </Button>
              )}
            </CardHeader>

            <CardContent className="space-y-2.5">
              {bundle.meetLinks.length === 0 ? (
                <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Chưa có link Google Meet nào được lưu sẵn.
                </p>
              ) : (
                bundle.meetLinks.map((link) => (
                  <div
                    key={link.id}
                    className="space-y-1.5 rounded-lg border border-border bg-muted/20 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {link.label}
                          </span>
                          {link.isDefault && (
                            <Badge variant="default" className="px-1.5 py-0 text-[10px]">
                              <Star className="mr-0.5 h-2.5 w-2.5" />
                              Mặc định
                            </Badge>
                          )}
                        </div>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mt-0.5 block truncate text-xs text-primary hover:underline"
                        >
                          {link.url}
                        </a>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => void copyUrl(link.url)}
                          title="Sao chép link"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        {canManage && (
                          <>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => openEditLinkModal(link)}
                              title="Sửa link"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              disabled={submitting}
                              onClick={() => void handleDeleteLink(link.id)}
                              title="Xóa link"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {link.description && (
                      <p className="text-xs text-muted-foreground">{link.description}</p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create / Edit Meeting Dialog */}
      <Dialog open={meetingModal !== null} onOpenChange={(open) => !open && setMeetingModal(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {meetingModal && (
            <form onSubmit={handleSubmitMeeting} className="space-y-4">
              <DialogHeader>
                <DialogTitle>
                  {meetingModal.mode === "create"
                    ? "Tạo cuộc họp Google Meet"
                    : "Chỉnh sửa cuộc họp"}
                </DialogTitle>
                <DialogDescription>
                  Hệ thống sẽ kiểm tra thời gian không ở quá khứ và không trùng lịch bận trong
                  Schedule của các thành viên tham gia.
                </DialogDescription>
              </DialogHeader>

              {meetingModal.errorMessage && (
                <Alert variant="destructive">
                  <AlertTitle>Không thể lưu cuộc họp</AlertTitle>
                  <AlertDescription>{meetingModal.errorMessage}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="meeting-title">Tiêu đề cuộc họp *</Label>
                  <Input
                    id="meeting-title"
                    value={meetingModal.title}
                    onChange={(e) => setMeetingModal({ ...meetingModal, title: e.target.value })}
                    placeholder="VD: Sprint Planning / Họp tiến độ tuần"
                    maxLength={200}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="meeting-date">Ngày họp *</Label>
                  <Input
                    id="meeting-date"
                    type="date"
                    min={bundle.todayYmd}
                    value={meetingModal.date}
                    onChange={(e) => setMeetingModal({ ...meetingModal, date: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="meeting-start">Từ giờ *</Label>
                    <Input
                      id="meeting-start"
                      type="time"
                      value={meetingModal.startTime}
                      onChange={(e) =>
                        setMeetingModal({ ...meetingModal, startTime: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="meeting-end">Đến giờ *</Label>
                      <label className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={meetingModal.endAtMidnight}
                          onChange={(e) =>
                            setMeetingModal({ ...meetingModal, endAtMidnight: e.target.checked })
                          }
                        />
                        <span>24:00</span>
                      </label>
                    </div>
                    <Input
                      id="meeting-end"
                      type="time"
                      value={meetingModal.endAtMidnight ? "23:59" : meetingModal.endTime}
                      disabled={meetingModal.endAtMidnight}
                      onChange={(e) =>
                        setMeetingModal({ ...meetingModal, endTime: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Thời lượng nhanh:</span>
                  {[30, 60, 90].map((mins) => (
                    <Button
                      key={mins}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => applyDurationPreset(mins)}
                    >
                      +{mins} phút
                    </Button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="meeting-link-select">Link Google Meet *</Label>
                  <Select
                    value={meetingModal.selectedLinkId}
                    onValueChange={(value) =>
                      setMeetingModal({ ...meetingModal, selectedLinkId: value })
                    }
                  >
                    <SelectTrigger id="meeting-link-select">
                      <SelectValue placeholder="Chọn link Google Meet" />
                    </SelectTrigger>
                    <SelectContent>
                      {bundle.meetLinks.map((link) => (
                        <SelectItem key={link.id} value={link.id}>
                          {link.label} ({link.url})
                        </SelectItem>
                      ))}
                      <SelectItem value={CUSTOM_MEET_LINK_VALUE}>
                        Nhập link Google Meet mới...
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {meetingModal.selectedLinkId === CUSTOM_MEET_LINK_VALUE && (
                  <div className="space-y-1.5">
                    <Label htmlFor="meeting-custom-url">URL Google Meet *</Label>
                    <Input
                      id="meeting-custom-url"
                      type="url"
                      value={meetingModal.customUrl}
                      onChange={(e) =>
                        setMeetingModal({ ...meetingModal, customUrl: e.target.value })
                      }
                      placeholder="https://meet.google.com/abc-defg-hij"
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Thành viên tham gia (kiểm tra lịch bận) *</Label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setMeetingModal({
                            ...meetingModal,
                            participantUserIds: eligibleMembers.map((m) => m.userId),
                          })
                        }
                        className="cursor-pointer text-xs text-primary hover:underline"
                      >
                        Chọn tất cả
                      </button>
                      <button
                        type="button"
                        onClick={() => setMeetingModal({ ...meetingModal, participantUserIds: [] })}
                        className="cursor-pointer text-xs text-muted-foreground hover:underline"
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  </div>
                  <div className="grid max-h-40 gap-1.5 overflow-y-auto rounded-md border border-border p-2.5 sm:grid-cols-2">
                    {eligibleMembers.map((member) => {
                      const checked = meetingModal.participantUserIds.includes(member.userId);
                      return (
                        <label
                          key={member.userId}
                          className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-accent"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleParticipant(member.userId)}
                          />
                          <span className="truncate">{member.fullName}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="meeting-description">Nội dung / Ghi chú (Tùy chọn)</Label>
                  <Textarea
                    id="meeting-description"
                    value={meetingModal.description}
                    onChange={(e) =>
                      setMeetingModal({ ...meetingModal, description: e.target.value })
                    }
                    placeholder="Agenda cuộc họp, tài liệu cần chuẩn bị..."
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMeetingModal(null)}
                  disabled={submitting}
                >
                  Hủy
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{meetingModal.mode === "create" ? "Tạo cuộc họp" : "Lưu thay đổi"}</span>
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / Edit Meet Link Dialog */}
      <Dialog open={linkModal !== null} onOpenChange={(open) => !open && setLinkModal(null)}>
        <DialogContent className="sm:max-w-md">
          {linkModal && (
            <form onSubmit={handleSubmitLink} className="space-y-4">
              <DialogHeader>
                <DialogTitle>
                  {linkModal.mode === "create" ? "Thêm link Google Meet" : "Sửa link Google Meet"}
                </DialogTitle>
                <DialogDescription>
                  Lưu link phòng họp Google Meet chính thức (https://meet.google.com/...).
                </DialogDescription>
              </DialogHeader>

              {linkModal.errorMessage && (
                <Alert variant="destructive">
                  <AlertTitle>Không thể lưu link Meet</AlertTitle>
                  <AlertDescription>{linkModal.errorMessage}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="meet-link-label">Tên phòng / Nhãn *</Label>
                  <Input
                    id="meet-link-label"
                    value={linkModal.label}
                    onChange={(e) => setLinkModal({ ...linkModal, label: e.target.value })}
                    placeholder="VD: Phòng Daily Standup"
                    maxLength={150}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="meet-link-url">Link Google Meet *</Label>
                  <Input
                    id="meet-link-url"
                    type="url"
                    value={linkModal.url}
                    onChange={(e) => setLinkModal({ ...linkModal, url: e.target.value })}
                    placeholder="https://meet.google.com/abc-defg-hij"
                    maxLength={500}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="meet-link-desc">Ghi chú (Tùy chọn)</Label>
                  <Input
                    id="meet-link-desc"
                    value={linkModal.description}
                    onChange={(e) => setLinkModal({ ...linkModal, description: e.target.value })}
                    placeholder="Phòng họp cố định của team"
                    maxLength={500}
                  />
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={linkModal.isDefault}
                    onChange={(e) => setLinkModal({ ...linkModal, isDefault: e.target.checked })}
                  />
                  <span>Đặt làm link Meet mặc định khi tạo cuộc họp mới</span>
                </label>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLinkModal(null)}
                  disabled={submitting}
                >
                  Hủy
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{linkModal.mode === "create" ? "Thêm link" : "Lưu thay đổi"}</span>
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
