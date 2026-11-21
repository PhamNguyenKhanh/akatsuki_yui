export const PUSHER_EVENTS = {
  TASK_COMMENT_CREATED: "task-comment:created",
  TASK_COMMENT_DELETED: "task-comment:deleted",
  NOTIFICATION_CREATED: "notification:created",
} as const;

export function getTaskCommentsChannel(taskId: string): string {
  return `private-task-${taskId}`;
}

export function getUserNotificationsChannel(userId: string): string {
  return `private-user-${userId}`;
}
