import { apiError, apiSuccess } from "@/lib/api-response";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { removeProjectMemberService } from "@/modules/project-members/member.service";

type RouteContext = {
  params: Promise<{ projectId: string; userId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { projectId, userId } = await context.params;
    const removed = await removeProjectMemberService(actor, projectId, userId);
    return apiSuccess(removed);
  } catch (error) {
    return apiError(error, { route: "DELETE /api/v1/projects/[projectId]/members/[userId]" });
  }
}
