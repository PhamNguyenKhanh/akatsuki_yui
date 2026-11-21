-- CreateTable
CREATE TABLE "TaskSubtask" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskSubtask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskSubtask_taskId_sortOrder_createdAt_idx" ON "TaskSubtask"("taskId", "sortOrder", "createdAt");

-- CreateIndex
CREATE INDEX "TaskSubtask_createdById_idx" ON "TaskSubtask"("createdById");

-- AddForeignKey
ALTER TABLE "TaskSubtask" ADD CONSTRAINT "TaskSubtask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSubtask" ADD CONSTRAINT "TaskSubtask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
