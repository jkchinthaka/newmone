-- CreateEnum
CREATE TYPE "CleaningFrequencyUnit" AS ENUM ('PER_DAY', 'PER_WEEK');

-- CreateEnum
CREATE TYPE "CleaningShift" AS ENUM ('MORNING', 'EVENING', 'NIGHT', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "CleaningScheduleStatus" AS ENUM ('ON_TIME', 'LATE');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CLEANING_LATE_VISIT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CLEANING_HIGH_ISSUE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CLEANING_SLA_BREACH';

-- AlterTable
ALTER TABLE "CleaningLocation"
ADD COLUMN     "cleaningFrequency" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "cleaningFrequencyUnit" "CleaningFrequencyUnit" NOT NULL DEFAULT 'PER_DAY',
ADD COLUMN     "shiftAssignment" "CleaningShift" NOT NULL DEFAULT 'MORNING',
ADD COLUMN     "assignedCleanerId" TEXT,
ADD COLUMN     "geoLatitude" DECIMAL(65,30),
ADD COLUMN     "geoLongitude" DECIMAL(65,30),
ADD COLUMN     "geoRadiusMeters" INTEGER NOT NULL DEFAULT 150,
ADD COLUMN     "requireDeviceValidation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requirePhotoEvidence" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CleaningVisit"
ADD COLUMN     "clientScannedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "durationSeconds" INTEGER,
ADD COLUMN     "geofenceDistanceMeters" DECIMAL(65,30),
ADD COLUMN     "geoValidated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "checklistScore" INTEGER,
ADD COLUMN     "photoScore" INTEGER,
ADD COLUMN     "qualityScore" INTEGER,
ADD COLUMN     "scheduleStatus" "CleaningScheduleStatus" NOT NULL DEFAULT 'ON_TIME',
ADD COLUMN     "supervisorRating" INTEGER,
ADD COLUMN     "supervisorComment" TEXT;

UPDATE "CleaningVisit"
SET "startedAt" = "scannedAt"
WHERE "startedAt" IS NULL;

-- AlterTable
ALTER TABLE "FacilityIssue"
ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "slaTargetAt" TIMESTAMP(3),
ADD COLUMN     "firstResponseAt" TIMESTAMP(3),
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "resolutionMinutes" INTEGER;

-- CreateIndex
CREATE INDEX "CleaningLocation_assignedCleanerId_idx" ON "CleaningLocation"("assignedCleanerId");

-- CreateIndex
CREATE INDEX "CleaningVisit_scheduleStatus_idx" ON "CleaningVisit"("scheduleStatus");

-- CreateIndex
CREATE INDEX "FacilityIssue_assignedToId_idx" ON "FacilityIssue"("assignedToId");

-- CreateIndex
CREATE INDEX "FacilityIssue_slaTargetAt_idx" ON "FacilityIssue"("slaTargetAt");

-- AddForeignKey
ALTER TABLE "CleaningLocation" ADD CONSTRAINT "CleaningLocation_assignedCleanerId_fkey" FOREIGN KEY ("assignedCleanerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityIssue" ADD CONSTRAINT "FacilityIssue_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
