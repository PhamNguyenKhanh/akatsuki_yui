"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, toActionError } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import type {
  CreateMeetLinkInput,
  CreateProjectMeetingInput,
  UpdateMeetLinkInput,
  UpdateProjectMeetingInput,
} from "@/modules/meetings/meeting.schema";
import {
  cancelProjectMeetingService,
  createMeetLinkService,
  createProjectMeetingService,
  deleteMeetLinkService,
  deleteProjectMeetingService,
  updateMeetLinkService,
  updateProjectMeetingService,
} from "@/modules/meetings/meeting.service";
import type { MeetLinkDTO, ProjectMeetingDTO } from "@/modules/meetings/meeting.types";

function revalidateMeetingPaths(projectId: string) {
  revalidatePath(`/projects/${projectId}/meetings`);
  revalidatePath(`/projects/${projectId}`);
}

export async function createMeetLinkAction(
  projectId: string,
  input: CreateMeetLinkInput
): Promise<ActionResult<MeetLinkDTO>> {
  try {
    const actor = await requireActiveUser();
    const data = await createMeetLinkService(actor, projectId, input);
    revalidateMeetingPaths(data.projectId);
    return { ok: true, data };
  } catch (error) {
    return toActionError(error, { action: "createMeetLinkAction" });
  }
}

export async function updateMeetLinkAction(
  projectId: string,
  linkId: string,
  input: UpdateMeetLinkInput
): Promise<ActionResult<MeetLinkDTO>> {
  try {
    const actor = await requireActiveUser();
    const data = await updateMeetLinkService(actor, projectId, linkId, input);
    revalidateMeetingPaths(data.projectId);
    return { ok: true, data };
  } catch (error) {
    return toActionError(error, { action: "updateMeetLinkAction" });
  }
}

export async function deleteMeetLinkAction(
  projectId: string,
  linkId: string
): Promise<ActionResult<{ id: string; projectId: string }>> {
  try {
    const actor = await requireActiveUser();
    const data = await deleteMeetLinkService(actor, projectId, linkId);
    revalidateMeetingPaths(data.projectId);
    return { ok: true, data };
  } catch (error) {
    return toActionError(error, { action: "deleteMeetLinkAction" });
  }
}

export async function createProjectMeetingAction(
  projectId: string,
  input: CreateProjectMeetingInput
): Promise<ActionResult<ProjectMeetingDTO>> {
  try {
    const actor = await requireActiveUser();
    const data = await createProjectMeetingService(actor, projectId, input);
    revalidateMeetingPaths(data.projectId);
    return { ok: true, data };
  } catch (error) {
    return toActionError(error, { action: "createProjectMeetingAction" });
  }
}

export async function updateProjectMeetingAction(
  projectId: string,
  meetingId: string,
  input: UpdateProjectMeetingInput
): Promise<ActionResult<ProjectMeetingDTO>> {
  try {
    const actor = await requireActiveUser();
    const data = await updateProjectMeetingService(actor, projectId, meetingId, input);
    revalidateMeetingPaths(data.projectId);
    return { ok: true, data };
  } catch (error) {
    return toActionError(error, { action: "updateProjectMeetingAction" });
  }
}

export async function cancelProjectMeetingAction(
  projectId: string,
  meetingId: string
): Promise<ActionResult<ProjectMeetingDTO>> {
  try {
    const actor = await requireActiveUser();
    const data = await cancelProjectMeetingService(actor, projectId, meetingId);
    revalidateMeetingPaths(data.projectId);
    return { ok: true, data };
  } catch (error) {
    return toActionError(error, { action: "cancelProjectMeetingAction" });
  }
}

export async function deleteProjectMeetingAction(
  projectId: string,
  meetingId: string
): Promise<ActionResult<{ id: string; projectId: string }>> {
  try {
    const actor = await requireActiveUser();
    const data = await deleteProjectMeetingService(actor, projectId, meetingId);
    revalidateMeetingPaths(data.projectId);
    return { ok: true, data };
  } catch (error) {
    return toActionError(error, { action: "deleteProjectMeetingAction" });
  }
}
