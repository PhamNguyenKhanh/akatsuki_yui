"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, toActionError } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import type { ProjectMemberDTO } from "@/modules/project-members/member.repository";
import type {
  AddProjectMemberInput,
  ChangeProjectLeaderInput,
} from "@/modules/project-members/member.schema";
import {
  addProjectMemberService,
  changeProjectLeaderService,
  removeProjectMemberService,
} from "@/modules/project-members/member.service";

function revalidateProjectMemberPaths(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/edit`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

export async function addProjectMemberAction(
  projectId: string,
  input: AddProjectMemberInput
): Promise<ActionResult<ProjectMemberDTO>> {
  try {
    const actor = await requireActiveUser();
    const created = await addProjectMemberService(actor, projectId, input);
    revalidateProjectMemberPaths(projectId);
    return { ok: true, data: created };
  } catch (error) {
    return toActionError(error, { action: "addProjectMemberAction" });
  }
}

export async function changeProjectLeaderAction(
  projectId: string,
  input: ChangeProjectLeaderInput
): Promise<ActionResult<ProjectMemberDTO[]>> {
  try {
    const actor = await requireActiveUser();
    const updated = await changeProjectLeaderService(actor, projectId, input);
    revalidateProjectMemberPaths(projectId);
    return { ok: true, data: updated };
  } catch (error) {
    return toActionError(error, { action: "changeProjectLeaderAction" });
  }
}

export async function removeProjectMemberAction(
  projectId: string,
  targetUserId: string
): Promise<ActionResult<ProjectMemberDTO>> {
  try {
    const actor = await requireActiveUser();
    const removed = await removeProjectMemberService(actor, projectId, targetUserId);
    revalidateProjectMemberPaths(projectId);
    return { ok: true, data: removed };
  } catch (error) {
    return toActionError(error, { action: "removeProjectMemberAction" });
  }
}
