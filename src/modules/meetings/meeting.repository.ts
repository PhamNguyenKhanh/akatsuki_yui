import "server-only";
import { type Prisma, ProjectMeetingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sanitizeGoogleMeetReadUrl } from "@/lib/safe-url";
import { formatPgDateYmd } from "@/lib/timezone";
import type { MeetLinkDTO, ProjectMeetingDTO } from "@/modules/meetings/meeting.types";
import { minutesToHhmm } from "@/modules/schedule/schedule.types";

const meetLinkSelect = {
  id: true,
  projectId: true,
  label: true,
  url: true,
  description: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: {
      id: true,
      fullName: true,
    },
  },
} satisfies Prisma.ProjectMeetLinkSelect;

const meetingSelect = {
  id: true,
  projectId: true,
  meetLinkId: true,
  title: true,
  description: true,
  meetUrl: true,
  date: true,
  startMinute: true,
  endMinute: true,
  startAt: true,
  endAt: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: {
      id: true,
      fullName: true,
    },
  },
  participants: {
    select: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
    orderBy: {
      user: {
        fullName: "asc",
      },
    },
  },
} satisfies Prisma.ProjectMeetingSelect;

type MeetLinkRecord = Prisma.ProjectMeetLinkGetPayload<{ select: typeof meetLinkSelect }>;
type MeetingRecord = Prisma.ProjectMeetingGetPayload<{ select: typeof meetingSelect }>;

export function mapMeetLinkToDTO(record: MeetLinkRecord): MeetLinkDTO {
  return {
    id: record.id,
    projectId: record.projectId,
    label: record.label,
    url: sanitizeGoogleMeetReadUrl(record.url) ?? record.url,
    description: record.description,
    isDefault: record.isDefault,
    createdBy: record.createdBy,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function mapMeetingToDTO(record: MeetingRecord): ProjectMeetingDTO {
  return {
    id: record.id,
    projectId: record.projectId,
    meetLinkId: record.meetLinkId,
    title: record.title,
    description: record.description,
    meetUrl: sanitizeGoogleMeetReadUrl(record.meetUrl) ?? record.meetUrl,
    date: formatPgDateYmd(record.date),
    startMinute: record.startMinute,
    endMinute: record.endMinute,
    startTime: minutesToHhmm(record.startMinute),
    endTime: minutesToHhmm(record.endMinute),
    startAt: record.startAt.toISOString(),
    endAt: record.endAt.toISOString(),
    status: record.status,
    participants: record.participants.map((p) => ({
      userId: p.user.id,
      fullName: p.user.fullName,
      email: p.user.email,
    })),
    createdBy: record.createdBy,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export const meetingRepository = {
  async listMeetLinks(projectId: string) {
    return prisma.projectMeetLink.findMany({
      where: { projectId },
      select: meetLinkSelect,
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  },

  async findMeetLinkById(projectId: string, linkId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.projectMeetLink.findFirst({
      where: { id: linkId, projectId },
      select: meetLinkSelect,
    });
  },

  async clearDefaultMeetLinks(
    projectId: string,
    excludeLinkId?: string,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.projectMeetLink.updateMany({
      where: {
        projectId,
        isDefault: true,
        ...(excludeLinkId ? { id: { not: excludeLinkId } } : {}),
      },
      data: { isDefault: false },
    });
  },

  async createMeetLink(
    data: {
      projectId: string;
      createdById: string;
      label: string;
      url: string;
      description: string | null;
      isDefault: boolean;
    },
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.projectMeetLink.create({
      data,
      select: meetLinkSelect,
    });
  },

  async updateMeetLink(
    linkId: string,
    data: {
      label?: string;
      url?: string;
      description?: string | null;
      isDefault?: boolean;
    },
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.projectMeetLink.update({
      where: { id: linkId },
      data,
      select: meetLinkSelect,
    });
  },

  async deleteMeetLink(linkId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.projectMeetLink.delete({
      where: { id: linkId },
      select: { id: true, label: true },
    });
  },

  async listMeetings(projectId: string) {
    return prisma.projectMeeting.findMany({
      where: { projectId },
      select: meetingSelect,
      orderBy: [{ status: "asc" }, { startAt: "asc" }],
    });
  },

  async findMeetingById(
    projectId: string,
    meetingId: string,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.projectMeeting.findFirst({
      where: { id: meetingId, projectId },
      select: meetingSelect,
    });
  },

  async findOverlappingScheduledMeeting(
    params: {
      projectId: string;
      date: Date;
      startMinute: number;
      endMinute: number;
      excludeMeetingId?: string;
    },
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.projectMeeting.findFirst({
      where: {
        projectId: params.projectId,
        status: ProjectMeetingStatus.SCHEDULED,
        date: params.date,
        startMinute: { lt: params.endMinute },
        endMinute: { gt: params.startMinute },
        ...(params.excludeMeetingId ? { id: { not: params.excludeMeetingId } } : {}),
      },
      select: {
        id: true,
        title: true,
        startMinute: true,
        endMinute: true,
      },
    });
  },

  async createMeeting(
    data: {
      projectId: string;
      meetLinkId: string | null;
      createdById: string;
      title: string;
      description: string | null;
      meetUrl: string;
      date: Date;
      startMinute: number;
      endMinute: number;
      startAt: Date;
      endAt: Date;
      participantUserIds: string[];
    },
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.projectMeeting.create({
      data: {
        projectId: data.projectId,
        meetLinkId: data.meetLinkId,
        createdById: data.createdById,
        title: data.title,
        description: data.description,
        meetUrl: data.meetUrl,
        date: data.date,
        startMinute: data.startMinute,
        endMinute: data.endMinute,
        startAt: data.startAt,
        endAt: data.endAt,
        participants: {
          createMany: {
            data: data.participantUserIds.map((userId) => ({ userId })),
          },
        },
      },
      select: meetingSelect,
    });
  },

  async updateMeeting(
    meetingId: string,
    data: {
      meetLinkId: string | null;
      title: string;
      description: string | null;
      meetUrl: string;
      date: Date;
      startMinute: number;
      endMinute: number;
      startAt: Date;
      endAt: Date;
      participantUserIds: string[];
    },
    tx: Prisma.TransactionClient = prisma
  ) {
    await tx.projectMeetingParticipant.deleteMany({
      where: { meetingId },
    });

    return tx.projectMeeting.update({
      where: { id: meetingId },
      data: {
        meetLinkId: data.meetLinkId,
        title: data.title,
        description: data.description,
        meetUrl: data.meetUrl,
        date: data.date,
        startMinute: data.startMinute,
        endMinute: data.endMinute,
        startAt: data.startAt,
        endAt: data.endAt,
        participants: {
          createMany: {
            data: data.participantUserIds.map((userId) => ({ userId })),
          },
        },
      },
      select: meetingSelect,
    });
  },

  async cancelMeeting(meetingId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.projectMeeting.update({
      where: { id: meetingId },
      data: { status: ProjectMeetingStatus.CANCELLED },
      select: meetingSelect,
    });
  },

  async deleteMeeting(meetingId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.projectMeeting.delete({
      where: { id: meetingId },
      select: { id: true, title: true },
    });
  },
};
