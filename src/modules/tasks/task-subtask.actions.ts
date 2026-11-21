"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, toActionError } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import type { CreateTaskSubtaskInput } from "@/modules/tasks/task-subtask.schema";
import {
  createTaskSubtaskService,
  deleteTaskSubtaskService,
  toggleTaskSubtaskService,
  type TaskSubtaskDTO,
} from "@/modules/tasks/task-subtask.service";

export async function createTaskSubtaskAction(
  taskId: string,
  projectId: string,
  input: CreateTaskSubtaskInput
): Promise<ActionResult<TaskSubtaskDTO>> {
  try {
    const actor = await requireActiveUser();
    const created = await createTaskSubtaskService(actor, taskId, input);
    revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
    return { ok: true, data: created };
  } catch (error) {
    return toActionError(error, { action: "createTaskSubtaskAction" });
  }
}

export async function toggleTaskSubtaskAction(
  taskId: string,
  projectId: string,
  subtaskId: string,
  isCompleted: boolean
): Promise<ActionResult<TaskSubtaskDTO>> {
  try {
    const actor = await requireActiveUser();
    const updated = await toggleTaskSubtaskService(actor, taskId, subtaskId, isCompleted);
    revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
    return { ok: true, data: updated };
  } catch (error) {
    return toActionError(error, { action: "toggleTaskSubtaskAction" });
  }
}

export async function deleteTaskSubtaskAction(
  taskId: string,
  projectId: string,
  subtaskId: string
): Promise<ActionResult<{ subtaskId: string }>> {
  try {
    const actor = await requireActiveUser();
    const deleted = await deleteTaskSubtaskService(actor, taskId, subtaskId);
    revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
    return { ok: true, data: deleted };
  } catch (error) {
    return toActionError(error, { action: "deleteTaskSubtaskAction" });
  }
}
