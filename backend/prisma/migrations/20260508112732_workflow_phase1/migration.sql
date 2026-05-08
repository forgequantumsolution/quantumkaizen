-- CreateEnum
CREATE TYPE "WorkflowApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WorkflowLifecycleStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DRAFT', 'DRAFT_UPDATE');

-- CreateEnum
CREATE TYPE "StageType" AS ENUM ('STAGE', 'FORK', 'JOIN', 'DECISION', 'AUDIT_FORMS');

-- CreateEnum
CREATE TYPE "SplitType" AS ENUM ('AND', 'OR', 'XOR');

-- CreateEnum
CREATE TYPE "JoinType" AS ENUM ('AND', 'OR');

-- CreateEnum
CREATE TYPE "StageActionBehavior" AS ENUM ('FORWARD', 'REJECT', 'HOLD', 'UNHOLD', 'RETURN', 'REASSIGN');

-- CreateTable
CREATE TABLE "WorkflowType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "codePrefix" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowIconConfig" (
    "id" TEXT NOT NULL,
    "workflowTypeId" TEXT NOT NULL,
    "iconName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowIconConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStageStatus" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "behavior" "StageActionBehavior" NOT NULL DEFAULT 'FORWARD',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowStageStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionCriteria" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionCriteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Priority" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Priority_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "typeId" TEXT,
    "status" "WorkflowApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "workflowStatus" "WorkflowLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "totalExecutions" INTEGER NOT NULL DEFAULT 0,
    "successfulExecutions" INTEGER NOT NULL DEFAULT 0,
    "failedExecutions" INTEGER NOT NULL DEFAULT 0,
    "lastExecutedAt" TIMESTAMP(3),
    "maxExecutionsPerDay" INTEGER,
    "timeoutSeconds" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isLatestVersion" BOOLEAN NOT NULL DEFAULT true,
    "previousVersionId" TEXT,
    "parentWorkflowId" TEXT,
    "draftOfId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStage" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "canonicalId" TEXT NOT NULL DEFAULT '',
    "isInitialStage" BOOLEAN NOT NULL DEFAULT false,
    "position" JSONB,
    "sendEmail" BOOLEAN NOT NULL DEFAULT false,
    "additionalData" JSONB,
    "stageType" "StageType" NOT NULL DEFAULT 'STAGE',
    "splitType" "SplitType",
    "joinType" "JoinType",
    "joinPointId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStageAction" (
    "id" TEXT NOT NULL,
    "workflowStageId" TEXT NOT NULL,
    "workflowActionId" TEXT NOT NULL,
    "criteriaId" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowStageAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTransition" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "fromStageId" TEXT NOT NULL,
    "toStageId" TEXT NOT NULL,
    "sourcePort" TEXT,
    "targetPort" TEXT,
    "branchName" TEXT,
    "condition" TEXT,
    "branchOrder" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemporaryWorkflow" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "flowJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemporaryWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_StageActionAllowedUsers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_StageActionAllowedRoles" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowType_name_key" ON "WorkflowType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowIconConfig_workflowTypeId_key" ON "WorkflowIconConfig"("workflowTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStageStatus_name_key" ON "WorkflowStageStatus"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ActionType_name_key" ON "ActionType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Priority_name_key" ON "Priority"("name");

-- CreateIndex
CREATE INDEX "Workflow_isLatestVersion_isDeleted_idx" ON "Workflow"("isLatestVersion", "isDeleted");

-- CreateIndex
CREATE INDEX "Workflow_typeId_idx" ON "Workflow"("typeId");

-- CreateIndex
CREATE INDEX "Workflow_parentWorkflowId_idx" ON "Workflow"("parentWorkflowId");

-- CreateIndex
CREATE INDEX "Workflow_draftOfId_idx" ON "Workflow"("draftOfId");

-- CreateIndex
CREATE INDEX "WorkflowStage_workflowId_isInitialStage_idx" ON "WorkflowStage"("workflowId", "isInitialStage");

-- CreateIndex
CREATE INDEX "WorkflowStage_canonicalId_idx" ON "WorkflowStage"("canonicalId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStageAction_workflowStageId_workflowActionId_key" ON "WorkflowStageAction"("workflowStageId", "workflowActionId");

-- CreateIndex
CREATE INDEX "WorkflowTransition_fromStageId_idx" ON "WorkflowTransition"("fromStageId");

-- CreateIndex
CREATE INDEX "WorkflowTransition_toStageId_idx" ON "WorkflowTransition"("toStageId");

-- CreateIndex
CREATE INDEX "WorkflowTransition_workflowId_idx" ON "WorkflowTransition"("workflowId");

-- CreateIndex
CREATE UNIQUE INDEX "TemporaryWorkflow_workflowId_key" ON "TemporaryWorkflow"("workflowId");

-- CreateIndex
CREATE UNIQUE INDEX "_StageActionAllowedUsers_AB_unique" ON "_StageActionAllowedUsers"("A", "B");

-- CreateIndex
CREATE INDEX "_StageActionAllowedUsers_B_index" ON "_StageActionAllowedUsers"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_StageActionAllowedRoles_AB_unique" ON "_StageActionAllowedRoles"("A", "B");

-- CreateIndex
CREATE INDEX "_StageActionAllowedRoles_B_index" ON "_StageActionAllowedRoles"("B");

-- AddForeignKey
ALTER TABLE "WorkflowIconConfig" ADD CONSTRAINT "WorkflowIconConfig_workflowTypeId_fkey" FOREIGN KEY ("workflowTypeId") REFERENCES "WorkflowType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "WorkflowType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "Workflow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_parentWorkflowId_fkey" FOREIGN KEY ("parentWorkflowId") REFERENCES "Workflow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_draftOfId_fkey" FOREIGN KEY ("draftOfId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStage" ADD CONSTRAINT "WorkflowStage_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStage" ADD CONSTRAINT "WorkflowStage_joinPointId_fkey" FOREIGN KEY ("joinPointId") REFERENCES "WorkflowStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStageAction" ADD CONSTRAINT "WorkflowStageAction_workflowStageId_fkey" FOREIGN KEY ("workflowStageId") REFERENCES "WorkflowStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStageAction" ADD CONSTRAINT "WorkflowStageAction_workflowActionId_fkey" FOREIGN KEY ("workflowActionId") REFERENCES "WorkflowStageStatus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStageAction" ADD CONSTRAINT "WorkflowStageAction_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "ActionCriteria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_fromStageId_fkey" FOREIGN KEY ("fromStageId") REFERENCES "WorkflowStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_toStageId_fkey" FOREIGN KEY ("toStageId") REFERENCES "WorkflowStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemporaryWorkflow" ADD CONSTRAINT "TemporaryWorkflow_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StageActionAllowedUsers" ADD CONSTRAINT "_StageActionAllowedUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StageActionAllowedUsers" ADD CONSTRAINT "_StageActionAllowedUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "WorkflowStageAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StageActionAllowedRoles" ADD CONSTRAINT "_StageActionAllowedRoles_A_fkey" FOREIGN KEY ("A") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StageActionAllowedRoles" ADD CONSTRAINT "_StageActionAllowedRoles_B_fkey" FOREIGN KEY ("B") REFERENCES "WorkflowStageAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
