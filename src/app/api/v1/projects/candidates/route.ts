import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { listProjectUserCandidatesService } from "@/modules/projects/project.service";

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

    const candidates = await listProjectUserCandidatesService(actor, rawQuery);
    return apiSuccess(candidates);
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/projects/candidates" });
  }
}
