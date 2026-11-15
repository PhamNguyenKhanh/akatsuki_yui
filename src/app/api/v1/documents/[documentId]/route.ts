import { apiError, apiSuccess } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import {
  deleteDocumentService,
  getDocumentDetailService,
  updateDocumentService,
} from "@/modules/documents/document.service";

type RouteContext = {
  params: Promise<{ documentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { documentId } = await context.params;
    const document = await getDocumentDetailService(actor, documentId);
    return apiSuccess(document);
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/documents/[documentId]" });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { documentId } = await context.params;
    const body = await parseJsonBody(request);
    const document = await updateDocumentService(actor, documentId, body);
    return apiSuccess(document);
  } catch (error) {
    return apiError(error, { route: "PATCH /api/v1/documents/[documentId]" });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { documentId } = await context.params;
    const result = await deleteDocumentService(actor, documentId);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error, { route: "DELETE /api/v1/documents/[documentId]" });
  }
}
