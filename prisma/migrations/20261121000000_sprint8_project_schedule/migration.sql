-- Sprint 8: Project Member Weekly Busy Schedule Module
-- Additive migration adding ProjectScheduleEntry, ProjectScheduleException, and schedule.* RBAC permissions.

-- CreateEnum
CREATE TYPE "ScheduleExceptionType" AS ENUM ('CANCELLED', 'OVERRIDDEN');

-- CreateTable
CREATE TABLE "ProjectScheduleEntry" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "repeatUntil" DATE,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectScheduleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectScheduleException" (
    "id" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "exceptionDate" DATE NOT NULL,
    "type" "ScheduleExceptionType" NOT NULL,
    "overrideStartMinute" INTEGER,
    "overrideEndMinute" INTEGER,
    "overrideNote" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectScheduleException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectScheduleEntry_projectId_date_idx" ON "ProjectScheduleEntry"("projectId", "date");

-- CreateIndex
CREATE INDEX "ProjectScheduleEntry_projectId_isRecurring_dayOfWeek_idx" ON "ProjectScheduleEntry"("projectId", "isRecurring", "dayOfWeek");

-- CreateIndex
CREATE INDEX "ProjectScheduleEntry_projectId_userId_date_idx" ON "ProjectScheduleEntry"("projectId", "userId", "date");

-- CreateIndex
CREATE INDEX "ProjectScheduleException_exceptionDate_idx" ON "ProjectScheduleException"("exceptionDate");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectScheduleException_entryId_exceptionDate_key" ON "ProjectScheduleException"("entryId", "exceptionDate");

-- AddForeignKey
ALTER TABLE "ProjectScheduleEntry" ADD CONSTRAINT "ProjectScheduleEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectScheduleEntry" ADD CONSTRAINT "ProjectScheduleEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectScheduleException" ADD CONSTRAINT "ProjectScheduleException_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ProjectScheduleEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraints
ALTER TABLE "ProjectScheduleEntry"
  ADD CONSTRAINT "ProjectScheduleEntry_dayOfWeek_chk" CHECK ("dayOfWeek" >= 1 AND "dayOfWeek" <= 7);

ALTER TABLE "ProjectScheduleEntry"
  ADD CONSTRAINT "ProjectScheduleEntry_minute_range_chk" CHECK ("startMinute" >= 0 AND "startMinute" < "endMinute" AND "endMinute" <= 1440);

ALTER TABLE "ProjectScheduleEntry"
  ADD CONSTRAINT "ProjectScheduleEntry_repeatUntil_chk" CHECK ("repeatUntil" IS NULL OR "repeatUntil" >= "date");

ALTER TABLE "ProjectScheduleException"
  ADD CONSTRAINT "ProjectScheduleException_override_chk" CHECK (
    ("type" = 'CANCELLED') OR
    ("overrideStartMinute" IS NOT NULL AND "overrideEndMinute" IS NOT NULL AND "overrideStartMinute" >= 0 AND "overrideStartMinute" < "overrideEndMinute" AND "overrideEndMinute" <= 1440)
  );

-- One-time additive RBAC permission migration: schedule.read & schedule.manage
INSERT INTO "Permission" ("id", "code", "name", "description", "createdAt")
SELECT
  gen_random_uuid(),
  'schedule.read',
  'Read Project Schedule',
  'Xem lịch bận các thành viên trong Project',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "Permission" WHERE "code" = 'schedule.read'
);

INSERT INTO "Permission" ("id", "code", "name", "description", "createdAt")
SELECT
  gen_random_uuid(),
  'schedule.manage',
  'Manage Own Schedule',
  'Tạo, sửa và xóa lịch bận cá nhân trong Project',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "Permission" WHERE "code" = 'schedule.manage'
);

-- Grant schedule.read to ADMIN, LEADER, MEMBER, INSTRUCTOR
INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT
  gen_random_uuid(),
  r."id",
  p."id",
  NOW()
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."name" IN ('ADMIN', 'LEADER', 'MEMBER', 'INSTRUCTOR')
  AND p."code" = 'schedule.read'
  AND NOT EXISTS (
    SELECT 1
    FROM "RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- Grant schedule.manage to ADMIN, LEADER, MEMBER (INSTRUCTOR stays read-only)
INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT
  gen_random_uuid(),
  r."id",
  p."id",
  NOW()
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."name" IN ('ADMIN', 'LEADER', 'MEMBER')
  AND p."code" = 'schedule.manage'
  AND NOT EXISTS (
    SELECT 1
    FROM "RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );
