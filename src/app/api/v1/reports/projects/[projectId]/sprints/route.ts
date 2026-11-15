import { apiError, apiSuccess } from "@/lib/api-response";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { getProjectSprintReportService } from "@/modules/reports/sprint-report.service";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { projectId } = await context.params;
    const report = await getProjectSprintReportService(actor, projectId);
    return apiSuccess(report);
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/reports/projects/[projectId]/sprints" });
  }
}
