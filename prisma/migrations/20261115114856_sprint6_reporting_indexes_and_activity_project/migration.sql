-- DropIndex
DROP INDEX "ActivityLog_createdAt_idx";

-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN     "projectId" UUID;

-- CreateIndex
CREATE INDEX "ActivityLog_projectId_createdAt_id_idx" ON "ActivityLog"("projectId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "ActivityLog_userId_createdAt_id_idx" ON "ActivityLog"("userId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_id_idx" ON "ActivityLog"("createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "Task_projectId_completedAt_idx" ON "Task"("projectId", "completedAt");

-- CreateIndex
CREATE INDEX "TaskHistory_actorId_action_createdAt_idx" ON "TaskHistory"("actorId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "TaskHistory_createdAt_id_idx" ON "TaskHistory"("createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "TaskReview_taskId_decision_reviewedAt_idx" ON "TaskReview"("taskId", "decision", "reviewedAt");

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Guarded & idempotent SQL backfill for legacy Project, ProjectMember, Sprint, and Document ActivityLog rows (DEC-055)
UPDATE "ActivityLog" AS a
SET "projectId" = a."entityId"
WHERE a."projectId" IS NULL
  AND a."entityType" = 'Project'
  AND a."entityId" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "Project" AS p
    WHERE p."id" = a."entityId"
  );

UPDATE "ActivityLog" AS a
SET "projectId" = (a."metadata"->>'projectId')::uuid
WHERE a."projectId" IS NULL
  AND a."entityType" IN ('Project', 'ProjectMember', 'Sprint', 'Document')
  AND (a."metadata"->>'projectId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1
    FROM "Project" AS p
    WHERE p."id" = (a."metadata"->>'projectId')::uuid
  );
