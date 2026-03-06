/*
  Warnings:

  - You are about to drop the column `editedAt` on the `TimeEditLog` table. All the data in the column will be lost.
  - You are about to drop the column `editedById` on the `TimeEditLog` table. All the data in the column will be lost.
  - Added the required column `userId` to the `TimeEditLog` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."TimeEditLog" DROP CONSTRAINT "TimeEditLog_editedById_fkey";

-- AlterTable
ALTER TABLE "TimeEditLog" DROP COLUMN "editedAt",
DROP COLUMN "editedById",
ADD COLUMN     "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "userAgent" TEXT,
ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "time_entries" ADD COLUMN     "locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "lockedById" TEXT;

-- CreateTable
CREATE TABLE "LockedPeriod" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "lockedById" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "unlockedById" TEXT,
    "unlockedAt" TIMESTAMP(3),

    CONSTRAINT "LockedPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LockedPeriod_organizationId_isActive_idx" ON "LockedPeriod"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LockedPeriod_organizationId_startDate_endDate_key" ON "LockedPeriod"("organizationId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "TimeEditLog_userId_idx" ON "TimeEditLog"("userId");

-- CreateIndex
CREATE INDEX "TimeEditLog_changedAt_idx" ON "TimeEditLog"("changedAt");

-- AddForeignKey
ALTER TABLE "TimeEditLog" ADD CONSTRAINT "TimeEditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LockedPeriod" ADD CONSTRAINT "LockedPeriod_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LockedPeriod" ADD CONSTRAINT "LockedPeriod_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LockedPeriod" ADD CONSTRAINT "LockedPeriod_unlockedById_fkey" FOREIGN KEY ("unlockedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
