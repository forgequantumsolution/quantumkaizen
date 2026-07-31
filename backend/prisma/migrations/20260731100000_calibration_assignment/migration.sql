-- Calibration ownership + method snapshot.
--
-- Additive only: assignee columns and a frozen copy of the method on the
-- event, so a scheduled calibration has an owner and a certificate can state
-- which procedure was used (ISO/IEC 17025 §7.8.4).

-- AlterTable
ALTER TABLE "CalibrationEvent" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedById" TEXT,
ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "methodDocId" TEXT,
ADD COLUMN     "methodRef" TEXT;

-- CreateIndex
CREATE INDEX "CalibrationEvent_assignedToId_status_idx" ON "CalibrationEvent"("assignedToId", "status");

