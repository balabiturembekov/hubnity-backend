-- AlterTable
ALTER TABLE "AppActivity" ADD COLUMN     "category" TEXT,
ADD COLUMN     "domain" TEXT;

-- CreateTable
CREATE TABLE "IdlePeriod" (
    "id" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "duration" INTEGER,
    "reason" TEXT,
    "timeEntryId" TEXT NOT NULL,

    CONSTRAINT "IdlePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdlePeriod_timeEntryId_idx" ON "IdlePeriod"("timeEntryId");

-- CreateIndex
CREATE INDEX "IdlePeriod_startTime_idx" ON "IdlePeriod"("startTime");

-- CreateIndex
CREATE INDEX "AppActivity_trackedAt_idx" ON "AppActivity"("trackedAt");

-- CreateIndex
CREATE INDEX "AppActivity_domain_idx" ON "AppActivity"("domain");

-- AddForeignKey
ALTER TABLE "IdlePeriod" ADD CONSTRAINT "IdlePeriod_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "time_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
