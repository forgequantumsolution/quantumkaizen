-- CreateEnum
CREATE TYPE "DocType" AS ENUM ('ATTACHMENT', 'EVIDENCE', 'REPORT', 'FORM_SUBMISSION', 'OTHER');

-- CreateEnum
CREATE TYPE "ChildTriggerMode" AS ENUM ('MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "ParallelBranchStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "uniqueId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ticketReason" TEXT,
    "parentTicketId" TEXT,
    "parentTicketStageId" TEXT,
    "priorityId" TEXT,
    "departmentId" TEXT,
    "siteId" TEXT,
    "customFields" JSONB,
    "isOnHold" BOOLEAN NOT NULL DEFAULT false,
    "holdReason" TEXT,
    "heldAt" TIMESTAMP(3),
    "heldById" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketFlow" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "workflowName" TEXT NOT NULL,
    "workflowVersion" INTEGER NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "statusUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketStageTracking" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "stageId" TEXT,
    "stageName" TEXT NOT NULL,
    "stageWorkflowId" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isOnHold" BOOLEAN NOT NULL DEFAULT false,
    "holdReason" TEXT,
    "performedById" TEXT,
    "postActionId" TEXT,
    "returnedFromStageId" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketStageTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketComment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketDoc" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "stageId" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "docType" "DocType" NOT NULL DEFAULT 'ATTACHMENT',
    "uploadedById" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildWorkflowTrigger" (
    "id" TEXT NOT NULL,
    "parentStageId" TEXT NOT NULL,
    "childWorkflowId" TEXT NOT NULL,
    "triggerMode" "ChildTriggerMode" NOT NULL DEFAULT 'MANUAL',
    "isBlocking" BOOLEAN NOT NULL DEFAULT false,
    "allowMultiple" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildWorkflowTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParallelBranchTracking" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "forkStageId" TEXT NOT NULL,
    "joinStageId" TEXT,
    "branchPath" JSONB NOT NULL,
    "status" "ParallelBranchStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParallelBranchTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TicketFlowCurrentStages" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_uniqueId_key" ON "Ticket"("uniqueId");

-- CreateIndex
CREATE INDEX "Ticket_uniqueId_idx" ON "Ticket"("uniqueId");

-- CreateIndex
CREATE INDEX "Ticket_createdById_createdAt_idx" ON "Ticket"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_priorityId_createdAt_idx" ON "Ticket"("priorityId", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_isDeleted_createdAt_idx" ON "Ticket"("isDeleted", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_parentTicketId_isDeleted_idx" ON "Ticket"("parentTicketId", "isDeleted");

-- CreateIndex
CREATE INDEX "TicketFlow_workflowId_isCompleted_idx" ON "TicketFlow"("workflowId", "isCompleted");

-- CreateIndex
CREATE INDEX "TicketFlow_ticketId_isCompleted_idx" ON "TicketFlow"("ticketId", "isCompleted");

-- CreateIndex
CREATE UNIQUE INDEX "TicketFlow_ticketId_workflowId_key" ON "TicketFlow"("ticketId", "workflowId");

-- CreateIndex
CREATE INDEX "TicketStageTracking_ticketId_stageId_isActive_idx" ON "TicketStageTracking"("ticketId", "stageId", "isActive");

-- CreateIndex
CREATE INDEX "TicketStageTracking_ticketId_isActive_idx" ON "TicketStageTracking"("ticketId", "isActive");

-- CreateIndex
CREATE INDEX "TicketStageTracking_stageWorkflowId_isActive_idx" ON "TicketStageTracking"("stageWorkflowId", "isActive");

-- CreateIndex
CREATE INDEX "TicketStageTracking_enteredAt_idx" ON "TicketStageTracking"("enteredAt");

-- CreateIndex
CREATE INDEX "TicketComment_ticketId_createdAt_idx" ON "TicketComment"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketDoc_ticketId_createdAt_idx" ON "TicketDoc"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "ParallelBranchTracking_ticketId_forkStageId_status_idx" ON "ParallelBranchTracking"("ticketId", "forkStageId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "_TicketFlowCurrentStages_AB_unique" ON "_TicketFlowCurrentStages"("A", "B");

-- CreateIndex
CREATE INDEX "_TicketFlowCurrentStages_B_index" ON "_TicketFlowCurrentStages"("B");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_parentTicketId_fkey" FOREIGN KEY ("parentTicketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_parentTicketStageId_fkey" FOREIGN KEY ("parentTicketStageId") REFERENCES "WorkflowStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_priorityId_fkey" FOREIGN KEY ("priorityId") REFERENCES "Priority"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_heldById_fkey" FOREIGN KEY ("heldById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketFlow" ADD CONSTRAINT "TicketFlow_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketFlow" ADD CONSTRAINT "TicketFlow_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketStageTracking" ADD CONSTRAINT "TicketStageTracking_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketStageTracking" ADD CONSTRAINT "TicketStageTracking_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "WorkflowStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketStageTracking" ADD CONSTRAINT "TicketStageTracking_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketStageTracking" ADD CONSTRAINT "TicketStageTracking_postActionId_fkey" FOREIGN KEY ("postActionId") REFERENCES "WorkflowStageAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketStageTracking" ADD CONSTRAINT "TicketStageTracking_returnedFromStageId_fkey" FOREIGN KEY ("returnedFromStageId") REFERENCES "WorkflowStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketDoc" ADD CONSTRAINT "TicketDoc_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketDoc" ADD CONSTRAINT "TicketDoc_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "WorkflowStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketDoc" ADD CONSTRAINT "TicketDoc_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildWorkflowTrigger" ADD CONSTRAINT "ChildWorkflowTrigger_parentStageId_fkey" FOREIGN KEY ("parentStageId") REFERENCES "WorkflowStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildWorkflowTrigger" ADD CONSTRAINT "ChildWorkflowTrigger_childWorkflowId_fkey" FOREIGN KEY ("childWorkflowId") REFERENCES "Workflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParallelBranchTracking" ADD CONSTRAINT "ParallelBranchTracking_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParallelBranchTracking" ADD CONSTRAINT "ParallelBranchTracking_forkStageId_fkey" FOREIGN KEY ("forkStageId") REFERENCES "WorkflowStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParallelBranchTracking" ADD CONSTRAINT "ParallelBranchTracking_joinStageId_fkey" FOREIGN KEY ("joinStageId") REFERENCES "WorkflowStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TicketFlowCurrentStages" ADD CONSTRAINT "_TicketFlowCurrentStages_A_fkey" FOREIGN KEY ("A") REFERENCES "TicketFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TicketFlowCurrentStages" ADD CONSTRAINT "_TicketFlowCurrentStages_B_fkey" FOREIGN KEY ("B") REFERENCES "WorkflowStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
