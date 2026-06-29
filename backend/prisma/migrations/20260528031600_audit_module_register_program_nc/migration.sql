-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditType" AS ENUM ('INTERNAL', 'EXTERNAL', 'SUPPLIER', 'PROCESS', 'PRODUCT', 'SYSTEM', 'COMPLIANCE');

-- CreateEnum
CREATE TYPE "AuditFrequency" AS ENUM ('ONE_TIME', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "AuditProgramStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('OBSERVATION', 'MINOR', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'ACCEPTED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "NonConformanceStatus" AS ENUM ('OPEN', 'CAPA_RAISED', 'IN_PROGRESS', 'VERIFICATION', 'CLOSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "AuditMaster" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "auditType" "AuditType" NOT NULL,
    "frequency" "AuditFrequency" NOT NULL DEFAULT 'ANNUAL',
    "defaultIsoStandardId" TEXT,
    "defaultChecklistFormId" TEXT,
    "scoringRules" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditRegister" (
    "id" TEXT NOT NULL,
    "registerNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "AuditStatus" NOT NULL DEFAULT 'DRAFT',
    "auditMasterId" TEXT,
    "auditType" "AuditType" NOT NULL,
    "plant" TEXT,
    "description" TEXT,
    "plannedDate" TIMESTAMP(3) NOT NULL,
    "previousAuditDate" TIMESTAMP(3),
    "financialYear" TEXT,
    "auditMethod" TEXT,
    "isoStandardId" TEXT,
    "locations" JSONB,
    "mainProcesses" JSONB,
    "subProcesses" JSONB,
    "criteria" JSONB,
    "departments" JSONB,
    "focusAreas" JSONB,
    "checklistFormId" TEXT,
    "auditorId" TEXT,
    "approverId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "rejectionReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditRegister_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditProgram" (
    "id" TEXT NOT NULL,
    "programNumber" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "status" "AuditProgramStatus" NOT NULL DEFAULT 'PLANNED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "checklistSubmissionId" TEXT,
    "summary" TEXT,
    "score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditFinding" (
    "id" TEXT NOT NULL,
    "findingNumber" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
    "clauseRef" TEXT,
    "isoSubClauseId" TEXT,
    "description" TEXT NOT NULL,
    "evidence" JSONB,
    "recommendation" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NonConformance" (
    "id" TEXT NOT NULL,
    "ncNumber" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "status" "NonConformanceStatus" NOT NULL DEFAULT 'OPEN',
    "severity" "FindingSeverity" NOT NULL,
    "track" TEXT,
    "departmentId" TEXT,
    "capaTicketId" TEXT,
    "dueDate" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NonConformance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuditMaster_code_key" ON "AuditMaster"("code");

-- CreateIndex
CREATE INDEX "AuditMaster_auditType_idx" ON "AuditMaster"("auditType");

-- CreateIndex
CREATE INDEX "AuditMaster_isActive_idx" ON "AuditMaster"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AuditRegister_registerNumber_key" ON "AuditRegister"("registerNumber");

-- CreateIndex
CREATE INDEX "AuditRegister_status_idx" ON "AuditRegister"("status");

-- CreateIndex
CREATE INDEX "AuditRegister_plannedDate_idx" ON "AuditRegister"("plannedDate");

-- CreateIndex
CREATE INDEX "AuditRegister_auditMasterId_idx" ON "AuditRegister"("auditMasterId");

-- CreateIndex
CREATE INDEX "AuditRegister_financialYear_idx" ON "AuditRegister"("financialYear");

-- CreateIndex
CREATE UNIQUE INDEX "AuditProgram_programNumber_key" ON "AuditProgram"("programNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AuditProgram_registerId_key" ON "AuditProgram"("registerId");

-- CreateIndex
CREATE INDEX "AuditProgram_status_idx" ON "AuditProgram"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AuditFinding_findingNumber_key" ON "AuditFinding"("findingNumber");

-- CreateIndex
CREATE INDEX "AuditFinding_programId_idx" ON "AuditFinding"("programId");

-- CreateIndex
CREATE INDEX "AuditFinding_status_idx" ON "AuditFinding"("status");

-- CreateIndex
CREATE UNIQUE INDEX "NonConformance_ncNumber_key" ON "NonConformance"("ncNumber");

-- CreateIndex
CREATE UNIQUE INDEX "NonConformance_findingId_key" ON "NonConformance"("findingId");

-- CreateIndex
CREATE UNIQUE INDEX "NonConformance_capaTicketId_key" ON "NonConformance"("capaTicketId");

-- CreateIndex
CREATE INDEX "NonConformance_status_idx" ON "NonConformance"("status");

-- CreateIndex
CREATE INDEX "NonConformance_track_idx" ON "NonConformance"("track");

-- CreateIndex
CREATE INDEX "NonConformance_departmentId_idx" ON "NonConformance"("departmentId");

-- AddForeignKey
ALTER TABLE "AuditMaster" ADD CONSTRAINT "AuditMaster_defaultIsoStandardId_fkey" FOREIGN KEY ("defaultIsoStandardId") REFERENCES "IsoStandard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditMaster" ADD CONSTRAINT "AuditMaster_defaultChecklistFormId_fkey" FOREIGN KEY ("defaultChecklistFormId") REFERENCES "Form"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditMaster" ADD CONSTRAINT "AuditMaster_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditRegister" ADD CONSTRAINT "AuditRegister_auditMasterId_fkey" FOREIGN KEY ("auditMasterId") REFERENCES "AuditMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditRegister" ADD CONSTRAINT "AuditRegister_isoStandardId_fkey" FOREIGN KEY ("isoStandardId") REFERENCES "IsoStandard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditRegister" ADD CONSTRAINT "AuditRegister_checklistFormId_fkey" FOREIGN KEY ("checklistFormId") REFERENCES "Form"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditRegister" ADD CONSTRAINT "AuditRegister_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditRegister" ADD CONSTRAINT "AuditRegister_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditRegister" ADD CONSTRAINT "AuditRegister_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditRegister" ADD CONSTRAINT "AuditRegister_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditProgram" ADD CONSTRAINT "AuditProgram_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "AuditRegister"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditProgram" ADD CONSTRAINT "AuditProgram_checklistSubmissionId_fkey" FOREIGN KEY ("checklistSubmissionId") REFERENCES "FormSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AuditProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_isoSubClauseId_fkey" FOREIGN KEY ("isoSubClauseId") REFERENCES "IsoSubClause"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformance" ADD CONSTRAINT "NonConformance_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "AuditFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformance" ADD CONSTRAINT "NonConformance_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformance" ADD CONSTRAINT "NonConformance_capaTicketId_fkey" FOREIGN KEY ("capaTicketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformance" ADD CONSTRAINT "NonConformance_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
