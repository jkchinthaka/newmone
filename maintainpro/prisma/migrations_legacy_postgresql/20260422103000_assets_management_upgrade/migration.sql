-- CreateEnum
CREATE TYPE "AssetCondition" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL');

-- AlterTable
ALTER TABLE "Asset"
ADD COLUMN "condition" "AssetCondition" NOT NULL DEFAULT 'GOOD',
ADD COLUMN "supplier" TEXT,
ADD COLUMN "department" TEXT,
ADD COLUMN "ownerName" TEXT,
ADD COLUMN "meterReading" DECIMAL(65,30),
ADD COLUMN "lastServiceDate" TIMESTAMP(3),
ADD COLUMN "nextServiceDate" TIMESTAMP(3),
ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Asset_condition_idx" ON "Asset"("condition");

-- CreateIndex
CREATE INDEX "Asset_archivedAt_idx" ON "Asset"("archivedAt");

-- CreateIndex
CREATE INDEX "Asset_nextServiceDate_idx" ON "Asset"("nextServiceDate");