-- Sprint 7: Security Hardening, Sliding Window Rate Limiting, Session Token Versioning & SMTP Migration
-- Additive migration preserving all existing Sprint 1-6 constraints, partial indexes, triggers, and custom role grants.

-- 1. Extend NotificationDeliveryStatus with UNKNOWN for ambiguous post-DATA SMTP outcomes
ALTER TYPE "NotificationDeliveryStatus" ADD VALUE IF NOT EXISTS 'UNKNOWN';

-- 2. Add session revocation version counter on User (invalidates existing JWTs on password change, SUSPEND, or role change)
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- 3. Switch default outbound email provider column value from RESEND to SMTP (preserves historical rows)
ALTER TABLE "NotificationDelivery"
  ALTER COLUMN "provider" SET DEFAULT 'SMTP';

-- 4. Create Sliding Window Log table for atomic PostgreSQL rate limiting (DEC-065)
CREATE TABLE IF NOT EXISTS "RateLimitEvent" (
  "id" UUID NOT NULL,
  "keyHash" VARCHAR(64) NOT NULL,
  "scope" VARCHAR(50) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RateLimitEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RateLimitEvent_keyHash_createdAt_idx"
  ON "RateLimitEvent"("keyHash", "createdAt");

CREATE INDEX IF NOT EXISTS "RateLimitEvent_expiresAt_idx"
  ON "RateLimitEvent"("expiresAt");

-- 5. Create atomic rolling-24h SMTP send attempt quota ledger
CREATE TABLE IF NOT EXISTS "SmtpQuotaAttempt" (
  "id" UUID NOT NULL,
  "deliveryId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SmtpQuotaAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SmtpQuotaAttempt_createdAt_idx"
  ON "SmtpQuotaAttempt"("createdAt");

-- 6. One-time additive RBAC permission migration: project.template.manage (28th permission)
-- Granted exclusively to ADMIN once without altering any other Admin-customized RolePermission assignments.
INSERT INTO "Permission" ("id", "code", "name", "description", "createdAt")
SELECT
  gen_random_uuid(),
  'project.template.manage',
  'Manage Project Templates',
  'Tạo, chỉnh sửa và xóa Project Template',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "Permission" WHERE "code" = 'project.template.manage'
);

INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT
  gen_random_uuid(),
  r."id",
  p."id",
  NOW()
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."name" = 'ADMIN'
  AND p."code" = 'project.template.manage'
  AND NOT EXISTS (
    SELECT 1
    FROM "RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );
