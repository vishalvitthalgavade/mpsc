-- CreateTable
CREATE TABLE "active_study_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "pausedAt" TIMESTAMP(3),
    "accumulatedSeconds" INTEGER NOT NULL DEFAULT 0,
    "isRunning" BOOLEAN NOT NULL DEFAULT true,
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "active_study_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "active_study_sessions_userId_key" ON "active_study_sessions"("userId");

-- CreateIndex
CREATE INDEX "active_study_sessions_isRunning_idx" ON "active_study_sessions"("isRunning");

-- CreateIndex
CREATE INDEX "active_study_sessions_lastHeartbeatAt_idx" ON "active_study_sessions"("lastHeartbeatAt");

-- AddForeignKey
ALTER TABLE "active_study_sessions" ADD CONSTRAINT "active_study_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
