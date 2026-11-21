"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, toActionError } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import type { CreateTaskCommentInput } from "@/modules/tasks/task-comment.schema";
import {
  createTaskCommentService,
  deleteTaskCommentService,
  type TaskCommentDTO,
} from "@/modules/tasks/task-comment.service";

export async function createTaskCommentAction(
  taskId: string,
  projectId: string,
  input: CreateTaskCommentInput
): Promise<ActionResult<TaskCommentDTO>> {
  try {
    const actor = await requireActiveUser();
    const comment = await createTaskCommentService(actor, taskId, input);
    revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
    return { ok: true, data: comment };
  } catch (error) {
    return toActionError(error, { action: "createTaskCommentAction" });
  }
}

export async function deleteTaskCommentAction(
  taskId: string,
  projectId: string,
  commentId: string
): Promise<ActionResult<{ commentId: string }>> {
  try {
    const actor = await requireActiveUser();
    const result = await deleteTaskCommentService(actor, taskId, commentId);
    revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
    return { ok: true, data: { commentId: result.commentId } };
  } catch (error) {
    return toActionError(error, { action: "deleteTaskCommentAction" });
  }
}
