import type {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationType,
  Prisma,
} from "@prisma/client";

export interface NotificationActorDTO {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
}

export interface NotificationProjectSummaryDTO {
  id: string;
  name: string;
}

export interface NotificationDTO {
  id: string;
  userId: string;
  actorId: string | null;
  projectId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  targetUrl: string | null;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  dedupKey: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  actor: NotificationActorDTO | null;
  project: NotificationProjectSummaryDTO | null;
}

export interface NotificationListResponseDTO {
  items: NotificationDTO[];
  totalItems: number;
  unreadCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface NotificationDeliveryDTO {
  id: string;
  notificationId: string;
  channel: NotificationChannel;
  recipientEmail: string;
  status: NotificationDeliveryStatus;
  provider: string;
  providerMessageId: string | null;
  retryCount: number;
  maxRetries: number;
  isTerminalFailure: boolean;
  requiresReview: boolean;
  canManualRetry: boolean;
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
  lockedAt: string | null;
  sentAt: string | null;
  failedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  notification: {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    targetUrl: string | null;
    entityType: string;
    entityId: string;
    createdAt: string;
    recipientName: string;
  };
}

export interface SmtpQuotaSummaryDTO {
  usedLast24h: number;
  dailyLimit: number;
  remainingLast24h: number;
  isNearLimit: boolean;
  isQuotaExceeded: boolean;
}

export interface NotificationDeliverySummaryStatsDTO {
  pendingCount: number;
  sentCount: number;
  retryableFailedCount: number;
  terminalFailedCount: number;
  unknownReviewCount: number;
  quota?: SmtpQuotaSummaryDTO;
}

export interface NotificationDeliveryListResponseDTO {
  items: NotificationDeliveryDTO[];
  totalItems: number;
  summary: NotificationDeliverySummaryStatsDTO;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateTransactionalNotificationInput {
  recipientUserId: string;
  recipientEmail?: string;
  actorId?: string | null;
  projectId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  targetUrl?: string | null;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
  dedupKey?: string | null;
  sendEmail?: boolean;
  allowNonActiveRecipient?: boolean;
}

export interface CreatedNotificationDispatchHandle {
  notificationId: string;
  deliveryId: string | null;
  recipientUserId: string;
  recipientEmail: string;
  type: NotificationType;
}
