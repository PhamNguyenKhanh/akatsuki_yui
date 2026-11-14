import "server-only";
import type { Prisma } from "@prisma/client";

/**
 * Sprint 2 guard hook for DEC-009 / BR-MEM-005:
 * Before removing a member from a Project, Sprint 3 will query TaskAssignee
 * for unfinished tasks inside the Project and throw
 * `conflictError("TASK_ASSIGNEE_REASSIGN_REQUIRED", ...)` if any exist.
 */
export const taskAssignmentGuard = {
  async assertNoActiveProjectTasks(
    _tx: Prisma.TransactionClient,
    _projectId: string,
    _userId: string
  ): Promise<void> {
    return;
  },
};
