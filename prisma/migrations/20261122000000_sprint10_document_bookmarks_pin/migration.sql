-- Additive migration adding isPinned to Document for Quick Bookmarks / Project Toolkit bar.

ALTER TABLE "Document" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Document_projectId_deletedAt_isPinned_idx" ON "Document"("projectId", "deletedAt", "isPinned");
