import "server-only";
import { ProjectMeetingStatus, type Prisma } from "@prisma/client";
import { acquireProjectUpdateLock } from "@/lib/db-locks";
import { badRequestError, conflictError, notFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { formatHcmDateVi, formatHcmYmd, getHcmIsoWeekStartYmd } from "@/lib/timezone";
import { listProjectMembersService } from "@/modules/project-members/member.service";
import { parseProjectId } from "@/modules/projects/project.access";
import {
  assertMeetingManageAccess,
  assertMeetingReadAccess,
  canActorManageProjectMeetings,
  parseMeetingId,
  parseMeetLinkId,
} from "@/modules/meetings/meeting.access";
import {
  mapMeetLinkToDTO,
  mapMeetingToDTO,
  meetingRepository,
} from "@/modules/meetings/meeting.repository";
import {
  createMeetLinkSchema,
  createProjectMeetingSchema,
  updateMeetLinkSchema,
  updateProjectMeetingSchema,
  type CreateMeetLinkInput,
  type CreateProjectMeetingInput,
  type UpdateMeetLinkInput,
  type UpdateProjectMeetingInput,
} from "@/modules/meetings/meeting.schema";
import {
  buildHcmDateTimeInstant,
  type MeetLinkDTO,
  type ProjectMeetingDTO,
  type ProjectMeetingsBundleDTO,
} from "@/modules/meetings/meeting.types";
import { toPgDateOnly } from "@/modules/schedule/schedule.repository";
import { expandScheduleEntriesForWeek } from "@/modules/schedule/schedule.service";
import {
  getIsoDayOfWeekFromYmd,
  hhmmToMinutes,
  minutesToHhmm,
} from "@/modules/schedule/schedule.types";
import type { AuthContext } from "@/types/auth";

export async function getProjectMeetingsBundleService(
  actor: AuthContext,
  projectId: string
): Promise<ProjectMeetingsBundleDTO> {
  const validProjectId = parseProjectId(projectId);
  const project = await assertMeetingReadAccess(actor, validProjectId);

  const [meetLinks, meetings, members] = await Promise.all([
    meetingRepository.listMeetLinks(validProjectId),
    meetingRepository.listMeetings(validProjectId),
    listProjectMembersService(actor, validProjectId, { includeHistory: false }),
  ]);

  return {
    projectId: validProjectId,
    todayYmd: formatHcmYmd(),
    nowIso: new Date().toISOString(),
    meetLinks: meetLinks.map(mapMeetLinkToDTO),
    meetings: meetings.map(mapMeetingToDTO),
    members: members.map((m) => ({
      userId: m.userId,
      fullName: m.user.fullName,
      email: m.user.email,
      projectRole: m.projectRole,
    })),
    capabilities: {
      canManage: canActorManageProjectMeetings(actor, project),
    },
  };
}

export async function createMeetLinkService(
  actor: AuthContext,
  projectId: string,
  rawInput: CreateMeetLinkInput
): Promise<MeetLinkDTO> {
  const validProjectId = parseProjectId(projectId);
  const input = createMeetLinkSchema.parse(rawInput);

  const created = await prisma.$transaction(async (tx) => {
    await assertMeetingManageAccess(actor, validProjectId, tx);
    await acquireProjectUpdateLock(tx, validProjectId);

    if (input.isDefault) {
      await meetingRepository.clearDefaultMeetLinks(validProjectId, undefined, tx);
    }

    const link = await meetingRepository.createMeetLink(
      {
        projectId: validProjectId,
        createdById: actor.userId,
        label: input.label,
        url: input.url,
        description: input.description,
        isDefault: input.isDefault,
      },
      tx
    );

    await tx.activityLog.create({
      data: {
        userId: actor.userId,
        projectId: validProjectId,
        action: "MEET_LINK_CREATED",
        entityType: "ProjectMeetLink",
        entityId: link.id,
        description: `Thêm link Google Meet "${link.label}".`,
      },
    });

    return link;
  });

  logger.info("Project Meet link created", {
    actorId: actor.userId,
    projectId: validProjectId,
    linkId: created.id,
  });

  return mapMeetLinkToDTO(created);
}

export async function updateMeetLinkService(
  actor: AuthContext,
  projectId: string,
  linkId: string,
  rawInput: UpdateMeetLinkInput
): Promise<MeetLinkDTO> {
  const validProjectId = parseProjectId(projectId);
  const validLinkId = parseMeetLinkId(linkId);
  const input = updateMeetLinkSchema.parse(rawInput);

  const updated = await prisma.$transaction(async (tx) => {
    await assertMeetingManageAccess(actor, validProjectId, tx);
    await acquireProjectUpdateLock(tx, validProjectId);

    const existing = await meetingRepository.findMeetLinkById(validProjectId, validLinkId, tx);
    if (!existing) {
      throw notFoundError("Không tìm thấy link Google Meet yêu cầu.");
    }

    if (input.isDefault) {
      await meetingRepository.clearDefaultMeetLinks(validProjectId, validLinkId, tx);
    }

    const link = await meetingRepository.updateMeetLink(
      validLinkId,
      {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.url !== undefined ? { url: input.url } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      },
      tx
    );

    await tx.activityLog.create({
      data: {
        userId: actor.userId,
        projectId: validProjectId,
        action: "MEET_LINK_UPDATED",
        entityType: "ProjectMeetLink",
        entityId: link.id,
        description: `Cập nhật link Google Meet "${link.label}".`,
      },
    });

    return link;
  });

  return mapMeetLinkToDTO(updated);
}

export async function deleteMeetLinkService(
  actor: AuthContext,
  projectId: string,
  linkId: string
): Promise<{ id: string; projectId: string }> {
  const validProjectId = parseProjectId(projectId);
  const validLinkId = parseMeetLinkId(linkId);

  await prisma.$transaction(async (tx) => {
    await assertMeetingManageAccess(actor, validProjectId, tx);
    await acquireProjectUpdateLock(tx, validProjectId);

    const existing = await meetingRepository.findMeetLinkById(validProjectId, validLinkId, tx);
    if (!existing) {
      throw notFoundError("Không tìm thấy link Google Meet yêu cầu.");
    }

    await meetingRepository.deleteMeetLink(validLinkId, tx);

    await tx.activityLog.create({
      data: {
        userId: actor.userId,
        projectId: validProjectId,
        action: "MEET_LINK_DELETED",
        entityType: "ProjectMeetLink",
        entityId: validLinkId,
        description: `Xóa link Google Meet "${existing.label}".`,
      },
    });
  });

  return { id: validLinkId, projectId: validProjectId };
}

async function assertParticipantsBelongToProject(
  tx: Prisma.TransactionClient,
  projectId: string,
  leaderId: string,
  participantUserIds: string[]
) {
  const activeMembers = await tx.projectMember.findMany({
    where: { projectId, leftAt: null },
    select: { userId: true },
  });
  const allowedIds = new Set<string>([leaderId, ...activeMembers.map((m) => m.userId)]);

  for (const userId of participantUserIds) {
    if (!allowedIds.has(userId)) {
      throw badRequestError("Có thành viên được chọn không thuộc Project này.", [
        { field: "participantUserIds", message: "Thành viên phải đang tham gia Project." },
      ]);
    }
  }
}

async function assertNoScheduleBusyConflicts(
  tx: Prisma.TransactionClient,
  params: {
    projectId: string;
    dateYmd: string;
    startMinute: number;
    endMinute: number;
    participantUserIds: string[];
  }
) {
  const targetDate = toPgDateOnly(params.dateYmd);
  const dayOfWeek = getIsoDayOfWeekFromYmd(params.dateYmd);

  const scheduleEntries = await tx.projectScheduleEntry.findMany({
    where: {
      projectId: params.projectId,
      userId: { in: params.participantUserIds },
      OR: [
        {
          isRecurring: false,
          date: targetDate,
        },
        {
          isRecurring: true,
          dayOfWeek,
          date: { lte: targetDate },
          OR: [{ repeatUntil: null }, { repeatUntil: { gte: targetDate } }],
        },
      ],
    },
    select: {
      id: true,
      projectId: true,
      userId: true,
      date: true,
      dayOfWeek: true,
      isRecurring: true,
      repeatUntil: true,
      startMinute: true,
      endMinute: true,
      note: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      exceptions: {
        where: { exceptionDate: targetDate },
        select: {
          id: true,
          exceptionDate: true,
          type: true,
          overrideStartMinute: true,
          overrideEndMinute: true,
          overrideNote: true,
        },
      },
    },
  });

  const weekStartYmd = getHcmIsoWeekStartYmd(params.dateYmd);
  const occurrences = expandScheduleEntriesForWeek(scheduleEntries, weekStartYmd, {
    actorUserId: "",
    canManageOwn: false,
    canDeleteAny: false,
  });

  const conflicts = occurrences.filter(
    (occ) =>
      occ.date === params.dateYmd &&
      occ.startMinute < params.endMinute &&
      occ.endMinute > params.startMinute
  );

  if (conflicts.length > 0) {
    const summary = conflicts
      .map((c) => `${c.userFullName} (${c.startTime}–${c.endTime})`)
      .join(", ");
    throw conflictError(
      "SCHEDULE_CONFLICT",
      `Không thể lên lịch họp vì có thành viên đang bận trong khung giờ này: ${summary}.`
    );
  }
}

async function resolveMeetingMeetUrl(
  tx: Prisma.TransactionClient,
  projectId: string,
  meetLinkId: string | null,
  rawMeetUrl: string | undefined
): Promise<{ meetLinkId: string | null; meetUrl: string }> {
  if (meetLinkId) {
    const link = await meetingRepository.findMeetLinkById(projectId, meetLinkId, tx);
    if (!link) {
      throw notFoundError("Link Google Meet đã chọn không tồn tại trong Project.");
    }
    return {
      meetLinkId: link.id,
      meetUrl: link.url,
    };
  }

  return {
    meetLinkId: null,
    meetUrl: rawMeetUrl!.trim(),
  };
}

export async function createProjectMeetingService(
  actor: AuthContext,
  projectId: string,
  rawInput: CreateProjectMeetingInput,
  referenceNow: Date = new Date()
): Promise<ProjectMeetingDTO> {
  const validProjectId = parseProjectId(projectId);
  const input = createProjectMeetingSchema.parse(rawInput);

  const startMinute = hhmmToMinutes(input.startTime);
  const endMinute = hhmmToMinutes(input.endTime);
  const startAt = buildHcmDateTimeInstant(input.date, input.startTime);
  const endAt = buildHcmDateTimeInstant(input.date, input.endTime);

  if (startAt.getTime() < referenceNow.getTime()) {
    throw badRequestError("Thời gian bắt đầu cuộc họp không được trước thời gian hiện tại.", [
      { field: "startTime", message: "Thời gian bắt đầu phải từ hiện tại trở đi." },
    ]);
  }

  const created = await prisma.$transaction(async (tx) => {
    const project = await assertMeetingManageAccess(actor, validProjectId, tx);
    await acquireProjectUpdateLock(tx, validProjectId);

    await assertParticipantsBelongToProject(
      tx,
      validProjectId,
      project.leaderId,
      input.participantUserIds
    );

    const { meetLinkId, meetUrl } = await resolveMeetingMeetUrl(
      tx,
      validProjectId,
      input.meetLinkId,
      input.meetUrl
    );

    await assertNoScheduleBusyConflicts(tx, {
      projectId: validProjectId,
      dateYmd: input.date,
      startMinute,
      endMinute,
      participantUserIds: input.participantUserIds,
    });

    const overlappingMeeting = await meetingRepository.findOverlappingScheduledMeeting(
      {
        projectId: validProjectId,
        date: toPgDateOnly(input.date),
        startMinute,
        endMinute,
      },
      tx
    );
    if (overlappingMeeting) {
      throw conflictError(
        "MEETING_TIME_CONFLICT",
        `Khung giờ bị trùng với cuộc họp "${overlappingMeeting.title}" (${minutesToHhmm(overlappingMeeting.startMinute)}–${minutesToHhmm(overlappingMeeting.endMinute)}).`
      );
    }

    const meeting = await meetingRepository.createMeeting(
      {
        projectId: validProjectId,
        meetLinkId,
        createdById: actor.userId,
        title: input.title,
        description: input.description,
        meetUrl,
        date: toPgDateOnly(input.date),
        startMinute,
        endMinute,
        startAt,
        endAt,
        participantUserIds: input.participantUserIds,
      },
      tx
    );

    await tx.activityLog.create({
      data: {
        userId: actor.userId,
        projectId: validProjectId,
        action: "MEETING_CREATED",
        entityType: "ProjectMeeting",
        entityId: meeting.id,
        description: `Tạo cuộc họp "${meeting.title}" ngày ${formatHcmDateVi(input.date)} (${input.startTime}–${input.endTime}).`,
      },
    });

    return meeting;
  });

  logger.info("Project meeting created", {
    actorId: actor.userId,
    projectId: validProjectId,
    meetingId: created.id,
  });

  return mapMeetingToDTO(created);
}

export async function updateProjectMeetingService(
  actor: AuthContext,
  projectId: string,
  meetingId: string,
  rawInput: UpdateProjectMeetingInput,
  referenceNow: Date = new Date()
): Promise<ProjectMeetingDTO> {
  const validProjectId = parseProjectId(projectId);
  const validMeetingId = parseMeetingId(meetingId);
  const input = updateProjectMeetingSchema.parse(rawInput);

  const startMinute = hhmmToMinutes(input.startTime);
  const endMinute = hhmmToMinutes(input.endTime);
  const startAt = buildHcmDateTimeInstant(input.date, input.startTime);
  const endAt = buildHcmDateTimeInstant(input.date, input.endTime);

  if (startAt.getTime() < referenceNow.getTime()) {
    throw badRequestError("Thời gian bắt đầu cuộc họp không được trước thời gian hiện tại.", [
      { field: "startTime", message: "Thời gian bắt đầu phải từ hiện tại trở đi." },
    ]);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const project = await assertMeetingManageAccess(actor, validProjectId, tx);
    await acquireProjectUpdateLock(tx, validProjectId);

    const existing = await meetingRepository.findMeetingById(validProjectId, validMeetingId, tx);
    if (!existing) {
      throw notFoundError("Không tìm thấy cuộc họp yêu cầu.");
    }
    if (existing.status === ProjectMeetingStatus.CANCELLED) {
      throw conflictError("MEETING_CANCELLED", "Không thể chỉnh sửa cuộc họp đã bị hủy.");
    }

    await assertParticipantsBelongToProject(
      tx,
      validProjectId,
      project.leaderId,
      input.participantUserIds
    );

    const { meetLinkId, meetUrl } = await resolveMeetingMeetUrl(
      tx,
      validProjectId,
      input.meetLinkId,
      input.meetUrl
    );

    await assertNoScheduleBusyConflicts(tx, {
      projectId: validProjectId,
      dateYmd: input.date,
      startMinute,
      endMinute,
      participantUserIds: input.participantUserIds,
    });

    const overlappingMeeting = await meetingRepository.findOverlappingScheduledMeeting(
      {
        projectId: validProjectId,
        date: toPgDateOnly(input.date),
        startMinute,
        endMinute,
        excludeMeetingId: validMeetingId,
      },
      tx
    );
    if (overlappingMeeting) {
      throw conflictError(
        "MEETING_TIME_CONFLICT",
        `Khung giờ bị trùng với cuộc họp "${overlappingMeeting.title}" (${minutesToHhmm(overlappingMeeting.startMinute)}–${minutesToHhmm(overlappingMeeting.endMinute)}).`
      );
    }

    const meeting = await meetingRepository.updateMeeting(
      validMeetingId,
      {
        meetLinkId,
        title: input.title,
        description: input.description,
        meetUrl,
        date: toPgDateOnly(input.date),
        startMinute,
        endMinute,
        startAt,
        endAt,
        participantUserIds: input.participantUserIds,
      },
      tx
    );

    await tx.activityLog.create({
      data: {
        userId: actor.userId,
        projectId: validProjectId,
        action: "MEETING_UPDATED",
        entityType: "ProjectMeeting",
        entityId: meeting.id,
        description: `Cập nhật cuộc họp "${meeting.title}" (${formatHcmDateVi(input.date)} ${input.startTime}–${input.endTime}).`,
      },
    });

    return meeting;
  });

  return mapMeetingToDTO(updated);
}

