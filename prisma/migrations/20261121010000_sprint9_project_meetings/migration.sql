-- Sprint 9: Google Meet Links & Project Meetings Management
-- Additive migration adding ProjectMeetLink, ProjectMeeting, ProjectMeetingParticipant, and meeting.* RBAC permissions.

-- CreateEnum
CREATE TYPE "ProjectMeetingStatus" AS ENUM ('SCHEDULED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ProjectMeetLink" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "description" VARCHAR(500),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMeetLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMeeting" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "meetLinkId" UUID,
    "createdById" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "meetUrl" VARCHAR(500) NOT NULL,
    "date" DATE NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "ProjectMeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMeetingParticipant" (
    "id" UUID NOT NULL,
    "meetingId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMeetingParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectMeetLink_projectId_createdAt_idx" ON "ProjectMeetLink"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectMeeting_projectId_status_date_startMinute_idx" ON "ProjectMeeting"("projectId", "status", "date", "startMinute");

-- CreateIndex
CREATE INDEX "ProjectMeeting_projectId_startAt_idx" ON "ProjectMeeting"("projectId", "startAt");

-- CreateIndex
CREATE INDEX "ProjectMeetingParticipant_userId_idx" ON "ProjectMeetingParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMeetingParticipant_meetingId_userId_key" ON "ProjectMeetingParticipant"("meetingId", "userId");

-- AddForeignKey
ALTER TABLE "ProjectMeetLink" ADD CONSTRAINT "ProjectMeetLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMeetLink" ADD CONSTRAINT "ProjectMeetLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMeeting" ADD CONSTRAINT "ProjectMeeting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMeeting" ADD CONSTRAINT "ProjectMeeting_meetLinkId_fkey" FOREIGN KEY ("meetLinkId") REFERENCES "ProjectMeetLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMeeting" ADD CONSTRAINT "ProjectMeeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMeetingParticipant" ADD CONSTRAINT "ProjectMeetingParticipant_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "ProjectMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMeetingParticipant" ADD CONSTRAINT "ProjectMeetingParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraints
ALTER TABLE "ProjectMeetLink"
  ADD CONSTRAINT "ProjectMeetLink_label_nonempty_chk" CHECK (length(btrim("label")) > 0);

ALTER TABLE "ProjectMeeting"
  ADD CONSTRAINT "ProjectMeeting_title_nonempty_chk" CHECK (length(btrim("title")) > 0);

ALTER TABLE "ProjectMeeting"
  ADD CONSTRAINT "ProjectMeeting_minute_range_chk" CHECK ("startMinute" >= 0 AND "startMinute" < "endMinute" AND "endMinute" <= 1440);

ALTER TABLE "ProjectMeeting"
  ADD CONSTRAINT "ProjectMeeting_time_order_chk" CHECK ("endAt" > "startAt");

-- One-time additive RBAC permission migration: meeting.read & meeting.manage
INSERT INTO "Permission" ("id", "code", "name", "description", "createdAt")
SELECT
  gen_random_uuid(),
  'meeting.read',
  'Read Project Meetings',
  'Xem lịch họp và danh sách link Google Meet của Project',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "Permission" WHERE "code" = 'meeting.read'
);

INSERT INTO "Permission" ("id", "code", "name", "description", "createdAt")
SELECT
  gen_random_uuid(),
  'meeting.manage',
  'Manage Project Meetings',
  'Tạo, sửa, hủy cuộc họp và quản lý link Google Meet của Project',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "Permission" WHERE "code" = 'meeting.manage'
);

-- Grant meeting.read to ADMIN, LEADER, MEMBER, INSTRUCTOR
INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT
  gen_random_uuid(),
  r."id",
  p."id",
  NOW()
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."name" IN ('ADMIN', 'LEADER', 'MEMBER', 'INSTRUCTOR')
  AND p."code" = 'meeting.read'
  AND NOT EXISTS (
    SELECT 1
    FROM "RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );

-- Grant meeting.manage to ADMIN, LEADER
INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT
  gen_random_uuid(),
  r."id",
  p."id",
  NOW()
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."name" IN ('ADMIN', 'LEADER')
  AND p."code" = 'meeting.manage'
  AND NOT EXISTS (
    SELECT 1
    FROM "RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );
