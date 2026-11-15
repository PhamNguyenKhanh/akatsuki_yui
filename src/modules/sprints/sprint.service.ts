import "server-only";
import { Prisma, SprintStatus, TaskHistoryAction, TaskStatus } from "@prisma/client";
import { AppError, conflictError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { assertPermission } from "@/modules/authorization/policy.service";
import {
  assertProjectLeaderAccess,
  assertProjectReadAccess,
  parseProjectId,
} from "@/modules/projects/project.access";
import {
  acquireSprintPlanningLock,
  assertProjectActiveForSprintActivation,
  assertProjectNotArchivedForSprintMutation,
  assertSprintManageAccess,
  assertSprintReadAccess,
  loadSprintRecordOrThrow,
  lockProjectRowForSprintMutation,
  lockSprintTasksForUpdate,
  parseSprintId,
  parseSprintInput,
} from "@/modules/sprints/sprint.access";
import {
  sprintRepository,
  type SprintDetailDTO,
  type SprintOverlapWarningDTO,
  type SprintSummaryDTO,
} from "@/modules/sprints/sprint.repository";
import {
  cancelSprintSchema,
  createSprintSchema,
  formatSprintDateYmd,
  sprintListQuerySchema,
  updateSprintSchema,
} from "@/modules/sprints/sprint.schema";
import { taskHistoryRepository } from "@/modules/tasks/task-history.repository";
import type { AuthContext } from "@/types/auth";

export async function listProjectSprintsService(
  actor: AuthContext,
  projectId: string,
  rawQuery: Record<string, unknown> = {}
): Promise<SprintSummaryDTO[]> {
  assertPermission(actor, PERMISSIONS.SPRINT_READ);
  const validProjectId = parseProjectId(projectId);
  const query = parseSprintInput(
    sprintListQuerySchema,
    rawQuery,
    "Tham số lọc danh sách Sprint không hợp lệ."
  );

  await assertProjectReadAccess(actor, validProjectId);
  return sprintRepository.findManyByProject(validProjectId, query);
}

export async function getSprintDetailService(
  actor: AuthContext,
  sprintId: string
): Promise<SprintDetailDTO> {
  assertPermission(actor, PERMISSIONS.SPRINT_READ);
  const validSprintId = parseSprintId(sprintId);
  await assertSprintReadAccess(actor, validSprintId);

  const detail = await sprintRepository.findDetailById(validSprintId);
  if (!detail) {
    throw new AppError({
      statusCode: 404,
      code: "SPRINT_NOT_FOUND",
      message: "Không tìm thấy Sprint yêu cầu.",
    });
  }
  return detail;
}

export async function createSprintService(
  actor: AuthContext,
  projectId: string,
  rawInput: unknown
): Promise<{
  sprint: SprintDetailDTO;
  overlappingSprints: SprintOverlapWarningDTO[];
}> {
  assertPermission(actor, PERMISSIONS.SPRINT_MANAGE);
  const validProjectId = parseProjectId(projectId);
  const input = parseSprintInput(createSprintSchema, rawInput, "Dữ liệu tạo Sprint không hợp lệ.");

  const result = await prisma.$transaction(async (tx) => {
    await assertProjectLeaderAccess(actor, validProjectId, tx);
    await lockProjectRowForSprintMutation(validProjectId, tx);

    const liveProject = await tx.project.findUnique({
      where: { id: validProjectId },
      select: { id: true, status: true },
    });
    if (!liveProject) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Không tìm thấy Project yêu cầu.",
      });
    }
    assertProjectNotArchivedForSprintMutation(liveProject.status);

    const created = await tx.sprint.create({
      data: {
        projectId: validProjectId,
        createdById: actor.userId,
        name: input.name,
        goal: input.goal ?? null,
        startDate: input.startDate,
        endDate: input.endDate,
        status: SprintStatus.PLANNED,
      },
      select: { id: true, name: true, startDate: true, endDate: true },
    });

    const overlappingSprints = await sprintRepository.findOverlappingSprints(
      validProjectId,
      input.startDate,
      input.endDate,
      created.id,
      tx
    );

    await tx.activityLog.create({
      data: {
        userId: actor.userId,
        action: "SPRINT_CREATED",
        entityType: "Sprint",
        entityId: created.id,
        description: `Tạo Sprint "${created.name}" (${formatSprintDateYmd(created.startDate)} → ${formatSprintDateYmd(created.endDate)})`,
        metadata: {
          projectId: validProjectId,
          startDate: formatSprintDateYmd(created.startDate),
          endDate: formatSprintDateYmd(created.endDate),
        },
      },
    });

    const detail = await sprintRepository.findDetailById(created.id, tx);
    if (!detail) {
      throw new AppError({
        statusCode: 404,
        code: "SPRINT_NOT_FOUND",
        message: "Không thể đọc Sprint vừa tạo.",
      });
    }

    return { sprint: detail, overlappingSprints };
  });

  logger.info("Sprint created", {
    actorId: actor.userId,
    projectId: validProjectId,
    sprintId: result.sprint.id,
  });

  return result;
}

