-- CreateEnum
CREATE TYPE "ApprovalMode" AS ENUM ('SINGLE', 'ALL_REQUIRED', 'QUORUM', 'SEQUENTIAL', 'ANY');

-- CreateEnum
CREATE TYPE "ApprovalInstanceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SlaTimerStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'BREACHED');

-- CreateEnum
CREATE TYPE "SlaEventType" AS ENUM ('STARTED', 'PAUSED', 'RESUMED', 'THRESHOLD_FIRED', 'EXTENDED', 'COMPLETED', 'BREACHED');

-- CreateEnum
CREATE TYPE "ExtensionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ApprovalPolicy" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "mode" "ApprovalMode" NOT NULL,
    "requiredCount" INTEGER NOT NULL DEFAULT 1,
    "strictRoleMatch" BOOLEAN NOT NULL DEFAULT false,
    "allowSelfApproval" BOOLEAN NOT NULL DEFAULT false,
    "requireUniqueApprovers" BOOLEAN NOT NULL DEFAULT true,
    "approvalSequence" JSONB,
    "approvalSlaHours" INTEGER,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalInstance" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "triggeringActionId" TEXT,
    "status" "ApprovalInstanceStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "deadlineAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRecord" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessCalendar" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "weeklySchedule" JSONB NOT NULL,
    "holidays" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlaPolicy" (
    "id" TEXT NOT NULL,
    "parentStageId" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "calendarId" TEXT,
    "pauseOnHold" BOOLEAN NOT NULL DEFAULT true,
    "pauseOnExtensionPending" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlaPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlaThreshold" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "percentage" INTEGER NOT NULL,
    "targetSlaStageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlaThreshold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlaTimer" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "status" "SlaTimerStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pausedAt" TIMESTAMP(3),
    "resumedAt" TIMESTAMP(3),
    "deadline" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "totalPausedSec" INTEGER NOT NULL DEFAULT 0,
    "lastFiredPercentage" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlaTimer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlaTimerEvent" (
    "id" TEXT NOT NULL,
    "timerId" TEXT NOT NULL,
    "eventType" "SlaEventType" NOT NULL,
    "thresholdId" TEXT,
    "eventData" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlaTimerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlaExtension" (
    "id" TEXT NOT NULL,
    "timerId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "approverId" TEXT,
    "status" "ExtensionStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "extensionSec" INTEGER NOT NULL,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlaExtension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SlaPolicyResponsibleRoles" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_SlaThresholdNotifyRoles" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_ApprovalPolicyApproverRoles" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_ApprovalPolicyApproverUsers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_SlaPolicyResponsibleUsers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_SlaThresholdNotifyUsers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "ApprovalPolicy_workflowId_idx" ON "ApprovalPolicy"("workflowId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalPolicy_stageId_actionId_key" ON "ApprovalPolicy"("stageId", "actionId");

-- CreateIndex
CREATE INDEX "ApprovalInstance_ticketId_status_idx" ON "ApprovalInstance"("ticketId", "status");

-- CreateIndex
CREATE INDEX "ApprovalInstance_policyId_status_idx" ON "ApprovalInstance"("policyId", "status");

-- CreateIndex
CREATE INDEX "ApprovalInstance_deadlineAt_idx" ON "ApprovalInstance"("deadlineAt");

-- CreateIndex
CREATE INDEX "ApprovalRecord_instanceId_idx" ON "ApprovalRecord"("instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRecord_instanceId_approverId_key" ON "ApprovalRecord"("instanceId", "approverId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessCalendar_name_key" ON "BusinessCalendar"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SlaPolicy_parentStageId_key" ON "SlaPolicy"("parentStageId");

-- CreateIndex
CREATE INDEX "SlaPolicy_calendarId_idx" ON "SlaPolicy"("calendarId");

-- CreateIndex
CREATE UNIQUE INDEX "SlaThreshold_policyId_percentage_key" ON "SlaThreshold"("policyId", "percentage");

-- CreateIndex
CREATE INDEX "SlaTimer_status_deadline_idx" ON "SlaTimer"("status", "deadline");

-- CreateIndex
CREATE INDEX "SlaTimer_ticketId_status_idx" ON "SlaTimer"("ticketId", "status");

-- CreateIndex
CREATE INDEX "SlaTimer_stageId_status_idx" ON "SlaTimer"("stageId", "status");

-- CreateIndex
CREATE INDEX "SlaTimerEvent_timerId_occurredAt_idx" ON "SlaTimerEvent"("timerId", "occurredAt");

-- CreateIndex
CREATE INDEX "SlaExtension_timerId_status_idx" ON "SlaExtension"("timerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "_SlaPolicyResponsibleRoles_AB_unique" ON "_SlaPolicyResponsibleRoles"("A", "B");

-- CreateIndex
CREATE INDEX "_SlaPolicyResponsibleRoles_B_index" ON "_SlaPolicyResponsibleRoles"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_SlaThresholdNotifyRoles_AB_unique" ON "_SlaThresholdNotifyRoles"("A", "B");

-- CreateIndex
CREATE INDEX "_SlaThresholdNotifyRoles_B_index" ON "_SlaThresholdNotifyRoles"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ApprovalPolicyApproverRoles_AB_unique" ON "_ApprovalPolicyApproverRoles"("A", "B");

-- CreateIndex
CREATE INDEX "_ApprovalPolicyApproverRoles_B_index" ON "_ApprovalPolicyApproverRoles"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ApprovalPolicyApproverUsers_AB_unique" ON "_ApprovalPolicyApproverUsers"("A", "B");

-- CreateIndex
CREATE INDEX "_ApprovalPolicyApproverUsers_B_index" ON "_ApprovalPolicyApproverUsers"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_SlaPolicyResponsibleUsers_AB_unique" ON "_SlaPolicyResponsibleUsers"("A", "B");

-- CreateIndex
CREATE INDEX "_SlaPolicyResponsibleUsers_B_index" ON "_SlaPolicyResponsibleUsers"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_SlaThresholdNotifyUsers_AB_unique" ON "_SlaThresholdNotifyUsers"("A", "B");

-- CreateIndex
CREATE INDEX "_SlaThresholdNotifyUsers_B_index" ON "_SlaThresholdNotifyUsers"("B");

-- AddForeignKey
ALTER TABLE "ApprovalPolicy" ADD CONSTRAINT "ApprovalPolicy_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalPolicy" ADD CONSTRAINT "ApprovalPolicy_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "WorkflowStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalPolicy" ADD CONSTRAINT "ApprovalPolicy_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "WorkflowStageAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalInstance" ADD CONSTRAINT "ApprovalInstance_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalInstance" ADD CONSTRAINT "ApprovalInstance_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "ApprovalPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalInstance" ADD CONSTRAINT "ApprovalInstance_triggeringActionId_fkey" FOREIGN KEY ("triggeringActionId") REFERENCES "WorkflowStageAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRecord" ADD CONSTRAINT "ApprovalRecord_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "ApprovalInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRecord" ADD CONSTRAINT "ApprovalRecord_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaPolicy" ADD CONSTRAINT "SlaPolicy_parentStageId_fkey" FOREIGN KEY ("parentStageId") REFERENCES "WorkflowStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaPolicy" ADD CONSTRAINT "SlaPolicy_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "BusinessCalendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaThreshold" ADD CONSTRAINT "SlaThreshold_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "SlaPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaThreshold" ADD CONSTRAINT "SlaThreshold_targetSlaStageId_fkey" FOREIGN KEY ("targetSlaStageId") REFERENCES "WorkflowStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaTimer" ADD CONSTRAINT "SlaTimer_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaTimer" ADD CONSTRAINT "SlaTimer_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "WorkflowStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaTimer" ADD CONSTRAINT "SlaTimer_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "SlaPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaTimerEvent" ADD CONSTRAINT "SlaTimerEvent_timerId_fkey" FOREIGN KEY ("timerId") REFERENCES "SlaTimer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaTimerEvent" ADD CONSTRAINT "SlaTimerEvent_thresholdId_fkey" FOREIGN KEY ("thresholdId") REFERENCES "SlaThreshold"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaExtension" ADD CONSTRAINT "SlaExtension_timerId_fkey" FOREIGN KEY ("timerId") REFERENCES "SlaTimer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaExtension" ADD CONSTRAINT "SlaExtension_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaExtension" ADD CONSTRAINT "SlaExtension_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SlaPolicyResponsibleRoles" ADD CONSTRAINT "_SlaPolicyResponsibleRoles_A_fkey" FOREIGN KEY ("A") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SlaPolicyResponsibleRoles" ADD CONSTRAINT "_SlaPolicyResponsibleRoles_B_fkey" FOREIGN KEY ("B") REFERENCES "SlaPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SlaThresholdNotifyRoles" ADD CONSTRAINT "_SlaThresholdNotifyRoles_A_fkey" FOREIGN KEY ("A") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SlaThresholdNotifyRoles" ADD CONSTRAINT "_SlaThresholdNotifyRoles_B_fkey" FOREIGN KEY ("B") REFERENCES "SlaThreshold"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ApprovalPolicyApproverRoles" ADD CONSTRAINT "_ApprovalPolicyApproverRoles_A_fkey" FOREIGN KEY ("A") REFERENCES "ApprovalPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ApprovalPolicyApproverRoles" ADD CONSTRAINT "_ApprovalPolicyApproverRoles_B_fkey" FOREIGN KEY ("B") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ApprovalPolicyApproverUsers" ADD CONSTRAINT "_ApprovalPolicyApproverUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "ApprovalPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ApprovalPolicyApproverUsers" ADD CONSTRAINT "_ApprovalPolicyApproverUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SlaPolicyResponsibleUsers" ADD CONSTRAINT "_SlaPolicyResponsibleUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "SlaPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SlaPolicyResponsibleUsers" ADD CONSTRAINT "_SlaPolicyResponsibleUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SlaThresholdNotifyUsers" ADD CONSTRAINT "_SlaThresholdNotifyUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "SlaThreshold"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SlaThresholdNotifyUsers" ADD CONSTRAINT "_SlaThresholdNotifyUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

