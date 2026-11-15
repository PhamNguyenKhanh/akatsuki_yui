-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('SPECIFICATION', 'DESIGN', 'REPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ACCOUNT_REGISTERED', 'ACCOUNT_APPROVED', 'ACCOUNT_REJECTED', 'TASK_ASSIGNED', 'TASK_SUBMITTED_FOR_REVIEW', 'TASK_REVIEW_APPROVED', 'TASK_REVIEW_REJECTED', 'PROJECT_MEMBER_ADDED', 'PROJECT_MEMBER_REMOVED', 'PROJECT_LEADER_CHANGED', 'TASK_DEADLINE_REMINDER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "sprintId" UUID,
    "uploadedById" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "url" VARCHAR(1000) NOT NULL,
    "category" "DocumentCategory" NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "actorId" UUID,
    "projectId" UUID,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "targetUrl" VARCHAR(500),
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" UUID NOT NULL,
    "metadata" JSONB,
    "dedupKey" VARCHAR(200),
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" UUID NOT NULL,
    "notificationId" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "recipientEmail" VARCHAR(255) NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "provider" VARCHAR(50) NOT NULL DEFAULT 'RESEND',
    "providerMessageId" VARCHAR(255),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "lockToken" VARCHAR(100),
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorCode" VARCHAR(100),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Document_projectId_deletedAt_category_createdAt_idx" ON "Document"("projectId", "deletedAt", "category", "createdAt");

-- CreateIndex
CREATE INDEX "Document_sprintId_deletedAt_idx" ON "Document"("sprintId", "deletedAt");

-- CreateIndex
CREATE INDEX "Document_uploadedById_idx" ON "Document"("uploadedById");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_projectId_idx" ON "Notification"("projectId");

-- CreateIndex
CREATE INDEX "Notification_type_createdAt_idx" ON "Notification"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_dedupKey_key" ON "Notification"("userId", "dedupKey");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_nextRetryAt_idx" ON "NotificationDelivery"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_lockedAt_idx" ON "NotificationDelivery"("status", "lockedAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_recipientEmail_createdAt_idx" ON "NotificationDelivery"("recipientEmail", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "NotificationDelivery_createdAt_idx" ON "NotificationDelivery"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_notificationId_channel_key" ON "NotificationDelivery"("notificationId", "channel");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraints: Document & NotificationDelivery invariants
ALTER TABLE "Document"
ADD CONSTRAINT "Document_title_nonempty_chk" CHECK (length(btrim("title")) > 0);

ALTER TABLE "NotificationDelivery"
ADD CONSTRAINT "NotificationDelivery_retry_count_chk" CHECK ("retryCount" >= 0 AND "retryCount" <= 3);

-- CreateTrigger: Enforce Document.projectId == Sprint.projectId when Document.sprintId IS NOT NULL
CREATE OR REPLACE FUNCTION check_document_sprint_same_project()
RETURNS TRIGGER AS $$
DECLARE
  target_project_id UUID;
BEGIN
  IF NEW."sprintId" IS NOT NULL THEN
    SELECT "projectId" INTO target_project_id
    FROM "Sprint"
    WHERE "id" = NEW."sprintId";

    IF target_project_id IS NULL OR target_project_id <> NEW."projectId" THEN
      RAISE EXCEPTION 'Document % (project %) cannot be linked to Sprint % (project %)',
        NEW."id", NEW."projectId", NEW."sprintId", target_project_id
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_document_sprint_same_project
  BEFORE INSERT OR UPDATE OF "projectId", "sprintId" ON "Document"
  FOR EACH ROW
  EXECUTE FUNCTION check_document_sprint_same_project();

