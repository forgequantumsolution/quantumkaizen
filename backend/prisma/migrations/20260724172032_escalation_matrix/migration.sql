-- CreateEnum
CREATE TYPE "EscalationTarget" AS ENUM ('MANAGER', 'DEPARTMENT_HEAD');

-- CreateEnum
CREATE TYPE "EscalationReason" AS ENUM ('SLA_THRESHOLD', 'SLA_BREACH', 'ASSIGNEE_UNAVAILABLE', 'MANUAL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TASK_ASSIGNED', 'ESCALATED', 'OVERDUE', 'EXPIRING', 'SYSTEM');

-- AlterTable
ALTER TABLE "ESignature" ALTER COLUMN "invalidatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "escalationLevel" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "UserAvailability" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "from" TIMESTAMP(3) NOT NULL,
    "to" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "delegateToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalationRule" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscalationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalationLevel" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "target" "EscalationTarget" NOT NULL,
    "atThresholdName" TEXT,

    CONSTRAINT "EscalationLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalationEvent" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "fromUserId" TEXT,
    "toUserId" TEXT,
    "reason" "EscalationReason" NOT NULL,
    "levelOrder" INTEGER NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscalationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAvailability_userId_from_to_idx" ON "UserAvailability"("userId", "from", "to");

-- CreateIndex
CREATE INDEX "UserAvailability_delegateToId_idx" ON "UserAvailability"("delegateToId");

-- CreateIndex
CREATE UNIQUE INDEX "EscalationRule_departmentId_key" ON "EscalationRule"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "EscalationLevel_ruleId_order_key" ON "EscalationLevel"("ruleId", "order");

-- CreateIndex
CREATE INDEX "EscalationEvent_ticketId_levelOrder_idx" ON "EscalationEvent"("ticketId", "levelOrder");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_assigneeId_isDeleted_idx" ON "Ticket"("assigneeId", "isDeleted");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAvailability" ADD CONSTRAINT "UserAvailability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAvailability" ADD CONSTRAINT "UserAvailability_delegateToId_fkey" FOREIGN KEY ("delegateToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalationRule" ADD CONSTRAINT "EscalationRule_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalationLevel" ADD CONSTRAINT "EscalationLevel_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "EscalationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalationEvent" ADD CONSTRAINT "EscalationEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalationEvent" ADD CONSTRAINT "EscalationEvent_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalationEvent" ADD CONSTRAINT "EscalationEvent_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
