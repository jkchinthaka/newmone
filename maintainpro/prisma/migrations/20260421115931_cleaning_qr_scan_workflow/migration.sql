-- CreateEnum
CREATE TYPE "CleaningVisitMethod" AS ENUM ('QR_SCAN', 'MANUAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CleaningVisitStatus" ADD VALUE 'COMPLETED';
ALTER TYPE "CleaningVisitStatus" ADD VALUE 'PENDING_VERIFICATION';

-- AlterTable
ALTER TABLE "CleaningVisit" ADD COLUMN     "method" "CleaningVisitMethod" NOT NULL DEFAULT 'QR_SCAN';
