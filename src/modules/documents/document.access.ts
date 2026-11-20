import "server-only";
import { ProjectMemberRole, ProjectStatus, type Prisma } from "@prisma/client";
import { type ZodType } from "zod";
import { AppError, badRequestError, conflictError, forbiddenError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { uuidSchema } from "@/lib/validations/common";
import { PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import { assertPermission, hasPermission } from "@/modules/authorization/policy.service";
import { assertProjectReadAccess, isWorkspaceAdmin } from "@/modules/projects/project.access";
import type { AuthContext } from "@/types/auth";

export function parseDocumentId(documentId: string): string {
  const parsed = uuidSchema.safeParse(documentId);
  if (!parsed.success) {
    throw badRequestError("Document ID không đúng định dạng UUID.", [
      { field: "documentId", message: "Document ID không hợp lệ." },
    ]);
  }
  return parsed.data;
}

export function parseDocumentInput<T>(
  schema: ZodType<T>,
  rawInput: unknown,
  fallbackMessage: string
): T {
  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequestError(
      parsed.error.issues[0]?.message ?? fallbackMessage,
      parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "body",
        message: issue.message,
      }))
    );
  }
  return parsed.data;
}

export function assertProjectNotArchivedForDocumentMutation(status: ProjectStatus): void {
  if (status === ProjectStatus.ARCHIVED) {
    throw conflictError(
      "PROJECT_ARCHIVED",
      "Project đã ở trạng thái ARCHIVED. Tài liệu trong Project lưu trữ chỉ được phép xem."
    );
  }
}

/**
 * Serializes Document mutations against concurrent Project Archive operations
 * by acquiring a row-level shared lock on Project and re-checking status inside tx.
 */
export async function lockProjectRowForDocumentMutation(
  projectId: string,
  tx: Prisma.TransactionClient
): Promise<void> {
  if (typeof (tx as { $queryRaw?: unknown }).$queryRaw === "function") {
    const rows = await tx.$queryRaw<Array<{ id: string; status: ProjectStatus }>>`
      SELECT "id", "status"
      FROM "Project"
      WHERE "id" = ${projectId}::uuid
      FOR SHARE
    `;
    if (rows && rows.length > 0) {
      assertProjectNotArchivedForDocumentMutation(rows[0].status);
    }
  }
}

/**
 * Evaluates DEC-034 Document management capability for a specific Project.
 * - Requires `document.manage` permission and non-ARCHIVED Project.
 * - ADMIN can manage Documents in all non-ARCHIVED Projects.
 * - LEADER can manage Documents in their own Projects.
 * - MEMBER can manage Documents in accessible Projects if ADMIN granted `document.manage` to MEMBER.
 * - INSTRUCTOR is strictly read-only.
 */
export function canActorManageProjectDocuments(
  actor: AuthContext,
  project: {
    leaderId: string;
    status: ProjectStatus;
    members: { projectRole: ProjectMemberRole }[];
  }
): boolean {
  if (!hasPermission(actor, PERMISSIONS.DOCUMENT_MANAGE)) {
    return false;
  }
  if (project.status === ProjectStatus.ARCHIVED) {
    return false;
  }
  if (isWorkspaceAdmin(actor)) {
    return true;
  }

  const isLeaderOfProject =
    project.leaderId === actor.userId ||
    project.members.some((m) => m.projectRole === ProjectMemberRole.LEADER);

  if (isLeaderOfProject) {
    return true;
  }

  const isActiveMemberOfProject = project.members.some(
    (m) => m.projectRole === ProjectMemberRole.MEMBER
  );

  if (isActiveMemberOfProject && actor.roles.includes(ROLES.MEMBER)) {
    return true;
  }

  return false;
}

export async function assertProjectDocumentManageAccess(
  actor: AuthContext,
  projectId: string,
  tx: Prisma.TransactionClient = prisma
) {
  assertPermission(actor, PERMISSIONS.DOCUMENT_MANAGE);
  const project = await assertProjectReadAccess(actor, projectId, tx);
  assertProjectNotArchivedForDocumentMutation(project.status);

  if (!canActorManageProjectDocuments(actor, project)) {
    throw forbiddenError("Bạn không có quyền quản lý tài liệu trong Project này.");
  }

  return project;
}

export async function loadActiveDocumentOrThrow(
  documentId: string,
  tx: Prisma.TransactionClient = prisma
) {
  const document = await tx.document.findFirst({
    where: {
      id: documentId,
      deletedAt: null,
    },
    select: {
      id: true,
      projectId: true,
      sprintId: true,
      uploadedById: true,
      title: true,
      url: true,
      category: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
    },
  });

  if (!document) {
    throw new AppError({
      statusCode: 404,
      code: "DOCUMENT_NOT_FOUND",
      message: "Không tìm thấy tài liệu yêu cầu hoặc tài liệu đã bị xóa.",
    });
  }

  return document;
}

export async function assertDocumentReadAccess(
  actor: AuthContext,
  documentId: string,
  tx: Prisma.TransactionClient = prisma
) {
  assertPermission(actor, PERMISSIONS.DOCUMENT_READ);
  const document = await loadActiveDocumentOrThrow(documentId, tx);
  const project = await assertProjectReadAccess(actor, document.projectId, tx);
  return { document, project };
}

export async function assertDocumentManageAccess(
  actor: AuthContext,
  documentId: string,
  tx: Prisma.TransactionClient = prisma
) {
  assertPermission(actor, PERMISSIONS.DOCUMENT_MANAGE);
  const document = await loadActiveDocumentOrThrow(documentId, tx);
  const project = await assertProjectDocumentManageAccess(actor, document.projectId, tx);
  return { document, project };
}

export async function assertSprintBelongsToDocumentProject(
  projectId: string,
  sprintId: string | null | undefined,
  tx: Prisma.TransactionClient = prisma
): Promise<void> {
  if (!sprintId) return;

  const sprint = await tx.sprint.findUnique({
    where: { id: sprintId },
    select: { id: true, projectId: true, name: true },
  });

  if (!sprint) {
    throw new AppError({
      statusCode: 404,
      code: "SPRINT_NOT_FOUND",
      message: "Không tìm thấy Sprint được liên kết.",
      details: [{ field: "sprintId", message: "Sprint không tồn tại." }],
    });
  }

  if (sprint.projectId !== projectId) {
    throw conflictError(
      "CROSS_PROJECT_SPRINT_MISMATCH",
      "Sprint được liên kết phải thuộc cùng một Project với tài liệu.",
      [{ field: "sprintId", message: "Sprint thuộc về một Project khác." }]
    );
  }
}
