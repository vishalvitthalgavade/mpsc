ALTER TABLE "active_study_sessions"
ADD COLUMN "ownerId" TEXT,
ADD COLUMN "ownerLabel" TEXT;

-- Existing timers were created before ownership existed. Give them a stable
-- legacy owner so the first new browser must explicitly take them over.
UPDATE "active_study_sessions"
SET "ownerId" = md5("id" || ':legacy-timer-owner'),
    "ownerLabel" = 'Existing timer from an older app version'
WHERE "ownerId" IS NULL;

CREATE INDEX "active_study_sessions_ownerId_idx"
ON "active_study_sessions"("ownerId");