export async function cancelProjectMeetingService(
  actor: AuthContext,
  projectId: string,
  meetingId: string
): Promise<ProjectMeetingDTO> {
  const validProjectId = parseProjectId(projectId);
  const validMeetingId = parseMeetingId(meetingId);

  const cancelled = await prisma.$transaction(async (tx) => {
    await assertMeetingManageAccess(actor, validProjectId, tx);
    await acquireProjectUpdateLock(tx, validProjectId);

    const existing = await meetingRepository.findMeetingById(validProjectId, validMeetingId, tx);
    if (!existing) {
      throw notFoundError("Không tìm thấy cuộc họp yêu cầu.");
    }
    if (existing.status === ProjectMeetingStatus.CANCELLED) {
      throw conflictError("MEETING_ALREADY_CANCELLED", "Cuộc họp này đã được hủy trước đó.");
    }

    const meeting = await meetingRepository.cancelMeeting(validMeetingId, tx);

    await tx.activityLog.create({
      data: {
        userId: actor.userId,
        projectId: validProjectId,
        action: "MEETING_CANCELLED",
        entityType: "ProjectMeeting",
        entityId: meeting.id,
        description: `Hủy cuộc họp "${meeting.title}".`,
      },
    });

    return meeting;
  });

  return mapMeetingToDTO(cancelled);
}

export async function deleteProjectMeetingService(
  actor: AuthContext,
  projectId: string,
  meetingId: string
): Promise<{ id: string; projectId: string }> {
  const validProjectId = parseProjectId(projectId);
  const validMeetingId = parseMeetingId(meetingId);

  await prisma.$transaction(async (tx) => {
    await assertMeetingManageAccess(actor, validProjectId, tx);
    await acquireProjectUpdateLock(tx, validProjectId);

    const existing = await meetingRepository.findMeetingById(validProjectId, validMeetingId, tx);
    if (!existing) {
      throw notFoundError("Không tìm thấy cuộc họp yêu cầu.");
    }

    await meetingRepository.deleteMeeting(validMeetingId, tx);

    await tx.activityLog.create({
      data: {
        userId: actor.userId,
        projectId: validProjectId,
        action: "MEETING_DELETED",
        entityType: "ProjectMeeting",
        entityId: validMeetingId,
        description: `Xóa cuộc họp "${existing.title}".`,
      },
    });
  });

  return { id: validMeetingId, projectId: validProjectId };
}
