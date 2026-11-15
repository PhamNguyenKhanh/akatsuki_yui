-- CreateEnum
CREATE TYPE "SprintStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TaskHistoryAction" ADD VALUE 'SPRINT_ASSIGNED';
ALTER TYPE "TaskHistoryAction" ADD VALUE 'SPRINT_REMOVED';
ALTER TYPE "TaskHistoryAction" ADD VALUE 'SPRINT_MOVED';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "sprintId" UUID;

-- CreateTable
CREATE TABLE "Sprint" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "goal" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "SprintStatus" NOT NULL DEFAULT 'PLANNED',
    "activatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sprint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sprint_projectId_status_idx" ON "Sprint"("projectId", "status");

-- CreateIndex
CREATE INDEX "Sprint_projectId_startDate_endDate_idx" ON "Sprint"("projectId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Sprint_createdById_idx" ON "Sprint"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Sprint_projectId_id_key" ON "Sprint"("projectId", "id");

-- CreateIndex
CREATE INDEX "Task_projectId_sprintId_status_idx" ON "Task"("projectId", "sprintId", "status");

-- CreateIndex
CREATE INDEX "Task_sprintId_status_idx" ON "Task"("sprintId", "status");

-- AddForeignKey
ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- CreatePartialIndex: Product Backlog lookup (sprintId IS NULL)
CREATE INDEX "Task_projectId_backlog_deadline_idx"
ON "Task"("projectId", "deadline")
WHERE "sprintId" IS NULL;

-- AddCheckConstraints: Sprint invariants
ALTER TABLE "Sprint"
ADD CONSTRAINT "Sprint_date_range_chk" CHECK ("endDate" >= "startDate");

ALTER TABLE "Sprint"
ADD CONSTRAINT "Sprint_name_nonempty_chk" CHECK (length(btrim("name")) > 0);

ALTER TABLE "Sprint"
ADD CONSTRAINT "Sprint_status_timestamps_chk"
CHECK (
  ("status" <> 'COMPLETED' OR "completedAt" IS NOT NULL)
  AND ("status" <> 'CANCELLED' OR "cancelledAt" IS NOT NULL)
);

-- CreateTrigger: Enforce Task.projectId == Sprint.projectId when Task.sprintId IS NOT NULL
CREATE OR REPLACE FUNCTION check_task_sprint_same_project()
RETURNS TRIGGER AS $$
DECLARE
  target_project_id UUID;
BEGIN
  IF NEW."sprintId" IS NOT NULL THEN
    SELECT "projectId" INTO target_project_id
    FROM "Sprint"
    WHERE "id" = NEW."sprintId";

    IF target_project_id IS NULL OR target_project_id <> NEW."projectId" THEN
      RAISE EXCEPTION 'Task % (project %) cannot be assigned to Sprint % (project %)',
        NEW."id", NEW."projectId", NEW."sprintId", target_project_id
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_task_sprint_same_project
  BEFORE INSERT OR UPDATE OF "projectId", "sprintId" ON "Task"
  FOR EACH ROW
  EXECUTE FUNCTION check_task_sprint_same_project();
