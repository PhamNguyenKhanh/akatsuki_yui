import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { hasPermission } from "@/modules/authorization/policy.service";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { buildAccessibleProjectsWhere } from "@/modules/projects/project.access";
import { formatTaskCode } from "@/modules/tasks/task.schema";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireActiveUser();
    const rawQuery = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    if (rawQuery.length < 1) {
      return apiSuccess({
        projects: [],
        tasks: [],
        sprints: [],
        documents: [],
      });
    }

    const q = rawQuery.slice(0, 100);
    const accessibleProjectWhere = buildAccessibleProjectsWhere(actor);

    const [projects, tasks, sprints, documents] = await Promise.all([
      hasPermission(actor, PERMISSIONS.PROJECT_READ)
        ? prisma.project.findMany({
            where: {
              ...accessibleProjectWhere,
              name: { contains: q, mode: "insensitive" },
            },
            take: 5,
            orderBy: { updatedAt: "desc" },
            select: {
              id: true,
              name: true,
              status: true,
            },
          })
        : Promise.resolve([]),

      hasPermission(actor, PERMISSIONS.TASK_READ)
        ? prisma.task.findMany({
            where: {
              project: accessibleProjectWhere,
              title: { contains: q, mode: "insensitive" },
            },
            take: 6,
            orderBy: { updatedAt: "desc" },
            select: {
              id: true,
              title: true,
              status: true,
              projectId: true,
              project: { select: { name: true } },
            },
          })
        : Promise.resolve([]),

      hasPermission(actor, PERMISSIONS.SPRINT_READ)
        ? prisma.sprint.findMany({
            where: {
              project: accessibleProjectWhere,
              name: { contains: q, mode: "insensitive" },
            },
            take: 5,
            orderBy: { updatedAt: "desc" },
            select: {
              id: true,
              name: true,
              status: true,
              projectId: true,
              project: { select: { name: true } },
            },
          })
        : Promise.resolve([]),

      hasPermission(actor, PERMISSIONS.DOCUMENT_READ)
        ? prisma.document.findMany({
            where: {
              deletedAt: null,
              project: accessibleProjectWhere,
              title: { contains: q, mode: "insensitive" },
            },
            take: 5,
            orderBy: { updatedAt: "desc" },
            select: {
              id: true,
              title: true,
              category: true,
              projectId: true,
              project: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    return apiSuccess({
      projects,
      tasks: tasks.map((t) => ({
        id: t.id,
        code: formatTaskCode(t.id),
        title: t.title,
        status: t.status,
        projectId: t.projectId,
        projectName: t.project.name,
      })),
      sprints: sprints.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        projectId: s.projectId,
        projectName: s.project.name,
      })),
      documents: documents.map((d) => ({
        id: d.id,
        title: d.title,
        category: d.category,
        projectId: d.projectId,
        projectName: d.project.name,
      })),
    });
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/search" });
  }
}
