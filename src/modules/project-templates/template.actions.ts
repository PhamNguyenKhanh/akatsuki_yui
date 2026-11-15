"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, toActionError } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import type { ProjectTemplateDTO } from "@/modules/project-templates/template.repository";
import type {
  CreateProjectTemplateInput,
  UpdateProjectTemplateInput,
} from "@/modules/project-templates/template.schema";
import {
  createProjectTemplateService,
  deleteProjectTemplateService,
  updateProjectTemplateService,
} from "@/modules/project-templates/template.service";

export async function createProjectTemplateAction(
  input: CreateProjectTemplateInput
): Promise<ActionResult<ProjectTemplateDTO>> {
  try {
    const actor = await requireActiveUser();
    const created = await createProjectTemplateService(actor, input);
    revalidatePath("/admin/templates");
    revalidatePath("/projects/new");
    return { ok: true, data: created };
  } catch (error) {
    return toActionError(error, { action: "createProjectTemplateAction" });
  }
}

export async function updateProjectTemplateAction(
  templateId: string,
  input: UpdateProjectTemplateInput
): Promise<ActionResult<ProjectTemplateDTO>> {
  try {
    const actor = await requireActiveUser();
    const updated = await updateProjectTemplateService(actor, templateId, input);
    revalidatePath("/admin/templates");
    revalidatePath("/projects/new");
    return { ok: true, data: updated };
  } catch (error) {
    return toActionError(error, { action: "updateProjectTemplateAction" });
  }
}

export async function deleteProjectTemplateAction(
  templateId: string
): Promise<ActionResult<{ id: string; deleted: true }>> {
  try {
    const actor = await requireActiveUser();
    const deleted = await deleteProjectTemplateService(actor, templateId);
    revalidatePath("/admin/templates");
    revalidatePath("/projects/new");
    return { ok: true, data: deleted };
  } catch (error) {
    return toActionError(error, { action: "deleteProjectTemplateAction" });
  }
}
