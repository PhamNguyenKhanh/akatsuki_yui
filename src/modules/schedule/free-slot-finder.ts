import { ProjectMeetingStatus } from "@prisma/client";
import { hcmDateTimeInstant } from "@/lib/timezone";
import {
  minutesToHhmm,
  type ScheduleMemberOptionDTO,
  type ScheduleOccurrenceDTO,
  type WeekDayColumn,
} from "@/modules/schedule/schedule.types";

export const FREE_SLOT_DURATIONS = [60, 90, 120] as const;
export type FreeSlotDurationMinutes = (typeof FREE_SLOT_DURATIONS)[number];

export const FREE_SLOT_WINDOW_START_MINUTE = 7 * 60; // 07:00
export const FREE_SLOT_WINDOW_END_MINUTE = 23 * 60; // 23:00

export interface FreeSlotBusyMemberDTO {
  userId: string;
  fullName: string;
  reason: "SCHEDULE" | "MEETING";
}

export interface FreeSlotDTO {
  id: string;
  date: string;
  dayOfWeek: number;
  dayLabel: string;
  periodLabel: string;
  startMinute: number;
  endMinute: number;
  startTime: string;
  endTime: string;
  totalMembers: number;
  freeCount: number;
  busyMembers: FreeSlotBusyMemberDTO[];
  isAllFree: boolean;
}

export interface FreeSlotMeetingInput {
  id: string;
  date: string;
  startMinute: number;
  endMinute: number;
  status: ProjectMeetingStatus;
  participants: ReadonlyArray<{ userId: string }>;
}

export interface FindCommonFreeSlotsInput {
  days: readonly WeekDayColumn[];
  members: readonly ScheduleMemberOptionDTO[];
  occurrences: readonly ScheduleOccurrenceDTO[];
  meetings: readonly FreeSlotMeetingInput[];
  durationMinutes?: FreeSlotDurationMinutes;
  nowMs?: number;
  projectEndDate?: string;
  maxResults?: number;
}

export function getTimePeriodLabelVi(startMinute: number): string {
  if (startMinute < 12 * 60) return "Sáng";
  if (startMinute < 18 * 60) return "Chiều";
  return "Tối";
}

function getShortDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName.trim();
  return parts.slice(-2).join(" ");
}

/**
 * Scans 07:00-23:00 across the week's days, subtracting both personal busy schedules
 * (ProjectScheduleEntry occurrences) and SCHEDULED project meetings, then ranks the
 * best common free slots (100% free first, then fewest busy members).
 */
export function findCommonFreeSlots(input: FindCommonFreeSlotsInput): FreeSlotDTO[] {
  const duration = input.durationMinutes ?? 120;
  const nowMs = input.nowMs ?? Date.now();
  const maxResults = input.maxResults ?? 8;

  const trackableMembers = input.members.filter((m) => m.projectRole !== "INSTRUCTOR");
  const totalMembers = trackableMembers.length;
  if (totalMembers === 0) {
    return [];
  }

  const memberById = new Map(trackableMembers.map((m) => [m.userId, m]));
  const scheduledMeetings = input.meetings.filter(
    (m) => m.status === ProjectMeetingStatus.SCHEDULED
  );

  const candidates: FreeSlotDTO[] = [];

  for (const day of input.days) {
    if (input.projectEndDate && day.date > input.projectEndDate) {
      continue;
    }

    const dayOccurrences = input.occurrences.filter((occ) => occ.date === day.date);
    const dayMeetings = scheduledMeetings.filter((m) => m.date === day.date);

    for (
      let startMinute = FREE_SLOT_WINDOW_START_MINUTE;
      startMinute + duration <= FREE_SLOT_WINDOW_END_MINUTE;
      startMinute += 60
    ) {
      const endMinute = startMinute + duration;
      const startTime = minutesToHhmm(startMinute);
      const endTime = minutesToHhmm(endMinute);

      const slotEndInstant = hcmDateTimeInstant(day.date, endTime);
      if (slotEndInstant.getTime() <= nowMs) {
        continue;
      }

      const busyReasonByUser = new Map<string, "SCHEDULE" | "MEETING">();

      for (const occ of dayOccurrences) {
        if (occ.startMinute < endMinute && occ.endMinute > startMinute && memberById.has(occ.userId)) {
          busyReasonByUser.set(occ.userId, "SCHEDULE");
        }
      }

      for (const meeting of dayMeetings) {
        if (meeting.startMinute < endMinute && meeting.endMinute > startMinute) {
          if (meeting.participants.length > 0) {
            for (const p of meeting.participants) {
              if (memberById.has(p.userId) && !busyReasonByUser.has(p.userId)) {
                busyReasonByUser.set(p.userId, "MEETING");
              }
            }
          } else {
            for (const member of trackableMembers) {
              if (!busyReasonByUser.has(member.userId)) {
                busyReasonByUser.set(member.userId, "MEETING");
              }
            }
          }
        }
      }

      const busyMembers: FreeSlotBusyMemberDTO[] = [];
      for (const [userId, reason] of busyReasonByUser.entries()) {
        const member = memberById.get(userId);
        if (member) {
          busyMembers.push({
            userId,
            fullName: getShortDisplayName(member.fullName),
            reason,
          });
        }
      }

      const freeCount = totalMembers - busyMembers.length;
      if (freeCount <= 0) {
        continue;
      }

      candidates.push({
        id: `${day.date}-${startMinute}-${endMinute}`,
        date: day.date,
        dayOfWeek: day.dayOfWeek,
        dayLabel: day.fullLabel,
        periodLabel: getTimePeriodLabelVi(startMinute),
        startMinute,
        endMinute,
        startTime,
        endTime,
        totalMembers,
        freeCount,
        busyMembers,
        isAllFree: freeCount === totalMembers,
      });
    }
  }

  candidates.sort((a, b) => {
    if (b.freeCount !== a.freeCount) {
      return b.freeCount - a.freeCount;
    }
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    return a.startMinute - b.startMinute;
  });

  // Prefer up to 2 non-overlapping slots per day in pass 1 so results span the week nicely.
  const selected: FreeSlotDTO[] = [];
  const selectedIds = new Set<string>();
  const countByDate = new Map<string, number>();

  for (const slot of candidates) {
    if (selected.length >= maxResults) break;
    const dayCount = countByDate.get(slot.date) ?? 0;
    if (dayCount >= 2) continue;

    const overlapsSelectedOnDay = selected.some(
      (s) =>
        s.date === slot.date &&
        s.startMinute < slot.endMinute &&
        s.endMinute > slot.startMinute
    );
    if (overlapsSelectedOnDay) continue;

    selected.push(slot);
    selectedIds.add(slot.id);
    countByDate.set(slot.date, dayCount + 1);
  }

  if (selected.length < maxResults) {
    for (const slot of candidates) {
      if (selected.length >= maxResults) break;
      if (selectedIds.has(slot.id)) continue;
      selected.push(slot);
      selectedIds.add(slot.id);
    }
  }

  return selected;
}
