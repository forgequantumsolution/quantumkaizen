-- CreateEnum
CREATE TYPE "RiskAssessmentStatus" AS ENUM ('DRAFT', 'IN_ASSESSMENT', 'PENDING_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PERIODIC_REVIEW', 'SUPERSEDED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RiskControlType" AS ENUM ('PREVENTIVE', 'DETECTIVE', 'MITIGATING', 'CORRECTIVE');

-- CreateEnum
CREATE TYPE "RiskControlHierarchy" AS ENUM ('ELIMINATION', 'SUBSTITUTION', 'ENGINEERING', 'ADMINISTRATIVE', 'PPE', 'INHERENT_SAFETY', 'PROTECTIVE_MEASURE', 'INFORMATION_FOR_SAFETY');

-- CreateEnum
CREATE TYPE "RiskControlStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'IMPLEMENTED', 'VERIFIED', 'INEFFECTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RiskReviewOutcome" AS ENUM ('NO_CHANGE', 'RESCORED', 'CONTROLS_ADDED', 'ESCALATED', 'CLOSED');

-- AlterTable
ALTER TABLE "RiskLink" ADD COLUMN     "assessmentId" TEXT,
ALTER COLUMN "riskId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "HazardLibraryItem" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'HAZARD',
    "description" TEXT,
    "categoryId" TEXT,
    "defaultSeverityRank" INTEGER,
    "tags" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HazardLibraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlLibraryItem" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "type" "RiskControlType" NOT NULL DEFAULT 'PREVENTIVE',
    "hierarchy" "RiskControlHierarchy",
    "description" TEXT,
    "effectivenessRank" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ControlLibraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" TEXT NOT NULL,
    "assessmentNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT,
    "scopeText" TEXT,
    "methodology" "RiskMethodology" NOT NULL DEFAULT 'MATRIX',
    "status" "RiskAssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "registerId" TEXT,
    "frameworkId" TEXT NOT NULL,
    "frameworkSnapshot" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentId" TEXT,
    "teamMembers" JSONB,
    "leadId" TEXT,
    "siteId" TEXT,
    "departmentId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "rejectionReason" TEXT,
    "conclusion" TEXT,
    "nextReviewAt" TIMESTAMP(3),
    "triggerType" TEXT,
    "triggerId" TEXT,
    "workflowId" TEXT,
    "workflowTicketId" TEXT,
    "workflowTicketUniqueId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAssessmentLine" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "itemFunction" TEXT,
    "failureMode" TEXT,
    "effect" TEXT,
    "cause" TEXT,
    "currentControls" TEXT,
    "hazard" TEXT,
    "consequence" TEXT,
    "initialFactors" JSONB,
    "initialScore" INTEGER,
    "initialLevelId" TEXT,
    "actionPriority" TEXT,
    "recommendedAction" TEXT,
    "ownerId" TEXT,
    "dueDate" TIMESTAMP(3),
    "residualFactors" JSONB,
    "residualScore" INTEGER,
    "residualLevelId" TEXT,
    "riskId" TEXT,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskAssessmentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskControl" (
    "id" TEXT NOT NULL,
    "controlNumber" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "RiskControlType" NOT NULL DEFAULT 'PREVENTIVE',
    "hierarchy" "RiskControlHierarchy",
    "status" "RiskControlStatus" NOT NULL DEFAULT 'PLANNED',
    "ownerId" TEXT,
    "dueDate" TIMESTAMP(3),
    "implementedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "effectiveness" TEXT,
    "isEffective" BOOLEAN,
    "capaId" TEXT,
    "actionItemId" TEXT,
    "documentId" TEXT,
    "lmsCourseId" TEXT,
    "libraryItemId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskReview" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "outcome" "RiskReviewOutcome",
    "findings" TEXT,
    "nextReviewAt" TIMESTAMP(3),
    "overdueAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAcceptanceRecord" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "residualScore" INTEGER,
    "residualLevelCode" TEXT,
    "benefitRiskRationale" TEXT,
    "acceptedById" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eSignatureId" TEXT,

    CONSTRAINT "RiskAcceptanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HazardLibraryItem_code_key" ON "HazardLibraryItem"("code");

-- CreateIndex
CREATE INDEX "HazardLibraryItem_type_isActive_idx" ON "HazardLibraryItem"("type", "isActive");

-- CreateIndex
CREATE INDEX "HazardLibraryItem_categoryId_idx" ON "HazardLibraryItem"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ControlLibraryItem_code_key" ON "ControlLibraryItem"("code");

-- CreateIndex
CREATE INDEX "ControlLibraryItem_type_isActive_idx" ON "ControlLibraryItem"("type", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RiskAssessment_assessmentNumber_key" ON "RiskAssessment"("assessmentNumber");

-- CreateIndex
CREATE INDEX "RiskAssessment_status_methodology_idx" ON "RiskAssessment"("status", "methodology");

-- CreateIndex
CREATE INDEX "RiskAssessment_registerId_idx" ON "RiskAssessment"("registerId");

-- CreateIndex
CREATE INDEX "RiskAssessment_nextReviewAt_idx" ON "RiskAssessment"("nextReviewAt");

-- CreateIndex
CREATE INDEX "RiskAssessment_parentId_idx" ON "RiskAssessment"("parentId");

-- CreateIndex
CREATE INDEX "RiskAssessmentLine_assessmentId_idx" ON "RiskAssessmentLine"("assessmentId");

-- CreateIndex
CREATE INDEX "RiskAssessmentLine_riskId_idx" ON "RiskAssessmentLine"("riskId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskAssessmentLine_assessmentId_lineNumber_key" ON "RiskAssessmentLine"("assessmentId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RiskControl_controlNumber_key" ON "RiskControl"("controlNumber");

-- CreateIndex
CREATE INDEX "RiskControl_riskId_status_idx" ON "RiskControl"("riskId", "status");

-- CreateIndex
CREATE INDEX "RiskControl_ownerId_dueDate_idx" ON "RiskControl"("ownerId", "dueDate");

-- CreateIndex
CREATE INDEX "RiskControl_status_dueDate_idx" ON "RiskControl"("status", "dueDate");

-- CreateIndex
CREATE INDEX "RiskReview_riskId_dueAt_idx" ON "RiskReview"("riskId", "dueAt");

-- CreateIndex
CREATE INDEX "RiskReview_dueAt_reviewedAt_idx" ON "RiskReview"("dueAt", "reviewedAt");

-- CreateIndex
CREATE INDEX "RiskAcceptanceRecord_riskId_idx" ON "RiskAcceptanceRecord"("riskId");

-- CreateIndex
CREATE INDEX "RiskLink_assessmentId_idx" ON "RiskLink"("assessmentId");

-- AddForeignKey
ALTER TABLE "RiskLink" ADD CONSTRAINT "RiskLink_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "RiskAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HazardLibraryItem" ADD CONSTRAINT "HazardLibraryItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "RiskCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "RiskRegister"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "RiskFramework"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "RiskAssessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessmentLine" ADD CONSTRAINT "RiskAssessmentLine_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "RiskAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessmentLine" ADD CONSTRAINT "RiskAssessmentLine_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskControl" ADD CONSTRAINT "RiskControl_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskControl" ADD CONSTRAINT "RiskControl_libraryItemId_fkey" FOREIGN KEY ("libraryItemId") REFERENCES "ControlLibraryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskReview" ADD CONSTRAINT "RiskReview_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAcceptanceRecord" ADD CONSTRAINT "RiskAcceptanceRecord_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

