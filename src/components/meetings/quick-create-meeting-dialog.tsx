"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, CheckCircle2, Clock, Loader2, Video } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { CopyZaloButton } from "@/components/shared/copy-zalo-button";
import { formatHcmDateVi } from "@/lib/timezone";
import { formatMeetingZaloSummary } from "@/lib/zalo-summary";
import { createProjectMeetingAction } from "@/modules/meetings/meeting.actions";
import type { MeetLinkDTO, ProjectMeetingDTO } from "@/modules/meetings/meeting.types";
import type { ScheduleMemberOptionDTO } from "@/modules/schedule/schedule.types";

const CUSTOM_MEET_LINK_VALUE = "__CUSTOM__";

export interface QuickCreateMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  meetLinks: readonly MeetLinkDTO[];
  members: readonly ScheduleMemberOptionDTO[];
  initialDate: string;
  initialStartTime: string;
  initialEndTime: string;
  onCreated?: (meeting: ProjectMeetingDTO) => void;
}

export function QuickCreateMeetingDialog({
  open,
  onOpenChange,
  projectId,
  meetLinks,
  members,
  initialDate,
  initialStartTime,
  initialEndTime,
  onCreated,
}: QuickCreateMeetingDialogProps) {
  const router = useRouter();
  const eligibleMembers = React.useMemo(
    () => members.filter((m) => m.projectRole !== "INSTRUCTOR"),
    [members]
  );
  const defaultLink = React.useMemo(
    () => meetLinks.find((l) => l.isDefault) ?? meetLinks[0] ?? null,
    [meetLinks]
  );

  const [title, setTitle] = React.useState("");
  const [date, setDate] = React.useState(initialDate);
  const [startTime, setStartTime] = React.useState(initialStartTime);
  const [endTime, setEndTime] = React.useState(
    initialEndTime === "24:00" ? "23:59" : initialEndTime
  );
  const [selectedLinkId, setSelectedLinkId] = React.useState(
    defaultLink?.id ?? CUSTOM_MEET_LINK_VALUE
  );
  const [customUrl, setCustomUrl] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [participantUserIds, setParticipantUserIds] = React.useState<string[]>(() =>
    eligibleMembers.map((m) => m.userId)
  );
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [createdMeeting, setCreatedMeeting] = React.useState<ProjectMeetingDTO | null>(null);

  function toggleParticipant(userId: string) {
    setParticipantUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const isCustom = selectedLinkId === CUSTOM_MEET_LINK_VALUE;
    const normalizedEnd = initialEndTime === "24:00" && endTime === "23:59" ? "24:00" : endTime;

    setSubmitting(true);
    const result = await createProjectMeetingAction(projectId, {
      title: title.trim(),
      description: description.trim() || null,
      date,
      startTime,
      endTime: normalizedEnd,
      meetLinkId: isCustom ? null : selectedLinkId,
      meetUrl: isCustom ? customUrl.trim() : undefined,
      participantUserIds,
    });
    setSubmitting(false);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      toast.error(result.error.message);
      return;
    }

    toast.success("Đã tạo lịch họp thành công.");
    setCreatedMeeting(result.data);
    onCreated?.(result.data);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {createdMeeting ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                <span>Đã chốt lịch họp thành công!</span>
              </DialogTitle>
              <DialogDescription>
                Copy tin nhắn bên dưới để gửi ngay vào group Zalo của nhóm.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3.5 text-sm">
              <p className="font-semibold text-foreground">{createdMeeting.title}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatHcmDateVi(createdMeeting.date)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {createdMeeting.startTime} – {createdMeeting.endTime}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-primary">
                <Video className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{createdMeeting.meetUrl}</span>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              <Button asChild type="button" variant="outline" size="sm">
                <Link href={`/projects/${projectId}/meetings`}>Mở trang Cuộc họp</Link>
              </Button>
              <div className="flex items-center gap-2">
                <CopyZaloButton
                  variant="default"
                  size="sm"
                  label="Copy tin nhắn Zalo"
                  successMessage="Đã copy tin nhắn mời họp chuẩn Zalo!"
                  getText={() =>
                    formatMeetingZaloSummary({
                      title: createdMeeting.title,
                      status: createdMeeting.status,
                      isOngoing: false,
                      isPast: false,
                      dateText: formatHcmDateVi(createdMeeting.date),
                      startTime: createdMeeting.startTime,
                      endTime: createdMeeting.endTime,
                      meetUrl: createdMeeting.meetUrl,
                      participantNames: createdMeeting.participants.map((p) => p.fullName),
                      description: createdMeeting.description,
                      meetingsUrl:
                        typeof window !== "undefined"
                          ? `${window.location.origin}/projects/${projectId}/meetings`
                          : undefined,
                    })
                  }
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                  Đóng
                </Button>
              </div>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Video className="h-5 w-5 text-primary" />
                <span>Tạo nhanh cuộc họp</span>
              </DialogTitle>
              <DialogDescription>
                Ngày và khung giờ đã được điền sẵn. Nhập tiêu đề và chọn link họp để chốt lịch.
              </DialogDescription>
            </DialogHeader>

            {errorMessage && (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="quick-meeting-title">Tiêu đề cuộc họp *</Label>
              <Input
                id="quick-meeting-title"
                required
                maxLength={120}
                placeholder="Ví dụ: Họp Review Sprint & Chia task tuần mới"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="quick-meeting-date">Ngày họp *</Label>
                <Input
                  id="quick-meeting-date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quick-meeting-start">Bắt đầu *</Label>
                <Input
                  id="quick-meeting-start"
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quick-meeting-end">Kết thúc *</Label>
                <Input
                  id="quick-meeting-end"
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quick-meeting-link">Link Google Meet *</Label>
              <Select value={selectedLinkId} onValueChange={setSelectedLinkId}>
                <SelectTrigger id="quick-meeting-link">
                  <SelectValue placeholder="Chọn link Google Meet" />
                </SelectTrigger>
                <SelectContent>
                  {meetLinks.map((link) => (
                    <SelectItem key={link.id} value={link.id}>
                      {link.label}
                      {link.isDefault ? " (Mặc định)" : ""}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_MEET_LINK_VALUE}>Nhập link Google Meet khác...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedLinkId === CUSTOM_MEET_LINK_VALUE && (
              <div className="space-y-1.5">
                <Label htmlFor="quick-meeting-custom-url">URL Google Meet *</Label>
                <Input
                  id="quick-meeting-custom-url"
                  type="url"
                  required
                  placeholder="https://meet.google.com/xxx-xxxx-xxx"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Thành viên tham gia ({participantUserIds.length}/{eligibleMembers.length})</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setParticipantUserIds(eligibleMembers.map((m) => m.userId))}
                    className="text-xs text-primary hover:underline"
                  >
                    Chọn tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => setParticipantUserIds([])}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>
              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-border p-2">
                {eligibleMembers.map((member) => {
                  const selected = participantUserIds.includes(member.userId);
                  return (
                    <button
                      key={member.userId}
                      type="button"
                      onClick={() => toggleParticipant(member.userId)}
                      className={
                        selected
                          ? "rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                          : "rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent"
                      }
                    >
                      {member.fullName}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quick-meeting-desc">Nội dung / Agenda (không bắt buộc)</Label>
              <Textarea
                id="quick-meeting-desc"
                rows={2}
                maxLength={500}
                placeholder="Các đầu mục cần trao đổi trong buổi họp..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Tạo lịch họp</span>
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
