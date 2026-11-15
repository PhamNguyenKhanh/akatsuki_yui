"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, toActionError } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { completeSprintService } from "@/modules/sprints/sprint-completion.service";
import {
  assignTasksToSprintService,
  moveSprintTaskService,
} from "@/modules/sprints/sprint-planning.service";
import type { SprintDetailDTO, SprintOverlapWarningDTO } from "@/modules/sprints/sprint.repository";
import type {
  CancelSprintInput,
  CompleteSprintInput,
  CreateSprintInput,
  MoveSprintTaskInput,
  SprintPlanningAssignInput,
  UpdateSprintInput,
} from "@/modules/sprints/sprint.schema";
import {
  activateSprintService,
  cancelSprintService,
  createSprintService,
  updateSprintService,
} from "@/modules/sprints/sprint.service";
import type { TaskDetailDTO, TaskSummaryDTO } from "@/modules/tasks/task.repository";

function revalidateSprintPaths(projectId: string | undefined, sprintId?: string, taskId?: string) {
  revalidatePath("/dashboard");
  if (!projectId) {
    revalidatePath("/projects", "layout");
    return;
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/sprints`, "layout");
  revalidatePath(`/projects/${projectId}/backlog`);
  revalidatePath(`/projects/${projectId}/kanban`);
  revalidatePath(`/projects/${projectId}/tasks`);
  if (sprintId) {
    revalidatePath(`/projects/${projectId}/sprints/${sprintId}`);
    revalidatePath(`/projects/${projectId}/sprints/${sprintId}/edit`);
  }
  if (taskId) {
    revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
    revalidatePath(`/projects/${projectId}/tasks/${taskId}/edit`);
  }
}

export async function createSprintAction(
  projectId: string,
  input: CreateSprintInput
): Promise<
  ActionResult<{ sprint: SprintDetailDTO; overlappingSprints: SprintOverlapWarningDTO[] }>
> {
  try {
    const actor = await requireActiveUser();
    const result = await createSprintService(actor, projectId, input);
    revalidateSprintPaths(result.sprint.projectId, result.sprint.id);
    return { ok: true, data: result };
  } catch (error) {
    return toActionError(error, { action: "createSprintAction" });
  }
}

export async function updateSprintAction(
  sprintId: string,
  input: UpdateSprintInput
): Promise<
  ActionResult<{ sprint: SprintDetailDTO; overlappingSprints: SprintOverlapWarningDTO[] }>
> {
  try {
    const actor = await requireActiveUser();
    const result = await updateSprintService(actor, sprintId, input);
    revalidateSprintPaths(result.sprint.projectId, result.sprint.id);
    return { ok: true, data: result };
  } catch (error) {
    return toActionError(error, { action: "updateSprintAction" });
  }
}

export async function activateSprintAction(
  sprintId: string
): Promise<ActionResult<SprintDetailDTO>> {
  try {
    const actor = await requireActiveUser();
    const updated = await activateSprintService(actor, sprintId);
    revalidateSprintPaths(updated.projectId, updated.id);
    return { ok: true, data: updated };
  } catch (error) {
    return toActionError(error, { action: "activateSprintAction" });
  }
}

export async function cancelSprintAction(
  sprintId: string,
  input?: CancelSprintInput
): Promise<ActionResult<SprintDetailDTO>> {
  try {
    const actor = await requireActiveUser();
    const updated = await cancelSprintService(actor, sprintId, input);
    revalidateSprintPaths(updated.projectId, updated.id);
    return { ok: true, data: updated };
  } catch (error) {
    return toActionError(error, { action: "cancelSprintAction" });
  }
}

export async function assignTasksToSprintAction(
  sprintId: string,
  input: SprintPlanningAssignInput,
  projectId?: string
): Promise<ActionResult<{ sprintId: string; addedCount: number; tasks: TaskSummaryDTO[] }>> {
  try {
    const actor = await requireActiveUser();
    const result = await assignTasksToSprintService(actor, sprintId, input);
    const resolvedProjectId = result.tasks[0]?.projectId ?? projectId;
    revalidateSprintPaths(resolvedProjectId, result.sprintId);
    return { ok: true, data: result };
  } catch (error) {
    return toActionError(error, { action: "assignTasksToSprintAction" });
  }
}

export async function moveSprintTaskAction(
  sprintId: string,
  taskId: string,
  input: MoveSprintTaskInput
): Promise<ActionResult<TaskDetailDTO>> {
  try {
    const actor = await requireActiveUser();
    const updated = await moveSprintTaskService(actor, sprintId, taskId, input);
    revalidateSprintPaths(updated.projectId, sprintId, updated.id);
    if (updated.sprintId && updated.sprintId !== sprintId) {
      revalidateSprintPaths(updated.projectId, updated.sprintId);
    }
    return { ok: true, data: updated };
  } catch (error) {
    return toActionError(error, { action: "moveSprintTaskAction" });
  }
}

export async function completeSprintAction(
  sprintId: string,
  input: CompleteSprintInput
): Promise<ActionResult<SprintDetailDTO>> {
  try {
    const actor = await requireActiveUser();
    const updated = await completeSprintService(actor, sprintId, input);
    revalidateSprintPaths(updated.projectId, updated.id);
    return { ok: true, data: updated };
  } catch (error) {
    return toActionError(error, { action: "completeSprintAction" });
  }
}
