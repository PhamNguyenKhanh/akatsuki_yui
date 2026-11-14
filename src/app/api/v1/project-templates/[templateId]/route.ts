import { apiError, apiSuccess } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import type { UpdateProjectTemplateInput } from "@/modules/project-templates/template.schema";
import {
  deleteProjectTemplateService,
  getProjectTemplateDetailService,
  updateProjectTemplateService,
} from "@/modules/project-templates/template.service";

type RouteContext = {
  params: Promise<{ templateId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { templateId } = await context.params;
    const template = await getProjectTemplateDetailService(actor, templateId);
    return apiSuccess(template);
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/project-templates/[templateId]" });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { templateId } = await context.params;
    const body = (await parseJsonBody(request)) as UpdateProjectTemplateInput;
    const updated = await updateProjectTemplateService(actor, templateId, body);
    return apiSuccess(updated);
  } catch (error) {
    return apiError(error, { route: "PATCH /api/v1/project-templates/[templateId]" });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { templateId } = await context.params;
    const result = await deleteProjectTemplateService(actor, templateId);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error, { route: "DELETE /api/v1/project-templates/[templateId]" });
  }
}