export async function updateSprintService(
  actor: AuthContext,
  sprintId: string,
  rawInput: unknown
): Promise<{
  sprint: SprintDetailDTO;
  overlappingSprints: SprintOverlapWarningDTO[];
}> {
  assertPermission(actor, PERMISSIONS.SPRINT_MANAGE);
  const validSprintId = parseSprintId(sprintId);
  const input = parseSprintInput(
    updateSprintSchema,
    rawInput,
    "Dữ liệu cập nhật Sprint không hợp lệ."
  );

  const result = await prisma.$transaction(async (tx) => {
    const initial = await assertSprintManageAccess(actor, validSprintId, tx);
    await lockProjectRowForSprintMutation(initial.project.id, tx);

    const liveProject = await tx.project.findUnique({
      where: { id: initial.project.id },
      select: { status: true },
    });
    if (!liveProject) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Không tìm thấy Project yêu cầu.",
      });
    }
    assertProjectNotArchivedForSprintMutation(liveProject.status);

    const current = await loadSprintRecordOrThrow(validSprintId, tx);

    if (current.status === SprintStatus.COMPLETED || current.status === SprintStatus.CANCELLED) {
      throw conflictError(
        "SPRINT_INVALID_STATUS",
        "Sprint đã hoàn thành hoặc đã bị hủy nên không thể chỉnh sửa."
      );
    }

    if (
      input.expectedUpdatedAt &&
      new Date(input.expectedUpdatedAt).getTime() !== current.updatedAt.getTime()
    ) {
      throw conflictError(
        "CONFLICT",
        "Sprint vừa được cập nhật bởi thao tác khác. Vui lòng tải lại dữ liệu."
      );
    }

    if (
      current.status === SprintStatus.ACTIVE &&
      input.startDate !== undefined &&
      formatSprintDateYmd(input.startDate) !== formatSprintDateYmd(current.startDate)
    ) {
      throw conflictError(
        "SPRINT_INVALID_STATUS",
        "Sprint đang ACTIVE không được phép thay đổi ngày bắt đầu (startDate)."
      );
    }

    const nextStartDate =
      current.status === SprintStatus.ACTIVE
        ? current.startDate
        : (input.startDate ?? current.startDate);
    const nextEndDate = input.endDate ?? current.endDate;

    if (nextEndDate.getTime() < nextStartDate.getTime()) {
      throw new AppError({
        statusCode: 400,
        code: "SPRINT_DATE_INVALID",
        message: "Ngày kết thúc Sprint phải lớn hơn hoặc bằng ngày bắt đầu.",
        details: [
          {
            field: "endDate",
            message: "Ngày kết thúc Sprint phải lớn hơn hoặc bằng ngày bắt đầu.",
          },
        ],
      });
    }

    const updateData: Prisma.SprintUpdateManyMutationInput = {};
    const changedFields: string[] = [];

    if (input.name !== undefined && input.name !== current.name) {
      updateData.name = input.name;
      changedFields.push("name");
    }
    if (input.goal !== undefined && input.goal !== current.goal) {
      updateData.goal = input.goal;
      changedFields.push("goal");
    }
    if (
      current.status === SprintStatus.PLANNED &&
      input.startDate !== undefined &&
      formatSprintDateYmd(input.startDate) !== formatSprintDateYmd(current.startDate)
    ) {
      updateData.startDate = input.startDate;
      changedFields.push("startDate");
    }
    if (
      input.endDate !== undefined &&
      formatSprintDateYmd(input.endDate) !== formatSprintDateYmd(current.endDate)
    ) {
      updateData.endDate = input.endDate;
      changedFields.push("endDate");
    }

    if (changedFields.length > 0) {
      const updated = await tx.sprint.updateMany({
        where: {
          id: current.id,
          status: current.status,
          updatedAt: current.updatedAt,
        },
        data: updateData,
      });

      if (updated.count === 0) {
        throw conflictError(
          "CONFLICT",
          "Không thể cập nhật Sprint do trạng thái hoặc phiên bản dữ liệu vừa thay đổi."
        );
      }

      await tx.activityLog.create({
        data: {
          userId: actor.userId,
          action: "SPRINT_UPDATED",
          entityType: "Sprint",
          entityId: current.id,
          description: `Cập nhật Sprint "${input.name ?? current.name}" (${changedFields.join(", ")})`,
          metadata: {
            projectId: current.projectId,
            changedFields,
          },
        },
      });
    }

    const overlappingSprints = await sprintRepository.findOverlappingSprints(
      current.projectId,
      nextStartDate,
      nextEndDate,
      current.id,
      tx
    );

    const detail = await sprintRepository.findDetailById(current.id, tx);
    if (!detail) {
      throw new AppError({
        statusCode: 404,
        code: "SPRINT_NOT_FOUND",
        message: "Không tìm thấy Sprint sau khi cập nhật.",
      });
    }

    return { sprint: detail, overlappingSprints };
  });

  logger.info("Sprint updated", {
    actorId: actor.userId,
    sprintId: validSprintId,
  });

  return result;
}

