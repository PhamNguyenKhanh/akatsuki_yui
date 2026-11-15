import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { getKanbanBoardService } from "@/modules/sprints/kanban.service";
import { extractSearchParams } from "@/modules/sprints/sprint-route-helpers";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { projectId } = await context.params;
    const board = await getKanbanBoardService(actor, projectId, extractSearchParams(request));
    return apiSuccess(board);
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/projects/[projectId]/kanban" });
  }
}
