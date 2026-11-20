import "server-only";
import { type Prisma, ScheduleExceptionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addDaysToYmd, formatHcmYmd, HCM_UTC_OFFSET_MS } from "@/lib/timezone";
import { getIsoDayOfWeekFromYmd } from "@/modules/schedule/schedule.types";

const scheduleEntrySelect = {
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
    select: {
      id: true,
      exceptionDate: true,
      type: true,
      overrideStartMinute: true,
      overrideEndMinute: true,
      overrideNote: true,
    },
  },
} satisfies Prisma.ProjectScheduleEntrySelect;

export type ScheduleEntryWithExceptionsRecord = Prisma.ProjectScheduleEntryGetPayload<{
  select: typeof scheduleEntrySelect;
}>;

export function toPgDateOnly(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

export const scheduleRepository = {
  async findWeekEntries(
    projectId: string,
    weekStartYmd: string,
    weekEndYmd: string,
    filterUserId?: string
  ): Promise<ScheduleEntryWithExceptionsRecord[]> {
    const weekStart = toPgDateOnly(weekStartYmd);
    const weekEnd = toPgDateOnly(weekEndYmd);

    return prisma.projectScheduleEntry.findMany({
      where: {
        projectId,
        ...(filterUserId ? { userId: filterUserId } : {}),
        OR: [
          {
            isRecurring: false,
            date: { gte: weekStart, lte: weekEnd },
          },
          {
            isRecurring: true,
            date: { lte: weekEnd },
            OR: [{ repeatUntil: null }, { repeatUntil: { gte: weekStart } }],
          },
        ],
      },
      select: {
        ...scheduleEntrySelect,
        exceptions: {
          where: {
            exceptionDate: { gte: weekStart, lte: weekEnd },
          },
          select: scheduleEntrySelect.exceptions.select,
        },
      },
      orderBy: [{ startMinute: "asc" }, { createdAt: "asc" }],
    });
  },

  async findByIdInProject(
    projectId: string,
    entryId: string,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.projectScheduleEntry.findFirst({
      where: {
        id: entryId,
        projectId,
      },
      select: scheduleEntrySelect,
    });
  },

  async createEntry(
    data: {
      projectId: string;
      userId: string;
      dateYmd: string;
      dayOfWeek: number;
      isRecurring: boolean;
      repeatUntilYmd?: string | null;
      startMinute: number;
      endMinute: number;
      note: string | null;
    },
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.projectScheduleEntry.create({
      data: {
        projectId: data.projectId,
        userId: data.userId,
        date: toPgDateOnly(data.dateYmd),
        dayOfWeek: data.dayOfWeek,
        isRecurring: data.isRecurring,
        repeatUntil: data.repeatUntilYmd ? toPgDateOnly(data.repeatUntilYmd) : null,
        startMinute: data.startMinute,
        endMinute: data.endMinute,
        note: data.note,
      },
      select: scheduleEntrySelect,
    });
  },

  async updateEntry(
    entryId: string,
    data: {
      dateYmd?: string;
      dayOfWeek?: number;
      isRecurring?: boolean;
      repeatUntilYmd?: string | null;
      startMinute?: number;
      endMinute?: number;
      note?: string | null;
    },
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.projectScheduleEntry.update({
      where: { id: entryId },
      data: {
        ...(data.dateYmd !== undefined ? { date: toPgDateOnly(data.dateYmd) } : {}),
        ...(data.dayOfWeek !== undefined ? { dayOfWeek: data.dayOfWeek } : {}),
        ...(data.isRecurring !== undefined ? { isRecurring: data.isRecurring } : {}),
        ...(data.repeatUntilYmd !== undefined
          ? { repeatUntil: data.repeatUntilYmd ? toPgDateOnly(data.repeatUntilYmd) : null }
          : {}),
        ...(data.startMinute !== undefined ? { startMinute: data.startMinute } : {}),
        ...(data.endMinute !== undefined ? { endMinute: data.endMinute } : {}),
        ...(data.note !== undefined ? { note: data.note } : {}),
      },
      select: scheduleEntrySelect,
    });
  },

  async deleteEntry(entryId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.projectScheduleEntry.delete({
      where: { id: entryId },
      select: { id: true },
    });
  },

  async upsertException(
    data: {
      entryId: string;
      exceptionDateYmd: string;
      type: ScheduleExceptionType;
      overrideStartMinute: number | null;
      overrideEndMinute: number | null;
      overrideNote: string | null;
    },
    tx: Prisma.TransactionClient = prisma
  ) {
    const exceptionDate = toPgDateOnly(data.exceptionDateYmd);
    return tx.projectScheduleException.upsert({
      where: {
        entryId_exceptionDate: {
          entryId: data.entryId,
          exceptionDate,
        },
      },
      update: {
        type: data.type,
        overrideStartMinute: data.overrideStartMinute,
        overrideEndMinute: data.overrideEndMinute,
        overrideNote: data.overrideNote,
      },
      create: {
        entryId: data.entryId,
        exceptionDate,
        type: data.type,
        overrideStartMinute: data.overrideStartMinute,
        overrideEndMinute: data.overrideEndMinute,
        overrideNote: data.overrideNote,
      },
    });
  },

  async deleteExceptionsFromDate(
    entryId: string,
    fromDateYmd: string,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.projectScheduleException.deleteMany({
      where: {
        entryId,
        exceptionDate: { gte: toPgDateOnly(fromDateYmd) },
      },
    });
  },

  async deleteAllExceptionsForEntry(entryId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.projectScheduleException.deleteMany({
      where: { entryId },
    });
  },

  /**
   * Purges or truncates all schedule entries/exceptions from `archivedAt` onward
   * when a Project transitions to ARCHIVED, keeping historical slots prior to archive intact.
   */
  async purgeScheduleEntriesFromArchive(
    projectId: string,
    archivedAt: Date,
    tx: Prisma.TransactionClient = prisma
  ) {
    const archivedYmd = formatHcmYmd(archivedAt);
    const hcmDate = new Date(archivedAt.getTime() + HCM_UTC_OFFSET_MS);
    const archivedMinute = hcmDate.getUTCHours() * 60 + hcmDate.getUTCMinutes();
    const archivedPgDate = toPgDateOnly(archivedYmd);
    const yesterdayPgDate = toPgDateOnly(addDaysToYmd(archivedYmd, -1));
    const archivedIsoDay = getIsoDayOfWeekFromYmd(archivedYmd);

    // 1. Delete non-recurring entries at or after archivedAt
    await tx.projectScheduleEntry.deleteMany({
      where: {
        projectId,
        isRecurring: false,
        OR: [
          { date: { gt: archivedPgDate } },
          { date: archivedPgDate, startMinute: { gte: archivedMinute } },
        ],
      },
    });

    // 2. Delete recurring series whose very first occurrence hasn't started by archivedAt
    await tx.projectScheduleEntry.deleteMany({
      where: {
        projectId,
        isRecurring: true,
        OR: [
          { date: { gt: archivedPgDate } },
          { date: archivedPgDate, startMinute: { gte: archivedMinute } },
        ],
      },
    });

    // 3. Delete exceptions strictly after archive date, or today if slot starts at/after archive time
    await tx.projectScheduleException.deleteMany({
      where: {
        entry: { projectId },
        OR: [
          { exceptionDate: { gt: archivedPgDate } },
          {
            exceptionDate: archivedPgDate,
            OR: [
              { overrideStartMinute: { gte: archivedMinute } },
              {
                overrideStartMinute: null,
                entry: { startMinute: { gte: archivedMinute } },
              },
            ],
          },
        ],
      },
    });

    // 4. Truncate ongoing recurring series whose today occurrence is at/after archive time -> yesterday
    await tx.projectScheduleEntry.updateMany({
      where: {
        projectId,
        isRecurring: true,
        date: { lt: archivedPgDate },
        dayOfWeek: archivedIsoDay,
        startMinute: { gte: archivedMinute },
        OR: [{ repeatUntil: null }, { repeatUntil: { gte: archivedPgDate } }],
      },
      data: {
        repeatUntil: yesterdayPgDate,
      },
    });

    // 5. Truncate remaining ongoing recurring series -> archived date
    await tx.projectScheduleEntry.updateMany({
      where: {
        projectId,
        isRecurring: true,
        date: { lte: archivedPgDate },
        OR: [{ repeatUntil: null }, { repeatUntil: { gt: archivedPgDate } }],
      },
      data: {
        repeatUntil: archivedPgDate,
      },
    });
  },
};