export async function activateSprintService(
  actor: AuthContext,
  sprintId: string
): Promise<SprintDetailDTO> {
  assertPermission(actor, PERMISSIONS.SPRINT_MANAGE);
  const validSprintId = parseSprintId(sprintId);

  const detail = await prisma.$transaction(async (tx) => {
    const initial = await assertSprintManageAccess(actor, validSprintId, tx);
    await lockProjectRowForSprintMutation(initial.project.id, tx);
    await acquireSprintPlanningLock(initial.project.id, tx);

    const liveProject = await tx.project.findUnique({
      where: { id: initial.project.id },
      select: { id: true, status: true },
    });
    if (!liveProject) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Không tìm thấy Project yêu cầu.",
      });
    }
    assertProjectActiveForSprintActivation(liveProject.status);

    const current = await loadSprintRecordOrThrow(validSprintId, tx);
    if (current.status !== SprintStatus.PLANNED) {
      throw conflictError(
        "INVALID_STATUS_TRANSITION",
        "Chỉ có thể kích hoạt Sprint đang ở trạng thái PLANNED."
      );
    }

    const now = new Date();
    const updated = await tx.sprint.updateMany({
      where: {
        id: current.id,
        status: SprintStatus.PLANNED,
      },
      data: {
        status: SprintStatus.ACTIVE,
        activatedAt: now,
      },
    });

    if (updated.count !== 1) {
      throw conflictError(
        "INVALID_STATUS_TRANSITION",
        "Sprint không còn ở trạng thái PLANNED để kích hoạt."
      );
    }

    await tx.activityLog.create({
      data: {
        userId: actor.userId,
        action: "SPRINT_ACTIVATED",
        entityType: "Sprint",
        entityId: current.id,
        description: `Kích hoạt Sprint "${current.name}" sang ACTIVE`,
        metadata: {
          projectId: current.projectId,
          activatedAt: now.toISOString(),
        },
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: "SPRINT_ACTIVATED",
        entityType: "Sprint",
        entityId: current.id,
        oldValue: { status: SprintStatus.PLANNED },
        newValue: { status: SprintStatus.ACTIVE, activatedAt: now.toISOString() },
      },
    });

    const refreshed = await sprintRepository.findDetailById(current.id, tx);
    if (!refreshed) {
      throw new AppError({
        statusCode: 404,
        code: "SPRINT_NOT_FOUND",
        message: "Không tìm thấy Sprint vừa kích hoạt.",
      });
    }
    return refreshed;
  });

  logger.info("Sprint activated", {
    actorId: actor.userId,
    projectId: detail.projectId,
    sprintId: detail.id,
  });

  return detail;
}

