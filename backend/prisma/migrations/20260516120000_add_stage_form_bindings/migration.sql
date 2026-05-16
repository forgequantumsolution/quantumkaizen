-- CreateTable
CREATE TABLE "StageFormBinding" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "StageFormBinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StageFormBinding_workflowId_stageId_idx" ON "StageFormBinding"("workflowId", "stageId");
CREATE INDEX "StageFormBinding_formId_idx" ON "StageFormBinding"("formId");
CREATE UNIQUE INDEX "StageFormBinding_stageId_formId_key" ON "StageFormBinding"("stageId", "formId");

-- AlterTable
ALTER TABLE "FormSubmission"
  ADD COLUMN "ticketId"  TEXT,
  ADD COLUMN "stageId"   TEXT,
  ADD COLUMN "flowId"    TEXT,
  ADD COLUMN "bindingId" TEXT;

-- Indexes on the new columns
CREATE INDEX "FormSubmission_ticketId_stageId_idx" ON "FormSubmission"("ticketId", "stageId");
CREATE INDEX "FormSubmission_bindingId_idx" ON "FormSubmission"("bindingId");

-- AddForeignKey: StageFormBinding
ALTER TABLE "StageFormBinding"
  ADD CONSTRAINT "StageFormBinding_workflowId_fkey"
    FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StageFormBinding"
  ADD CONSTRAINT "StageFormBinding_stageId_fkey"
    FOREIGN KEY ("stageId") REFERENCES "WorkflowStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StageFormBinding"
  ADD CONSTRAINT "StageFormBinding_formId_fkey"
    FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StageFormBinding"
  ADD CONSTRAINT "StageFormBinding_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: FormSubmission new FKs
ALTER TABLE "FormSubmission"
  ADD CONSTRAINT "FormSubmission_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FormSubmission"
  ADD CONSTRAINT "FormSubmission_stageId_fkey"
    FOREIGN KEY ("stageId") REFERENCES "WorkflowStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FormSubmission"
  ADD CONSTRAINT "FormSubmission_flowId_fkey"
    FOREIGN KEY ("flowId") REFERENCES "TicketFlow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FormSubmission"
  ADD CONSTRAINT "FormSubmission_bindingId_fkey"
    FOREIGN KEY ("bindingId") REFERENCES "StageFormBinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;
