import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import type { CreateProjectTemplateInput } from "@/modules/project-templates/template.schema";
import {
  createProjectTemplateService,
  listProjectTemplatesService,
} from "@/modules/project-templates/template.service";
import type { PaginationMeta } from "@/types/api";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireActiveUser();
    const rawQuery: Record<string, string> = {};
    for (const [key, value] of request.nextUrl.searchParams.entries()) {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        rawQuery[key] = trimmed;
      }
    }

    const result = await listProjectTemplatesService(actor, rawQuery);
    const meta: PaginationMeta = {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    };

    return apiSuccess(result.items, { meta });
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/project-templates" });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActiveUser();
    const body = (await parseJsonBody(request)) as CreateProjectTemplateInput;
    const created = await createProjectTemplateService(actor, body);
    return apiSuccess(created, { status: 201 });
  } catch (error) {
    return apiError(error, { route: "POST /api/v1/project-templates" });
  }
}
