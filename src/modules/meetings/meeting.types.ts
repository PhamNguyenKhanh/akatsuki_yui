import { ProjectMeetingStatus } from "@prisma/client";
import { addDaysToYmd } from "@/lib/timezone";
import { minutesToHhmm } from "@/modules/schedule/schedule.types";

export interface MeetLinkDTO {
  id: string;
  projectId: string;
  label: string;
  url: string;
  description: string | null;
  isDefault: boolean;
  createdBy: {
    id: string;
    fullName: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface MeetingParticipantDTO {
  userId: string;
  fullName: string;
  email: string;
}

export interface ProjectMeetingDTO {
  id: string;
  projectId: string;
  meetLinkId: string | null;
  title: string;
  description: string | null;
  meetUrl: string;
  date: string;
  startMinute: number;
  endMinute: number;
  startTime: string;
  endTime: string;
  startAt: string;
  endAt: string;
  status: ProjectMeetingStatus;
  participants: MeetingParticipantDTO[];
  createdBy: {
    id: string;
    fullName: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMeetingsBundleDTO {
  projectId: string;
  todayYmd: string;
  nowIso: string;
  meetLinks: MeetLinkDTO[];
  meetings: ProjectMeetingDTO[];
  members: Array<{
    userId: string;
    fullName: string;
    email: string;
    projectRole: string;
  }>;
  capabilities: {
    canManage: boolean;
  };
}

/**
 * Converts a YYYY-MM-DD calendar date + HH:mm time in Asia/Ho_Chi_Minh (+07:00)
 * into a UTC Date instant (supporting 24:00 as next-day 00:00).
 */
export function buildHcmDateTimeInstant(dateYmd: string, hhmm: string): Date {
  if (hhmm === "24:00") {
    return new Date(`${addDaysToYmd(dateYmd, 1)}T00:00:00.000+07:00`);
  }
  return new Date(`${dateYmd}T${hhmm}:00.000+07:00`);
}

export function addMinutesToHhmm(
  hhmm: string,
  deltaMinutes: number
): {
  hhmm: string;
  endAtMidnight: boolean;
} {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + deltaMinutes;
  if (total >= 1440) {
    return { hhmm: "24:00", endAtMidnight: true };
  }
  return { hhmm: minutesToHhmm(total), endAtMidnight: false };
}
