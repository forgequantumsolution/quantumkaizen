-- AlterEnum
BEGIN;
CREATE TYPE "ApprovalInstanceStatus_new" AS ENUM ('PENDING', 'SATISFIED', 'REJECTED', 'EXPIRED', 'INVALIDATED', 'CANCELLED');
ALTER TABLE "ApprovalInstance" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ApprovalInstance" ALTER COLUMN "status" TYPE "ApprovalInstanceStatus_new" USING ("status"::text::"ApprovalInstanceStatus_new");
ALTER TYPE "ApprovalInstanceStatus" RENAME TO "ApprovalInstanceStatus_old";
ALTER TYPE "ApprovalInstanceStatus_new" RENAME TO "ApprovalInstanceStatus";
DROP TYPE "ApprovalInstanceStatus_old";
ALTER TABLE "ApprovalInstance" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "SlaEventType_new" AS ENUM ('STARTED', 'PAUSED', 'RESUMED', 'THRESHOLD_HIT', 'SLA_TRANSITION', 'EXTENDED', 'COMPLETED', 'COMPLETED_LATE', 'BREACHED');
ALTER TABLE "SlaTimerEvent" ALTER COLUMN "eventType" TYPE "SlaEventType_new" USING ("eventType"::text::"SlaEventType_new");
ALTER TYPE "SlaEventType" RENAME TO "SlaEventType_old";
ALTER TYPE "SlaEventType_new" RENAME TO "SlaEventType";
DROP TYPE "SlaEventType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "SlaTimerStatus_new" AS ENUM ('RUNNING', 'PAUSED', 'EXTENDED', 'COMPLETED', 'BREACHED');
ALTER TABLE "SlaTimer" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "SlaTimer" ALTER COLUMN "status" TYPE "SlaTimerStatus_new" USING ("status"::text::"SlaTimerStatus_new");
ALTER TYPE "SlaTimerStatus" RENAME TO "SlaTimerStatus_old";
ALTER TYPE "SlaTimerStatus_new" RENAME TO "SlaTimerStatus";
DROP TYPE "SlaTimerStatus_old";
ALTER TABLE "SlaTimer" ALTER COLUMN "status" SET DEFAULT 'RUNNING';
COMMIT;

-- DropIndex
DROP INDEX "SlaThreshold_policyId_percentage_key";

-- AlterTable
ALTER TABLE "ApprovalInstance" ADD COLUMN     "currentSequenceOrder" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "invalidatedAt" TIMESTAMP(3),
ADD COLUMN     "invalidatedReason" TEXT;

-- AlterTable
ALTER TABLE "ApprovalPolicy" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ApprovalRecord" ADD COLUMN     "approvedAsRoleId" TEXT,
ADD COLUMN     "sequenceOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stageSignatureId" TEXT;

-- AlterTable
ALTER TABLE "SlaPolicy" ADD COLUMN     "escalationWorkflowId" TEXT;

-- AlterTable
ALTER TABLE "SlaThreshold" ADD COLUMN     "name" TEXT NOT NULL DEFAULT 'warning',
ALTER COLUMN "percentage" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "SlaTimer" DROP COLUMN "lastFiredPercentage",
DROP COLUMN "pausedAt",
DROP COLUMN "resumedAt",
DROP COLUMN "totalPausedSec",
ADD COLUMN     "elapsedBeforePauseSec" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "escalationTicketId" TEXT,
ADD COLUMN     "extensionCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastResumedAt" TIMESTAMP(3),
ADD COLUMN     "totalExtensionsSec" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "status" SET DEFAULT 'RUNNING';

-- AlterTable
ALTER TABLE "SlaTimerEvent" ADD COLUMN     "extensionAmountSec" INTEGER,
ADD COLUMN     "newDeadline" TIMESTAMP(3),
ADD COLUMN     "thresholdName" TEXT,
ADD COLUMN     "thresholdPercentage" DOUBLE PRECISION,
ADD COLUMN     "triggeredById" TEXT;

-- CreateIndex
CREATE INDEX "SlaPolicy_escalationWorkflowId_idx" ON "SlaPolicy"("escalationWorkflowId");

-- CreateIndex
CREATE UNIQUE INDEX "SlaThreshold_policyId_name_key" ON "SlaThreshold"("policyId", "name");

-- CreateIndex
CREATE INDEX "SlaTimer_escalationTicketId_idx" ON "SlaTimer"("escalationTicketId");

-- CreateIndex
CREATE INDEX "SlaTimerEvent_timerId_eventType_idx" ON "SlaTimerEvent"("timerId", "eventType");

-- AddForeignKey
ALTER TABLE "ApprovalRecord" ADD CONSTRAINT "ApprovalRecord_approvedAsRoleId_fkey" FOREIGN KEY ("approvedAsRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaPolicy" ADD CONSTRAINT "SlaPolicy_escalationWorkflowId_fkey" FOREIGN KEY ("escalationWorkflowId") REFERENCES "Workflow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaTimer" ADD CONSTRAINT "SlaTimer_escalationTicketId_fkey" FOREIGN KEY ("escalationTicketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaTimerEvent" ADD CONSTRAINT "SlaTimerEvent_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable (drop the temp default once existing rows are backfilled)
ALTER TABLE "SlaThreshold" ALTER COLUMN "name" DROP DEFAULT;
