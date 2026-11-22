"use client";

import * as React from "react";
import {
  CalendarSearch,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { QuickCreateMeetingDialog } from "@/components/meetings/quick-create-meeting-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { addDaysToYmd } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import type {
  FreeSlotDTO,
  FreeSlotDurationMinutes,
} from "@/modules/schedule/free-slot-finder";
import {
  getFreeSlotsBundleAction,
  type FreeSlotsBundleDTO,
} from "@/modules/schedule/schedule.actions";

function formatShortDdMm(ymd: string): string {
  const [, month, day] = ymd.split("-");
  return `${day}/${month}`;
}

export interface FreeSlotFinderDialogProps {
  projectId: string;
  initialWeekStart?: string;
  disabled?: boolean;
  triggerVariant?: "default" | "outline" | "secondary";
  triggerSize?: "default" | "sm" | "lg";
  triggerClassName?: string;
  onSelectSlot?: (slot: FreeSlotDTO, bundle: FreeSlotsBundleDTO) => void;
}

const DURATION_OPTIONS: ReadonlyArray<{ value: FreeSlotDurationMinutes; label: string }> = [
  { value: 60, label: "1 giờ" },
  { value: 90, label: "1.5 giờ" },
  { value: 120, label: "2 giờ" },
];

export function FreeSlotFinderDialog({
  projectId,
  initialWeekStart,
  disabled = false,
  triggerVariant = "outline",
  triggerSize = "sm",
  triggerClassName,
  onSelectSlot,
}: FreeSlotFinderDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [weekStart, setWeekStart] = React.useState<string | undefined>(initialWeekStart);
  const [durationMinutes, setDurationMinutes] = React.useState<FreeSlotDurationMinutes>(120);
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [bundle, setBundle] = React.useState<FreeSlotsBundleDTO | null>(null);
  const [selectedSlotForCreate, setSelectedSlotForCreate] = React.useState<FreeSlotDTO | null>(
    null
  );

  const loadSlots = React.useCallback(
    async (targetWeekStart: string | undefined, targetDuration: FreeSlotDurationMinutes) => {
      setLoading(true);
      setErrorMessage(null);
      const res = await getFreeSlotsBundleAction(projectId, {
        ...(targetWeekStart ? { weekStart: targetWeekStart } : {}),
        durationMinutes: targetDuration,
      });
      setLoading(false);

      if (!res.ok) {
        setErrorMessage(res.error.message);
        toast.error(res.error.message);
        return;
      }

      setBundle(res.data);
      setWeekStart(res.data.weekStart);
    },
    [projectId]
  );

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setWeekStart(initialWeekStart);
      void loadSlots(initialWeekStart, durationMinutes);
    }
  }

  function handleChangeWeek(deltaDays: number) {
    const base = weekStart ?? bundle?.weekStart;
    if (!base) return;
    const nextWeek = addDaysToYmd(base, deltaDays);
    setWeekStart(nextWeek);
    void loadSlots(nextWeek, durationMinutes);
  }

  function handleChangeDuration(nextDuration: FreeSlotDurationMinutes) {
    setDurationMinutes(nextDuration);
    void loadSlots(weekStart, nextDuration);
  }

  function handleSlotClick(slot: FreeSlotDTO) {
    if (!bundle) return;
    if (!bundle.canManageMeetings) {
      toast.info("Chỉ Project Leader hoặc Admin mới có quyền tạo lịch họp.");
      return;
    }
    if (onSelectSlot) {
      setOpen(false);
      onSelectSlot(slot, bundle);
      return;
    }
    setOpen(false);
    setSelectedSlotForCreate(slot);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant={triggerVariant}
            size={triggerSize}
            disabled={disabled}
            className={triggerClassName}
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>Tìm giờ rảnh chung</span>
          </Button>
        </DialogTrigger>

        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarSearch className="h-5 w-5 text-primary" />
              <span>Tìm &quot;Giờ Hoàng Đạo&quot; họp nhóm</span>
            </DialogTitle>
            <DialogDescription>
              Quét lịch bận và các cuộc họp đã lên lịch trong khung 07:00 – 23:00 để gợi ý khung
              giờ cả nhóm dễ tụ họp nhất.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-2.5">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2"
                disabled={loading || !bundle}
                onClick={() => handleChangeWeek(-7)}
                title="Tuần trước"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[126px] text-center text-xs font-medium">
                {bundle
                  ? `${formatShortDdMm(bundle.weekStart)} – ${formatShortDdMm(bundle.weekEnd)}`
                  : "Đang tải tuần..."}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2"
                disabled={loading || !bundle}
                onClick={() => handleChangeWeek(7)}
                title="Tuần sau"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={loading}
                  onClick={() => handleChangeDuration(opt.value)}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium transition",
                    durationMinutes === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {errorMessage && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span>Đang quét lịch rảnh cả nhóm...</span>
            </div>
          ) : bundle && bundle.slots.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Không tìm thấy khung giờ khả dụng nào trong tuần này (tất cả khung giờ đều đã qua
              hoặc kín lịch). Hãy thử chuyển sang tuần sau hoặc rút ngắn thời lượng họp.
            </div>
          ) : (
            <div className="space-y-2">
              {bundle?.slots.map((slot) => {
                const busyText =
                  slot.busyMembers.length > 0
                    ? slot.busyMembers
                        .map(
                          (m) =>
                            `${m.fullName} (${m.reason === "MEETING" ? "Họp khác" : "Lịch bận"})`
                        )
                        .join(", ")
                    : null;

                return (
                  <div
                    key={slot.id}
                    className={cn(
                      "flex flex-col justify-between gap-2 rounded-lg border p-3 transition sm:flex-row sm:items-center",
                      slot.isAllFree
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : "border-amber-500/35 bg-amber-500/5"
                    )}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm" aria-hidden="true">
                          {slot.isAllFree ? "🟢" : "🟡"}
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {slot.periodLabel} {slot.dayLabel}, {formatShortDdMm(slot.date)}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded bg-background px-1.5 py-0.5 font-mono text-xs font-medium text-foreground ring-1 ring-border">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {slot.startTime} – {slot.endTime}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge
                          variant={slot.isAllFree ? "default" : "secondary"}
                          className={cn(
                            "text-[11px]",
                            slot.isAllFree &&
                              "bg-emerald-600 text-white hover:bg-emerald-600"
                          )}
                        >
                          <Users className="mr-1 h-3 w-3" />
                          {slot.isAllFree
                            ? `Cả nhóm ${slot.freeCount}/${slot.totalMembers} rảnh`
                            : `${slot.freeCount}/${slot.totalMembers} người rảnh`}
                        </Badge>
                        {busyText && (
                          <span className="truncate text-muted-foreground">
                            Vướng: {busyText}
                          </span>
                        )}
                      </div>
                    </div>

                    {bundle.canManageMeetings && (
                      <Button
                        type="button"
                        size="sm"
                        variant={slot.isAllFree ? "default" : "outline"}
                        className="shrink-0"
                        onClick={() => handleSlotClick(slot)}
                      >
                        <Video className="h-3.5 w-3.5" />
                        <span>Tạo lịch họp</span>
                      </Button>
                    )}
                  </div>
                );
              })}

              {bundle && !bundle.canManageMeetings && (
                <p className="pt-1 text-center text-xs text-muted-foreground">
                  Chỉ Project Leader hoặc Admin mới có quyền chốt lịch họp từ gợi ý này.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {bundle && selectedSlotForCreate && (
        <QuickCreateMeetingDialog
          open={Boolean(selectedSlotForCreate)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setSelectedSlotForCreate(null);
          }}
          projectId={projectId}
          meetLinks={bundle.meetLinks}
          members={bundle.members}
          initialDate={selectedSlotForCreate.date}
          initialStartTime={selectedSlotForCreate.startTime}
          initialEndTime={selectedSlotForCreate.endTime}
        />
      )}
    </>
  );
}