export async function cancelSprintService(
  actor: AuthContext,
  sprintId: string,
  rawInput: unknown = {}
): Promise<SprintDetailDTO> {
  assertPermission(actor, PERMISSIONS.SPRINT_MANAGE);
  const validSprintId = parseSprintId(sprintId);
  const input = parseSprintInput(
    cancelSprintSchema,
    rawInput ?? {},
    "Dữ liệu hủy Sprint không hợp lệ."
  );

  const detail = await prisma.$transaction(async (tx) => {
    const initial = await assertSprintManageAccess(actor, validSprintId, tx);
    await lockProjectRowForSprintMutation(initial.project.id, tx);
    await acquireSprintPlanningLock(initial.project.id, tx);

    const liveProject = await tx.project.findUnique({
      where: { id: initial.project.id },
      select: { id: true, status: true },
    });
    if (!liveProject) {
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Không tìm thấy Project yêu cầu.",
      });
    }
    assertProjectNotArchivedForSprintMutation(liveProject.status);

    const current = await loadSprintRecordOrThrow(validSprintId, tx);
    if (current.status === SprintStatus.ACTIVE) {
      throw conflictError(
        "INVALID_STATUS_TRANSITION",
        "Không thể hủy Sprint đang ACTIVE. Vui lòng sử dụng chức năng Complete Sprint."
      );
    }
    if (current.status !== SprintStatus.PLANNED) {
      throw conflictError(
        "INVALID_STATUS_TRANSITION",
        "Chỉ có thể hủy Sprint đang ở trạng thái PLANNED."
      );
    }

    await lockSprintTasksForUpdate(current.id, tx);

    const unfinishedTasks = await tx.task.findMany({
      where: {
        sprintId: current.id,
        status: { not: TaskStatus.DONE },
      },
      select: { id: true },
    });

    if (unfinishedTasks.length > 0) {
      const unfinishedIds = unfinishedTasks.map((t) => t.id);
      await tx.task.updateMany({
        where: {
          id: { in: unfinishedIds },
          sprintId: current.id,
          status: { not: TaskStatus.DONE },
        },
        data: { sprintId: null },
      });

      await taskHistoryRepository.appendManyTaskHistories(
        unfinishedIds.map((taskId) => ({
          taskId,
          actorId: actor.userId,
          action: TaskHistoryAction.SPRINT_REMOVED,
          oldValue: { sprintId: current.id, sprintName: current.name },
          newValue: { sprintId: null },
          metadata: {
            source: "SPRINT_CANCELLED",
            reason: input.reason ?? null,
          },
        })),
        tx
      );
    }

    const now = new Date();
    const cancelled = await tx.sprint.updateMany({
      where: {
        id: current.id,
        status: SprintStatus.PLANNED,
      },
      data: {
        status: SprintStatus.CANCELLED,
        cancelledAt: now,
      },
    });

    if (cancelled.count !== 1) {
      throw conflictError(
        "INVALID_STATUS_TRANSITION",
        "Sprint không còn ở trạng thái PLANNED để hủy."
      );
    }

    await tx.activityLog.create({
      data: {
        userId: actor.userId,
        action: "SPRINT_CANCELLED",
        entityType: "Sprint",
        entityId: current.id,
        description: `Hủy Sprint "${current.name}" (trả ${unfinishedTasks.length} Task về Backlog)`,
        metadata: {
          projectId: current.projectId,
          returnedToBacklogCount: unfinishedTasks.length,
          reason: input.reason ?? null,
        },
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: "SPRINT_CANCELLED",
        entityType: "Sprint",
        entityId: current.id,
        oldValue: { status: SprintStatus.PLANNED },
        newValue: {
          status: SprintStatus.CANCELLED,
          cancelledAt: now.toISOString(),
          reason: input.reason ?? null,
        },
      },
    });

    const refreshed = await sprintRepository.findDetailById(current.id, tx);
    if (!refreshed) {
      throw new AppError({
        statusCode: 404,
        code: "SPRINT_NOT_FOUND",
        message: "Không tìm thấy Sprint sau khi hủy.",
      });
    }
    return refreshed;
  });

  logger.info("Sprint cancelled", {
    actorId: actor.userId,
    projectId: detail.projectId,
    sprintId: detail.id,
  });

  return detail;
}
