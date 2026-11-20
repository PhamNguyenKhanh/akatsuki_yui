"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, toActionError } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import type {
  CreateScheduleEntryInput,
  DeleteScheduleEntryInput,
  UpdateScheduleEntryInput,
} from "@/modules/schedule/schedule.schema";
import {
  createScheduleEntryService,
  deleteScheduleEntryService,
  updateScheduleEntryService,
} from "@/modules/schedule/schedule.service";

function revalidateSchedulePaths(projectId: string) {
  revalidatePath(`/projects/${projectId}/schedule`);
  revalidatePath(`/projects/${projectId}`);
}

export async function createScheduleEntryAction(
  projectId: string,
  input: CreateScheduleEntryInput
): Promise<ActionResult<{ id: string; projectId: string; date: string }>> {
  try {
    const actor = await requireActiveUser();
    const result = await createScheduleEntryService(actor, projectId, input);
    revalidateSchedulePaths(result.projectId);
    return { ok: true, data: result };
  } catch (error) {
    return toActionError(error, { action: "createScheduleEntryAction" });
  }
}

export async function updateScheduleEntryAction(
  projectId: string,
  entryId: string,
  input: UpdateScheduleEntryInput
): Promise<ActionResult<{ id: string; projectId: string }>> {
  try {
    const actor = await requireActiveUser();
    const result = await updateScheduleEntryService(actor, projectId, entryId, input);
    revalidateSchedulePaths(result.projectId);
    return { ok: true, data: result };
  } catch (error) {
    return toActionError(error, { action: "updateScheduleEntryAction" });
  }
}

export async function deleteScheduleEntryAction(
  projectId: string,
  entryId: string,
  input: DeleteScheduleEntryInput
): Promise<ActionResult<{ id: string; projectId: string }>> {
  try {
    const actor = await requireActiveUser();
    const result = await deleteScheduleEntryService(actor, projectId, entryId, input);
    revalidateSchedulePaths(result.projectId);
    return { ok: true, data: result };
  } catch (error) {
    return toActionError(error, { action: "deleteScheduleEntryAction" });
  }
}
