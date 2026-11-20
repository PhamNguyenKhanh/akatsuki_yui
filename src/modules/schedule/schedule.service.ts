import "server-only";
import { ScheduleExceptionType } from "@prisma/client";
import { badRequestError, notFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  addDaysToYmd,
  formatHcmDateVi,
  formatHcmYmd,
  formatPgDateYmd,
  getHcmIsoWeekStartYmd,
  hcmDateTimeInstant,
  toProjectCalendarYmd,
} from "@/lib/timezone";
import { listProjectMembersService } from "@/modules/project-members/member.service";
import { parseProjectId } from "@/modules/projects/project.access";
import {
  assertCanCreateOwnSchedule,
  assertCanDeleteScheduleEntry,
  assertCanUpdateScheduleEntry,
  assertScheduleReadAccess,
  canActorManageOwnSchedule,
  isProjectLeaderOrAdmin,
  parseScheduleEntryId,
} from "@/modules/schedule/schedule.access";
import {
  scheduleRepository,
  type ScheduleEntryWithExceptionsRecord,
} from "@/modules/schedule/schedule.repository";
import {
  createScheduleEntrySchema,
  deleteScheduleEntrySchema,
  scheduleWeekQuerySchema,
  updateScheduleEntrySchema,
  type CreateScheduleEntryInput,
  type DeleteScheduleEntryInput,
  type UpdateScheduleEntryInput,
} from "@/modules/schedule/schedule.schema";
import {
  buildWeekDayColumns,
  computeRepeatUntilFromWeeks,
  computeRepeatWeeksFromRange,
  getIsoDayOfWeekFromYmd,
  hhmmToMinutes,
  minutesToHhmm,
  type ProjectWeeklyScheduleDTO,
  type ScheduleMemberOptionDTO,
  type ScheduleOccurrenceDTO,
} from "@/modules/schedule/schedule.types";
import type { AuthContext } from "@/types/auth";

/**
 * Expands raw non-recurring and recurring schedule entries into concrete week occurrences
 * across `[weekStartYmd, weekStartYmd + 6d]`, honoring per-date CANCELLED/OVERRIDDEN exceptions.
 */
export function expandScheduleEntriesForWeek(
  entries: readonly ScheduleEntryWithExceptionsRecord[],
  weekStartYmd: string,
  permissions: {
    actorUserId: string;
    canManageOwn: boolean;
    canDeleteAny: boolean;
  }
): ScheduleOccurrenceDTO[] {
  const days = buildWeekDayColumns(weekStartYmd);
  const weekStart = days[0]!.date;
  const weekEnd = days[6]!.date;
  const dateByWeekday = new Map<number, string>(days.map((d) => [d.dayOfWeek, d.date]));

  const occurrences: ScheduleOccurrenceDTO[] = [];

  for (const entry of entries) {
    const seriesStartDate = formatPgDateYmd(entry.date);
    const repeatUntilYmd = entry.repeatUntil ? formatPgDateYmd(entry.repeatUntil) : null;

    let targetDateYmd: string | null = null;
    if (!entry.isRecurring) {
      if (seriesStartDate >= weekStart && seriesStartDate <= weekEnd) {
        targetDateYmd = seriesStartDate;
      }
    } else {
      const candidate = dateByWeekday.get(entry.dayOfWeek) ?? null;
      if (
        candidate &&
        candidate >= seriesStartDate &&
        (!repeatUntilYmd || candidate <= repeatUntilYmd)
      ) {
        targetDateYmd = candidate;
      }
    }

    if (!targetDateYmd) continue;

    const exception = entry.exceptions.find(
      (ex) => formatPgDateYmd(ex.exceptionDate) === targetDateYmd
    );
    if (exception?.type === ScheduleExceptionType.CANCELLED) {
      continue;
    }

    const isOverridden = exception?.type === ScheduleExceptionType.OVERRIDDEN;
    const startMinute =
      isOverridden && exception.overrideStartMinute !== null
        ? exception.overrideStartMinute
        : entry.startMinute;
    const endMinute =
      isOverridden && exception.overrideEndMinute !== null
        ? exception.overrideEndMinute
        : entry.endMinute;
    const note = isOverridden ? exception.overrideNote : entry.note;

    const isOwner = entry.userId === permissions.actorUserId;
    const canEdit = isOwner && permissions.canManageOwn;
    const canDelete = (isOwner && permissions.canManageOwn) || permissions.canDeleteAny;
    const repeatWeeks =
      entry.isRecurring && repeatUntilYmd
        ? computeRepeatWeeksFromRange(seriesStartDate, repeatUntilYmd)
        : null;

    occurrences.push({
      entryId: entry.id,
      projectId: entry.projectId,
      userId: entry.userId,
      userFullName: entry.user.fullName,
      userEmail: entry.user.email,
      date: targetDateYmd,
      seriesStartDate,
      dayOfWeek: getIsoDayOfWeekFromYmd(targetDateYmd),
      startMinute,
      endMinute,
      startTime: minutesToHhmm(startMinute),
      endTime: minutesToHhmm(endMinute),
      note,
      isRecurring: entry.isRecurring,
      repeatUntil: repeatUntilYmd,
      repeatWeeks,
      isOverridden,
      canEdit,
      canDelete,
    });
  }

  occurrences.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
    if (a.endMinute !== b.endMinute) return a.endMinute - b.endMinute;
    return a.userFullName.localeCompare(b.userFullName, "vi");
  });

  return occurrences;
}

