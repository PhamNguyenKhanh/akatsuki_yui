import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { enforceApiWriteRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import {
  createDocumentService,
  listProjectDocumentsService,
} from "@/modules/documents/document.service";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

function extractSearchParams(request: NextRequest): Record<string, string> {
  const params: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { projectId } = await context.params;
    const result = await listProjectDocumentsService(
      actor,
      projectId,
      extractSearchParams(request)
    );
    return apiSuccess(result);
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/projects/[projectId]/documents" });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { projectId } = await context.params;
    const body = await parseJsonBody(request);
    const document = await createDocumentService(actor, projectId, body);
    return apiSuccess(document, { status: 201 });
  } catch (error) {
    return apiError(error, { route: "POST /api/v1/projects/[projectId]/documents" });
  }
}
