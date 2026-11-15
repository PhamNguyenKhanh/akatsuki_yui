"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, toActionError } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import type { ProjectDTO } from "@/modules/projects/project.repository";
import type {
  CreateProjectInput,
  RestoreProjectInput,
  UpdateProjectInput,
} from "@/modules/projects/project.schema";
import {
  activateProjectService,
  archiveProjectService,
  createProjectService,
  restoreProjectService,
  updateProjectService,
} from "@/modules/projects/project.service";

function revalidateProjectPaths(projectId?: string) {
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/admin/templates");
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/edit`);
  }
}

export async function createProjectAction(
  input: CreateProjectInput
): Promise<ActionResult<ProjectDTO>> {
  try {
    const actor = await requireActiveUser();
    const created = await createProjectService(actor, input);
    revalidateProjectPaths(created.id);
    return { ok: true, data: created };
  } catch (error) {
    return toActionError(error, { action: "createProjectAction" });
  }
}

export async function updateProjectAction(
  projectId: string,
  input: UpdateProjectInput
): Promise<ActionResult<ProjectDTO>> {
  try {
    const actor = await requireActiveUser();
    const updated = await updateProjectService(actor, projectId, input);
    revalidateProjectPaths(updated.id);
    return { ok: true, data: updated };
  } catch (error) {
    return toActionError(error, { action: "updateProjectAction" });
  }
}

export async function activateProjectAction(projectId: string): Promise<ActionResult<ProjectDTO>> {
  try {
    const actor = await requireActiveUser();
    const updated = await activateProjectService(actor, projectId);
    revalidateProjectPaths(updated.id);
    return { ok: true, data: updated };
  } catch (error) {
    return toActionError(error, { action: "activateProjectAction" });
  }
}

export async function archiveProjectAction(projectId: string): Promise<ActionResult<ProjectDTO>> {
  try {
    const actor = await requireActiveUser();
    const updated = await archiveProjectService(actor, projectId);
    revalidateProjectPaths(updated.id);
    return { ok: true, data: updated };
  } catch (error) {
    return toActionError(error, { action: "archiveProjectAction" });
  }
}

export async function restoreProjectAction(
  projectId: string,
  input: RestoreProjectInput
): Promise<ActionResult<ProjectDTO>> {
  try {
    const actor = await requireActiveUser();
    const updated = await restoreProjectService(actor, projectId, input);
    revalidateProjectPaths(updated.id);
    return { ok: true, data: updated };
  } catch (error) {
    return toActionError(error, { action: "restoreProjectAction" });
  }
}