export async function getProjectWeeklyScheduleService(
  actor: AuthContext,
  projectId: string,
  rawQuery: Record<string, unknown> = {}
): Promise<ProjectWeeklyScheduleDTO> {
  const validProjectId = parseProjectId(projectId);
  const project = await assertScheduleReadAccess(actor, validProjectId);

  const parsed = scheduleWeekQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    throw badRequestError(
      parsed.error.issues[0]?.message ?? "Tham số truy vấn lịch bận không hợp lệ.",
      parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "weekStart",
        message: issue.message,
      }))
    );
  }

  const todayYmd = formatHcmYmd();
  const baseDate = parsed.data.weekStart ?? todayYmd;
  const weekStart = getHcmIsoWeekStartYmd(baseDate);
  const weekEnd = addDaysToYmd(weekStart, 6);
  const days = buildWeekDayColumns(weekStart);

  const [entries, projectMembers] = await Promise.all([
    scheduleRepository.findWeekEntries(validProjectId, weekStart, weekEnd, parsed.data.userId),
    listProjectMembersService(actor, validProjectId, { includeHistory: false }),
  ]);

  const members: ScheduleMemberOptionDTO[] = projectMembers.map((m) => ({
    userId: m.userId,
    fullName: m.user.fullName,
    email: m.user.email,
    projectRole: m.projectRole,
  }));

  const canCreateOwn = canActorManageOwnSchedule(actor, project);
  const isArchived = project.status === "ARCHIVED";
  const canDeleteAny = !isArchived && isProjectLeaderOrAdmin(actor, project);

  const occurrences = expandScheduleEntriesForWeek(entries, weekStart, {
    actorUserId: actor.userId,
    canManageOwn: canCreateOwn,
    canDeleteAny,
  });

  return {
    projectId: validProjectId,
    projectStartDate: toProjectCalendarYmd(project.startDate),
    projectEndDate: toProjectCalendarYmd(project.endDate),
    weekStart,
    weekEnd,
    todayYmd,
    nowIso: new Date().toISOString(),
    days,
    members,
    occurrences,
    capabilities: {
      canCreateOwn,
      canDeleteAny,
    },
  };
}

