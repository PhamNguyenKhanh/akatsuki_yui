import "server-only";
import { logger } from "@/lib/logger";

export type TaskDomainEvent =
  | {
      type: "TASK_ASSIGNED";
      projectId: string;
      taskId: string;
      taskTitle: string;
      actorId: string;
      recipientUserIds: string[];
    }
  | {
      type: "TASK_SUBMITTED_FOR_REVIEW";
      projectId: string;
      taskId: string;
      taskTitle: string;
      actorId: string;
      recipientUserIds: string[];
      note: string | null;
    }
  | {
      type: "TASK_REVIEW_APPROVED";
      projectId: string;
      taskId: string;
      taskTitle: string;
      actorId: string;
      recipientUserIds: string[];
      reason: string;
    }
  | {
      type: "TASK_REVIEW_REJECTED";
      projectId: string;
      taskId: string;
      taskTitle: string;
      actorId: string;
      recipientUserIds: string[];
      reason: string;
    };

export type TaskEventHandler = (event: TaskDomainEvent) => Promise<void> | void;

const defaultTaskEventHandler: TaskEventHandler = (event) => {
  logger.info("Task domain event emitted (Sprint 5 notification hook)", {
    eventType: event.type,
    projectId: event.projectId,
    taskId: event.taskId,
    actorId: event.actorId,
    recipientCount: event.recipientUserIds.length,
  });
};

let registeredHandler: TaskEventHandler = defaultTaskEventHandler;

/**
 * Allows Sprint 5 notification module (or tests) to subscribe after DB commit
 * without modifying Sprint 3 task services.
 */
export function registerTaskEventHandler(handler: TaskEventHandler): () => void {
  registeredHandler = handler;
  return () => {
    registeredHandler = defaultTaskEventHandler;
  };
}

/**
 * Must ONLY be invoked after prisma.$transaction resolves cleanly.
 * Any hook failure is isolated so already-committed business state is unaffected.
 */
export async function emitTaskEventAfterCommit(event: TaskDomainEvent): Promise<void> {
  try {
    await registeredHandler(event);
  } catch (error) {
    logger.error("Task domain event hook failed", error, {
      eventType: event.type,
      taskId: event.taskId,
      projectId: event.projectId,
    });
  }
}
