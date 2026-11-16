import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { enforceApiWriteRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import type { AddProjectMemberInput } from "@/modules/project-members/member.schema";
import {
  addProjectMemberService,
  listProjectMembersService,
} from "@/modules/project-members/member.service";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    const { projectId } = await context.params;
    const includeHistory = request.nextUrl.searchParams.get("includeHistory")?.trim() || undefined;
    const members = await listProjectMembersService(actor, projectId, { includeHistory });
    return apiSuccess(members);
  } catch (error) {
    return apiError(error, { route: "GET /api/v1/projects/[projectId]/members" });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireActiveUser();
    await enforceApiWriteRateLimit(actor.userId);
    const { projectId } = await context.params;
    const body = (await parseJsonBody(request)) as AddProjectMemberInput;
    const member = await addProjectMemberService(actor, projectId, body);
    return apiSuccess(member, { status: 201 });
  } catch (error) {
    return apiError(error, { route: "POST /api/v1/projects/[projectId]/members" });
  }
}