function resolveScheduleRepeatUntilYmd(params: {
  startDateYmd: string;
  isRecurring: boolean;
  repeatWeeks: number | null;
  projectEndYmd: string;
}): string | null {
  if (params.startDateYmd > params.projectEndYmd) {
    throw badRequestError(
      `Không thể tạo lịch bận vượt quá thời hạn cuối cùng của Project (${formatHcmDateVi(params.projectEndYmd)}).`,
      [{ field: "date", message: "Ngày không được vượt quá ngày kết thúc Project." }]
    );
  }

  if (!params.isRecurring) {
    return null;
  }

  if (params.repeatWeeks !== null) {
    const computedEndYmd = computeRepeatUntilFromWeeks(params.startDateYmd, params.repeatWeeks);
    if (computedEndYmd > params.projectEndYmd) {
      throw badRequestError(
        `Lịch lặp lại ${params.repeatWeeks} tuần (đến ngày ${formatHcmDateVi(computedEndYmd)}) vượt quá thời hạn cuối cùng của Project (${formatHcmDateVi(params.projectEndYmd)}).`,
        [{ field: "repeatWeeks", message: "Số tuần lặp lại vượt quá hạn chót Project." }]
      );
    }
    return computedEndYmd;
  }

  return params.projectEndYmd;
}

export async function createScheduleEntryService(
  actor: AuthContext,
  projectId: string,
  rawInput: CreateScheduleEntryInput,
  referenceNow: Date = new Date()
): Promise<{ id: string; projectId: string; date: string }> {
  const validProjectId = parseProjectId(projectId);
  const input = createScheduleEntrySchema.parse(rawInput);

  const startInstant = hcmDateTimeInstant(input.date, input.startTime);
  if (startInstant.getTime() < referenceNow.getTime()) {
    throw badRequestError("Không thể tạo lịch bận trước thời gian hiện tại.", [
      { field: "startTime", message: "Thời gian bắt đầu phải từ hiện tại trở đi." },
    ]);
  }

  const startMinute = hhmmToMinutes(input.startTime);
  const endMinute = hhmmToMinutes(input.endTime);
  const dayOfWeek = getIsoDayOfWeekFromYmd(input.date);

  const created = await prisma.$transaction(async (tx) => {
    const project = await assertScheduleReadAccess(actor, validProjectId, tx);
    assertCanCreateOwnSchedule(actor, project);

    const projectEndYmd = toProjectCalendarYmd(project.endDate);
    const repeatUntilYmd = resolveScheduleRepeatUntilYmd({
      startDateYmd: input.date,
      isRecurring: input.isRecurring,
      repeatWeeks: input.repeatWeeks,
      projectEndYmd,
    });

    const entry = await scheduleRepository.createEntry(
      {
        projectId: validProjectId,
        userId: actor.userId,
        dateYmd: input.date,
        dayOfWeek,
        isRecurring: input.isRecurring,
        repeatUntilYmd,
        startMinute,
        endMinute,
        note: input.note,
      },
      tx
    );

    const repeatLabel = input.isRecurring
      ? input.repeatWeeks !== null
        ? ` · Lặp lại ${input.repeatWeeks} tuần`
        : " · Lặp lại đến hết Project"
      : "";

    await tx.activityLog.create({
      data: {
        userId: actor.userId,
        projectId: validProjectId,
        action: "SCHEDULE_CREATED",
        entityType: "ProjectScheduleEntry",
        entityId: entry.id,
        description: `Ghi chú lịch bận ngày ${input.date} (${input.startTime}–${input.endTime})${repeatLabel}.`,
      },
    });

    return entry;
  });

  logger.info("Project schedule entry created", {
    actorId: actor.userId,
    projectId: validProjectId,
    entryId: created.id,
    isRecurring: created.isRecurring,
  });

  return {
    id: created.id,
    projectId: created.projectId,
    date: formatPgDateYmd(created.date),
  };
}

