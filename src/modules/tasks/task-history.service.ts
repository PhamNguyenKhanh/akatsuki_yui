import "server-only";
import { badRequestError } from "@/lib/errors";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { assertPermission } from "@/modules/authorization/policy.service";
import {
  taskHistoryRepository,
  type TaskHistoryItemDTO,
} from "@/modules/tasks/task-history.repository";
import { assertTaskReadAccess, parseTaskId } from "@/modules/tasks/task.access";
import { taskHistoryQuerySchema } from "@/modules/tasks/task.schema";
import type { AuthContext } from "@/types/auth";

export async function listTaskHistoryService(
  actor: AuthContext,
  taskId: string,
  rawQuery: Record<string, unknown> = {}
): Promise<{
  items: TaskHistoryItemDTO[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}> {
  assertPermission(actor, PERMISSIONS.TASK_HISTORY_READ);
  const validTaskId = parseTaskId(taskId);

  const parsed = taskHistoryQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    throw badRequestError(
      parsed.error.issues[0]?.message ?? "Tham số phân trang lịch sử Task không hợp lệ.",
      parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "query",
        message: issue.message,
      }))
    );
  }

  await assertTaskReadAccess(actor, validTaskId);
  return taskHistoryRepository.findTaskHistoryPaginated(
    validTaskId,
    parsed.data.page,
    parsed.data.pageSize
  );
}
