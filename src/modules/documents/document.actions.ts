"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, toActionError } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import {
  createDocumentService,
  deleteDocumentService,
  updateDocumentService,
} from "@/modules/documents/document.service";
import type { DocumentDTO } from "@/modules/documents/document.types";
import type {
  CreateDocumentInput,
  UpdateDocumentInput,
} from "@/modules/documents/document.validation";

function revalidateDocumentPaths(projectId: string) {
  revalidatePath("/documents");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/documents`);
}

export async function createDocumentAction(
  projectId: string,
  input: CreateDocumentInput
): Promise<ActionResult<DocumentDTO>> {
  try {
    const actor = await requireActiveUser();
    const document = await createDocumentService(actor, projectId, input);
    revalidateDocumentPaths(projectId);
    return {
      ok: true,
      data: document,
    };
  } catch (error) {
    return toActionError(error, { action: "createDocumentAction" });
  }
}

export async function updateDocumentAction(
  documentId: string,
  input: UpdateDocumentInput
): Promise<ActionResult<DocumentDTO>> {
  try {
    const actor = await requireActiveUser();
    const document = await updateDocumentService(actor, documentId, input);
    revalidateDocumentPaths(document.projectId);
    return {
      ok: true,
      data: document,
    };
  } catch (error) {
    return toActionError(error, { action: "updateDocumentAction" });
  }
}

export async function deleteDocumentAction(
  documentId: string
): Promise<ActionResult<{ id: string; projectId: string; deletedAt: string }>> {
  try {
    const actor = await requireActiveUser();
    const result = await deleteDocumentService(actor, documentId);
    revalidateDocumentPaths(result.projectId);
    return {
      ok: true,
      data: result,
    };
  } catch (error) {
    return toActionError(error, { action: "deleteDocumentAction" });
  }
}