export async function updateScheduleEntryService(
  actor: AuthContext,
  projectId: string,
  entryId: string,
  rawInput: UpdateScheduleEntryInput
): Promise<{ id: string; projectId: string }> {
  const validProjectId = parseProjectId(projectId);
  const validEntryId = parseScheduleEntryId(entryId);
  const input = updateScheduleEntrySchema.parse(rawInput);

  const startMinute = hhmmToMinutes(input.startTime);
  const endMinute = hhmmToMinutes(input.endTime);

  const result = await prisma.$transaction(async (tx) => {
    const project = await assertScheduleReadAccess(actor, validProjectId, tx);
    const existing = await scheduleRepository.findByIdInProject(validProjectId, validEntryId, tx);
    if (!existing) {
      throw notFoundError("Không tìm thấy khung giờ bận yêu cầu.");
    }

    assertCanUpdateScheduleEntry(actor, project, existing.userId);

    const projectEndYmd = toProjectCalendarYmd(project.endDate);
    const seriesStartYmd = formatPgDateYmd(existing.date);

    if (existing.isRecurring && input.scope === "THIS_WEEK") {
      if (input.occurrenceDate < seriesStartYmd) {
        throw badRequestError("Ngày ngoại lệ không thể sớm hơn ngày bắt đầu chuỗi lặp lại.");
      }
      if (input.occurrenceDate > projectEndYmd) {
        throw badRequestError(
          `Không thể cập nhật lịch bận vượt quá thời hạn cuối cùng của Project (${formatHcmDateVi(projectEndYmd)}).`
        );
      }

      await scheduleRepository.upsertException(
        {
          entryId: existing.id,
          exceptionDateYmd: input.occurrenceDate,
          type: ScheduleExceptionType.OVERRIDDEN,
          overrideStartMinute: startMinute,
          overrideEndMinute: endMinute,
          overrideNote: input.note,
        },
        tx
      );

      await tx.activityLog.create({
        data: {
          userId: actor.userId,
          projectId: validProjectId,
          action: "SCHEDULE_UPDATED",
          entityType: "ProjectScheduleEntry",
          entityId: existing.id,
          description: `Cập nhật lịch bận riêng ngày ${input.occurrenceDate} (${input.startTime}–${input.endTime}).`,
        },
      });

      return { id: existing.id, projectId: validProjectId };
    }

    if (
      existing.isRecurring &&
      input.scope === "THIS_AND_FUTURE" &&
      input.occurrenceDate > seriesStartYmd
    ) {
      const splitEndYmd = addDaysToYmd(input.occurrenceDate, -1);
      await scheduleRepository.updateEntry(existing.id, { repeatUntilYmd: splitEndYmd }, tx);
      await scheduleRepository.deleteExceptionsFromDate(existing.id, input.occurrenceDate, tx);

      const newStartDateYmd = input.date ?? input.occurrenceDate;
      const nextRepeatUntilYmd = resolveScheduleRepeatUntilYmd({
        startDateYmd: newStartDateYmd,
        isRecurring: input.isRecurring,
        repeatWeeks: input.repeatWeeks,
        projectEndYmd,
      });

      const newEntry = await scheduleRepository.createEntry(
        {
          projectId: validProjectId,
          userId: existing.userId,
          dateYmd: newStartDateYmd,
          dayOfWeek: getIsoDayOfWeekFromYmd(newStartDateYmd),
          isRecurring: input.isRecurring,
          repeatUntilYmd: nextRepeatUntilYmd,
          startMinute,
          endMinute,
          note: input.note,
        },
        tx
      );

      await tx.activityLog.create({
        data: {
          userId: actor.userId,
          projectId: validProjectId,
          action: "SCHEDULE_UPDATED",
          entityType: "ProjectScheduleEntry",
          entityId: newEntry.id,
          description: `Cập nhật lịch bận từ ngày ${newStartDateYmd} (${input.startTime}–${input.endTime}).`,
        },
      });

      return { id: newEntry.id, projectId: validProjectId };
    }

    const nextDateYmd = input.date ?? seriesStartYmd;
    const nextDayOfWeek = getIsoDayOfWeekFromYmd(nextDateYmd);
    const nextRepeatUntilYmd = resolveScheduleRepeatUntilYmd({
      startDateYmd: nextDateYmd,
      isRecurring: input.isRecurring,
      repeatWeeks: input.repeatWeeks,
      projectEndYmd,
    });

    if (!input.isRecurring || nextDayOfWeek !== existing.dayOfWeek) {
      await scheduleRepository.deleteAllExceptionsForEntry(existing.id, tx);
    }

    await scheduleRepository.updateEntry(
      existing.id,
      {
        dateYmd: nextDateYmd,
        dayOfWeek: nextDayOfWeek,
        isRecurring: input.isRecurring,
        repeatUntilYmd: nextRepeatUntilYmd,
        startMinute,
        endMinute,
        note: input.note,
      },
      tx
    );

    await tx.activityLog.create({
      data: {
        userId: actor.userId,
        projectId: validProjectId,
        action: "SCHEDULE_UPDATED",
        entityType: "ProjectScheduleEntry",
        entityId: existing.id,
        description: `Cập nhật lịch bận ngày ${nextDateYmd} (${input.startTime}–${input.endTime}).`,
      },
    });

    return { id: existing.id, projectId: validProjectId };
  });

  logger.info("Project schedule entry updated", {
    actorId: actor.userId,
    projectId: validProjectId,
    entryId: result.id,
    scope: input.scope,
  });

  return result;
}

