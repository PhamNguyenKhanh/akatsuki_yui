import "server-only";
import { TaskStatus, type Prisma } from "@prisma/client";
import { conflictError } from "@/lib/errors";
import { formatTaskCode } from "@/modules/tasks/task.schema";

/**
 * DEC-009 / BR-MEM-005 guard invoked inside removeProjectMemberService transaction:
 * Blocks soft-removing a ProjectMember while they still hold active (removedAt IS NULL)
 * assignments on unfinished (status !== DONE) Tasks inside the Project.
 */
export const taskAssignmentGuard = {
  async assertNoActiveProjectTasks(
    tx: Prisma.TransactionClient,
    projectId: string,
    userId: string
  ): Promise<void> {
    const blockingAssignments = await tx.taskAssignee.findMany({
      where: {
        userId,
        removedAt: null,
        task: {
          projectId,
          status: { not: TaskStatus.DONE },
        },
      },
      orderBy: [{ task: { deadline: "asc" } }, { assignedAt: "asc" }],
      select: {
        task: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    if (blockingAssignments.length > 0) {
      throw conflictError(
        "TASK_ASSIGNEE_REASSIGN_REQUIRED",
        `Không thể loại bỏ thành viên vì vẫn còn ${blockingAssignments.length} Task chưa hoàn thành đang được phân công trong Project này. Vui lòng bàn giao Task trước.`,
        blockingAssignments.map((item) => ({
          field: "userId",
          taskId: item.task.id,
          taskTitle: item.task.title,
          taskStatus: item.task.status,
          message: `${formatTaskCode(item.task.id)} ${item.task.title} (${item.task.status})`,
        }))
      );
    }
  },
};
