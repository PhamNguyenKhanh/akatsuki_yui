"use server";

import { revalidatePath } from "next/cache";
import type { TaskStatus } from "@prisma/client";
import { type ActionResult, toActionError } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import {
  addTaskAssigneeService,
  removeTaskAssigneeService,
  syncTaskAssigneesService,
} from "@/modules/tasks/task-assignment.service";
import {
  addTaskDependencyService,
  removeTaskDependencyService,
} from "@/modules/tasks/task-dependency.service";
import type {
  TaskAssigneeDTO,
  TaskDependencyItemDTO,
  TaskDetailDTO,
} from "@/modules/tasks/task.repository";
import type {
  AddTaskAssigneeInput,
  AddTaskDependencyInput,
  CreateTaskInput,
  ReviewDecisionInput,
  SubmitTaskReviewInput,
  SyncTaskAssigneesInput,
  UpdateTaskInput,
} from "@/modules/tasks/task.schema";
import { createTaskService, updateTaskService } from "@/modules/tasks/task.service";
import {
  approveTaskReviewService,
  rejectTaskReviewService,
  submitTaskForReviewService,
  updateTaskStatusService,
} from "@/modules/tasks/task-workflow.service";

function revalidateTaskPaths(projectId: string | undefined, taskId?: string, extraTaskId?: string) {
  revalidatePath("/dashboard");
  if (!projectId) {
    revalidatePath("/projects", "layout");
    return;
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/tasks`);
  revalidatePath(`/projects/${projectId}/backlog`);
  revalidatePath(`/projects/${projectId}/kanban`);
  revalidatePath(`/projects/${projectId}/sprints`, "layout");
  if (taskId) {
    revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
    revalidatePath(`/projects/${projectId}/tasks/${taskId}/edit`);
  }
  if (extraTaskId) {
    revalidatePath(`/projects/${projectId}/tasks/${extraTaskId}`);
  }
}

export async function createTaskAction(
  projectId: string,
  input: CreateTaskInput
): Promise<ActionResult<TaskDetailDTO>> {
  try {
    const actor = await requireActiveUser();
    const created = await createTaskService(actor, projectId, input);
    revalidateTaskPaths(created.projectId, created.id);
    return { ok: true, data: created };
  } catch (error) {
    return toActionError(error, { action: "createTaskAction" });
  }
}

export async function updateTaskAction(
  taskId: string,
  input: UpdateTaskInput
): Promise<ActionResult<TaskDetailDTO>> {
  try {
    const actor = await requireActiveUser();
    const updated = await updateTaskService(actor, taskId, input);
    revalidateTaskPaths(updated.projectId, updated.id);
    return { ok: true, data: updated };
  } catch (error) {
    return toActionError(error, { action: "updateTaskAction" });
  }
}

export async function updateTaskStatusAction(
  taskId: string,
  status: TaskStatus
): Promise<ActionResult<TaskDetailDTO>> {
  try {
    const actor = await requireActiveUser();
    const updated = await updateTaskStatusService(actor, taskId, status);
    revalidateTaskPaths(updated.projectId, updated.id);
    return { ok: true, data: updated };
  } catch (error) {
    return toActionError(error, { action: "updateTaskStatusAction" });
  }
}

export async function syncTaskAssigneesAction(
  taskId: string,
  input: SyncTaskAssigneesInput,
  projectId?: string
): Promise<ActionResult<TaskAssigneeDTO[]>> {
  try {
    const actor = await requireActiveUser();
    const assignees = await syncTaskAssigneesService(actor, taskId, input);
    revalidateTaskPaths(projectId, taskId);
    return { ok: true, data: assignees };
  } catch (error) {
    return toActionError(error, { action: "syncTaskAssigneesAction" });
  }
}

export async function addTaskAssigneeAction(
  taskId: string,
  input: AddTaskAssigneeInput,
  projectId?: string
): Promise<ActionResult<TaskAssigneeDTO[]>> {
  try {
    const actor = await requireActiveUser();
    const assignees = await addTaskAssigneeService(actor, taskId, input);
    revalidateTaskPaths(projectId, taskId);
    return { ok: true, data: assignees };
  } catch (error) {
    return toActionError(error, { action: "addTaskAssigneeAction" });
  }
}

export async function removeTaskAssigneeAction(
  taskId: string,
  userId: string,
  projectId?: string
): Promise<ActionResult<TaskAssigneeDTO[]>> {
  try {
    const actor = await requireActiveUser();
    const assignees = await removeTaskAssigneeService(actor, taskId, userId);
    revalidateTaskPaths(projectId, taskId);
    return { ok: true, data: assignees };
  } catch (error) {
    return toActionError(error, { action: "removeTaskAssigneeAction" });
  }
}

export async function submitTaskForReviewAction(
  taskId: string,
  input: SubmitTaskReviewInput = {}
): Promise<ActionResult<TaskDetailDTO>> {
  try {
    const actor = await requireActiveUser();
    const updated = await submitTaskForReviewService(actor, taskId, input);
    revalidateTaskPaths(updated.projectId, updated.id);
    return { ok: true, data: updated };
  } catch (error) {
    return toActionError(error, { action: "submitTaskForReviewAction" });
  }
}

export async function approveTaskReviewAction(
  taskId: string,
  input: ReviewDecisionInput
): Promise<ActionResult<TaskDetailDTO>> {
  try {
    const actor = await requireActiveUser();
    const updated = await approveTaskReviewService(actor, taskId, input);
    revalidateTaskPaths(updated.projectId, updated.id);
    return { ok: true, data: updated };
  } catch (error) {
    return toActionError(error, { action: "approveTaskReviewAction" });
  }
}

export async function rejectTaskReviewAction(
  taskId: string,
  input: ReviewDecisionInput
): Promise<ActionResult<TaskDetailDTO>> {
  try {
    const actor = await requireActiveUser();
    const updated = await rejectTaskReviewService(actor, taskId, input);
    revalidateTaskPaths(updated.projectId, updated.id);
    return { ok: true, data: updated };
  } catch (error) {
    return toActionError(error, { action: "rejectTaskReviewAction" });
  }
}

export async function addTaskDependencyAction(
  taskId: string,
  input: AddTaskDependencyInput,
  projectId?: string
): Promise<ActionResult<TaskDependencyItemDTO[]>> {
  try {
    const actor = await requireActiveUser();
    const dependencies = await addTaskDependencyService(actor, taskId, input);
    revalidateTaskPaths(projectId, taskId, input.dependsOnTaskId);
    return { ok: true, data: dependencies };
  } catch (error) {
    return toActionError(error, { action: "addTaskDependencyAction" });
  }
}

export async function removeTaskDependencyAction(
  taskId: string,
  dependsOnTaskId: string,
  projectId?: string
): Promise<ActionResult<TaskDependencyItemDTO[]>> {
  try {
    const actor = await requireActiveUser();
    const dependencies = await removeTaskDependencyService(actor, taskId, dependsOnTaskId);
    revalidateTaskPaths(projectId, taskId, dependsOnTaskId);
    return { ok: true, data: dependencies };
  } catch (error) {
    return toActionError(error, { action: "removeTaskDependencyAction" });
  }
}