export async function deleteScheduleEntryService(
  actor: AuthContext,
  projectId: string,
  entryId: string,
  rawInput: DeleteScheduleEntryInput
): Promise<{ id: string; projectId: string }> {
  const validProjectId = parseProjectId(projectId);
  const validEntryId = parseScheduleEntryId(entryId);
  const input = deleteScheduleEntrySchema.parse(rawInput);

  await prisma.$transaction(async (tx) => {
    const project = await assertScheduleReadAccess(actor, validProjectId, tx);
    const existing = await scheduleRepository.findByIdInProject(validProjectId, validEntryId, tx);
    if (!existing) {
      throw notFoundError("Không tìm thấy khung giờ bận yêu cầu.");
    }

    assertCanDeleteScheduleEntry(actor, project, existing.userId);

    const seriesStartYmd = formatPgDateYmd(existing.date);

    if (existing.isRecurring && input.scope === "THIS_WEEK") {
      await scheduleRepository.upsertException(
        {
          entryId: existing.id,
          exceptionDateYmd: input.occurrenceDate,
          type: ScheduleExceptionType.CANCELLED,
          overrideStartMinute: null,
          overrideEndMinute: null,
          overrideNote: null,
        },
        tx
      );

      await tx.activityLog.create({
        data: {
          userId: actor.userId,
          projectId: validProjectId,
          action: "SCHEDULE_DELETED",
          entityType: "ProjectScheduleEntry",
          entityId: existing.id,
          description: `Bỏ lịch bận ngày ${input.occurrenceDate} (${minutesToHhmm(existing.startMinute)}–${minutesToHhmm(existing.endMinute)}).`,
        },
      });
      return;
    }

    if (
      existing.isRecurring &&
      input.scope === "THIS_AND_FUTURE" &&
      input.occurrenceDate > seriesStartYmd
    ) {
      const splitEndYmd = addDaysToYmd(input.occurrenceDate, -1);
      await scheduleRepository.updateEntry(existing.id, { repeatUntilYmd: splitEndYmd }, tx);
      await scheduleRepository.deleteExceptionsFromDate(existing.id, input.occurrenceDate, tx);

      await tx.activityLog.create({
        data: {
          userId: actor.userId,
          projectId: validProjectId,
          action: "SCHEDULE_DELETED",
          entityType: "ProjectScheduleEntry",
          entityId: existing.id,
          description: `Dừng lịch bận lặp lại của ${existing.user.fullName} từ ngày ${input.occurrenceDate}.`,
        },
      });
      return;
    }

    await scheduleRepository.deleteEntry(existing.id, tx);

    await tx.activityLog.create({
      data: {
        userId: actor.userId,
        projectId: validProjectId,
        action: "SCHEDULE_DELETED",
        entityType: "ProjectScheduleEntry",
        entityId: existing.id,
        description: `Xóa lịch bận của ${existing.user.fullName} (${minutesToHhmm(existing.startMinute)}–${minutesToHhmm(existing.endMinute)}).`,
      },
    });
  });

  logger.info("Project schedule entry deleted", {
    actorId: actor.userId,
    projectId: validProjectId,
    entryId: validEntryId,
    scope: input.scope,
  });

  return { id: validEntryId, projectId: validProjectId };
}
