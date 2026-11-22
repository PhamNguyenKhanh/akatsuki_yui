import "server-only";
import { NotificationType, ProjectMeetingStatus, TaskPriority, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sanitizeExternalHttpUrl } from "@/lib/safe-url";
import { formatPgDateYmd } from "@/lib/timezone";
import { buildAccessibleProjectsWhere, isWorkspaceAdmin } from "@/modules/projects/project.access";
import { minutesToHhmm } from "@/modules/schedule/schedule.types";
import type { AuthContext } from "@/types/auth";

export interface MyDayMeetingItemDTO {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  meetUrl: string | null;
  date: string;
  startTime: string;
  endTime: string;
  startAt: string;
  endAt: string;
  isOngoing: boolean;
}

export interface MyDayTaskItemDTO {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  priority: TaskPriority;
  deadline: string;
  isOverdue: boolean;
}

export interface MyDayMentionItemDTO {
  id: string;
  title: string;
  message: string;
  targetUrl: string | null;
  createdAt: string;
}

export interface MyDayFocusDTO {
  upcomingMeetings: MyDayMeetingItemDTO[];
  inProgressTasks: MyDayTaskItemDTO[];
  unreadMentions: MyDayMentionItemDTO[];
}

export async function getMyDayFocusService(
  actor: AuthContext,
  now: Date = new Date()
): Promise<MyDayFocusDTO> {
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const projectScopeWhere = isWorkspaceAdmin(actor) ? {} : buildAccessibleProjectsWhere(actor);

  const [meetings, tasks, mentions] = await Promise.all([
    prisma.projectMeeting.findMany({
      where: {
        status: ProjectMeetingStatus.SCHEDULED,
        endAt: { gte: now },
        startAt: { lte: next24h },
        project: projectScopeWhere,
        OR: [
          { participants: { some: { userId: actor.userId } } },
          { participants: { none: {} } },
        ],
      },
      select: {
        id: true,
        projectId: true,
        title: true,
        meetUrl: true,
        date: true,
        startMinute: true,
        endMinute: true,
        startAt: true,
        endAt: true,
        project: { select: { name: true } },
      },
      orderBy: [{ startAt: "asc" }],
      take: 5,
    }),

    prisma.task.findMany({
      where: {
        status: TaskStatus.IN_PROGRESS,
        assignees: { some: { userId: actor.userId } },
        project: projectScopeWhere,
      },
      select: {
        id: true,
        title: true,
        projectId: true,
        priority: true,
        deadline: true,
        project: { select: { name: true } },
      },
      orderBy: [{ deadline: "asc" }, { updatedAt: "desc" }],
      take: 5,
    }),

    prisma.notification.findMany({
      where: {
        userId: actor.userId,
        type: NotificationType.TASK_COMMENT_MENTION,
        isRead: false,
      },
      select: {
        id: true,
        title: true,
        message: true,
        targetUrl: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }],
      take: 5,
    }),
  ]);

  const nowMs = now.getTime();

  return {
    upcomingMeetings: meetings.map((m) => ({
      id: m.id,
      projectId: m.projectId,
      projectName: m.project.name,
      title: m.title,
      meetUrl: sanitizeExternalHttpUrl(m.meetUrl),
      date: formatPgDateYmd(m.date),
      startTime: minutesToHhmm(m.startMinute),
      endTime: minutesToHhmm(m.endMinute),
      startAt: m.startAt.toISOString(),
      endAt: m.endAt.toISOString(),
      isOngoing: m.startAt.getTime() <= nowMs && m.endAt.getTime() >= nowMs,
    })),
    inProgressTasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      projectId: t.projectId,
      projectName: t.project.name,
      priority: t.priority,
      deadline: t.deadline.toISOString(),
      isOverdue: t.deadline.getTime() < nowMs,
    })),
    unreadMentions: mentions.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      targetUrl: n.targetUrl,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}
