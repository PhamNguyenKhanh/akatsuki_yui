"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, toActionError } from "@/lib/request";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { hasPermission } from "@/modules/authorization/policy.service";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { getProjectMeetingsBundleService } from "@/modules/meetings/meeting.service";
import type { MeetLinkDTO } from "@/modules/meetings/meeting.types";
import {
  findCommonFreeSlots,
  FREE_SLOT_DURATIONS,
  type FreeSlotDTO,
  type FreeSlotDurationMinutes,
} from "@/modules/schedule/free-slot-finder";
import type {
  CreateScheduleEntryInput,
  DeleteScheduleEntryInput,
  UpdateScheduleEntryInput,
} from "@/modules/schedule/schedule.schema";
import {
  createScheduleEntryService,
  deleteScheduleEntryService,
  getProjectWeeklyScheduleService,
  updateScheduleEntryService,
} from "@/modules/schedule/schedule.service";
import type { ScheduleMemberOptionDTO } from "@/modules/schedule/schedule.types";

function revalidateSchedulePaths(projectId: string) {
  revalidatePath(`/projects/${projectId}/schedule`);
  revalidatePath(`/projects/${projectId}`);
}

export async function createScheduleEntryAction(
  projectId: string,
  input: CreateScheduleEntryInput
): Promise<ActionResult<{ id: string; projectId: string; date: string }>> {
  try {
    const actor = await requireActiveUser();
    const result = await createScheduleEntryService(actor, projectId, input);
    revalidateSchedulePaths(result.projectId);
    return { ok: true, data: result };
  } catch (error) {
    return toActionError(error, { action: "createScheduleEntryAction" });
  }
}

export async function updateScheduleEntryAction(
  projectId: string,
  entryId: string,
  input: UpdateScheduleEntryInput
): Promise<ActionResult<{ id: string; projectId: string }>> {
  try {
    const actor = await requireActiveUser();
    const result = await updateScheduleEntryService(actor, projectId, entryId, input);
    revalidateSchedulePaths(result.projectId);
    return { ok: true, data: result };
  } catch (error) {
    return toActionError(error, { action: "updateScheduleEntryAction" });
  }
}

export async function deleteScheduleEntryAction(
  projectId: string,
  entryId: string,
  input: DeleteScheduleEntryInput
): Promise<ActionResult<{ id: string; projectId: string }>> {
  try {
    const actor = await requireActiveUser();
    const result = await deleteScheduleEntryService(actor, projectId, entryId, input);
    revalidateSchedulePaths(result.projectId);
    return { ok: true, data: result };
  } catch (error) {
    return toActionError(error, { action: "deleteScheduleEntryAction" });
  }
}

export interface FreeSlotsBundleDTO {
  projectId: string;
  weekStart: string;
  weekEnd: string;
  todayYmd: string;
  durationMinutes: FreeSlotDurationMinutes;
  totalMembers: number;
  slots: FreeSlotDTO[];
  meetLinks: MeetLinkDTO[];
  members: ScheduleMemberOptionDTO[];
  canManageMeetings: boolean;
}

export async function getFreeSlotsBundleAction(
  projectId: string,
  options?: {
    weekStart?: string;
    durationMinutes?: FreeSlotDurationMinutes;
  }
): Promise<ActionResult<FreeSlotsBundleDTO>> {
  try {
    const actor = await requireActiveUser();
    const durationMinutes: FreeSlotDurationMinutes =
      options?.durationMinutes && FREE_SLOT_DURATIONS.includes(options.durationMinutes)
        ? options.durationMinutes
        : 120;

    const schedule = await getProjectWeeklyScheduleService(actor, projectId, {
      ...(options?.weekStart ? { weekStart: options.weekStart } : {}),
    });

    const canReadMeetings = hasPermission(actor, PERMISSIONS.MEETING_READ);
    const meetingBundle = canReadMeetings
      ? await getProjectMeetingsBundleService(actor, projectId)
      : null;

    const nowMs = Date.parse(schedule.nowIso);
    const slots = findCommonFreeSlots({
      days: schedule.days,
      members: schedule.members,
      occurrences: schedule.occurrences,
      meetings: meetingBundle?.meetings ?? [],
      durationMinutes,
      nowMs: Number.isFinite(nowMs) ? nowMs : Date.now(),
      projectEndDate: schedule.projectEndDate,
      maxResults: 8,
    });

    const trackableMembers = schedule.members.filter((m) => m.projectRole !== "INSTRUCTOR");

    return {
      ok: true,
      data: {
        projectId: schedule.projectId,
        weekStart: schedule.weekStart,
        weekEnd: schedule.weekEnd,
        todayYmd: schedule.todayYmd,
        durationMinutes,
        totalMembers: trackableMembers.length,
        slots,
        meetLinks: meetingBundle?.meetLinks ?? [],
        members: trackableMembers,
        canManageMeetings: meetingBundle?.capabilities.canManage ?? false,
      },
    };
  } catch (error) {
    return toActionError(error, { action: "getFreeSlotsBundleAction" });
  }
}
