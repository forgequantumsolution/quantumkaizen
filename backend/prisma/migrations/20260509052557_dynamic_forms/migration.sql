-- CreateEnum
CREATE TYPE "FormStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FormSubmissionStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "FieldType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "dataType" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Form" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "versionId" TEXT NOT NULL,
    "status" "FormStatus" NOT NULL DEFAULT 'DRAFT',
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "formTypeId" TEXT,
    "location" TEXT,
    "mainProcess" TEXT,
    "criteria" TEXT,
    "pdcaApproved" BOOLEAN NOT NULL DEFAULT false,
    "workflowName" TEXT,
    "workflowType" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSection" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "dependency" JSONB,
    "formId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormField" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "width" TEXT NOT NULL DEFAULT '100',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "typeId" TEXT,
    "typeName" TEXT,
    "defaultValue" JSONB,
    "options" JSONB,
    "validation" JSONB,
    "dependency" JSONB,
    "dynamic" BOOLEAN NOT NULL DEFAULT false,
    "endpoint" TEXT,
    "autoGenerate" BOOLEAN NOT NULL DEFAULT false,
    "autoGenerateEndpoint" TEXT,
    "autoGenerateMappings" JSONB,
    "sectionId" TEXT NOT NULL,
    "parentFieldId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormDraft" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "draftData" JSONB NOT NULL,
    "formDetails" JSONB NOT NULL,
    "versionId" TEXT,
    "savedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "status" "FormSubmissionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "responses" JSONB NOT NULL,
    "meta" JSONB,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IsoStandard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "remarks" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IsoStandard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IsoClause" (
    "id" TEXT NOT NULL,
    "clauseNumber" TEXT NOT NULL,
    "clauseTitle" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "standardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IsoClause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IsoSubClause" (
    "id" TEXT NOT NULL,
    "subClauseNumber" TEXT NOT NULL,
    "subClauseTitle" TEXT NOT NULL,
    "requirementText" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "clauseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IsoSubClause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditSchedule" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "plant" TEXT,
    "description" TEXT,
    "auditDate" TIMESTAMP(3) NOT NULL,
    "previousAuditDate" TIMESTAMP(3),
    "financialYear" TEXT,
    "auditMethod" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "locations" JSONB,
    "mainProcesses" JSONB,
    "subProcesses" JSONB,
    "criteria" JSONB,
    "departments" JSONB,
    "focusAreas" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FieldType_name_key" ON "FieldType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FormType_name_key" ON "FormType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FormType_versionId_key" ON "FormType"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "Form_versionId_key" ON "Form"("versionId");

-- CreateIndex
CREATE INDEX "Form_templateKey_version_idx" ON "Form"("templateKey", "version");

-- CreateIndex
CREATE INDEX "Form_formTypeId_idx" ON "Form"("formTypeId");

-- CreateIndex
CREATE INDEX "Form_status_idx" ON "Form"("status");

-- CreateIndex
CREATE INDEX "FormSection_formId_position_idx" ON "FormSection"("formId", "position");

-- CreateIndex
CREATE INDEX "FormField_sectionId_position_idx" ON "FormField"("sectionId", "position");

-- CreateIndex
CREATE INDEX "FormField_parentFieldId_idx" ON "FormField"("parentFieldId");

-- CreateIndex
CREATE UNIQUE INDEX "FormDraft_formId_key" ON "FormDraft"("formId");

-- CreateIndex
CREATE INDEX "FormSubmission_formId_status_idx" ON "FormSubmission"("formId", "status");

-- CreateIndex
CREATE INDEX "FormSubmission_submittedById_idx" ON "FormSubmission"("submittedById");

-- CreateIndex
CREATE UNIQUE INDEX "IsoStandard_name_key" ON "IsoStandard"("name");

-- CreateIndex
CREATE INDEX "IsoClause_standardId_position_idx" ON "IsoClause"("standardId", "position");

-- CreateIndex
CREATE INDEX "IsoSubClause_clauseId_position_idx" ON "IsoSubClause"("clauseId", "position");

-- CreateIndex
CREATE INDEX "AuditSchedule_financialYear_idx" ON "AuditSchedule"("financialYear");

-- CreateIndex
CREATE INDEX "AuditSchedule_auditDate_idx" ON "AuditSchedule"("auditDate");

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_formTypeId_fkey" FOREIGN KEY ("formTypeId") REFERENCES "FormType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSection" ADD CONSTRAINT "FormSection_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormField" ADD CONSTRAINT "FormField_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "FieldType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormField" ADD CONSTRAINT "FormField_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "FormSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormField" ADD CONSTRAINT "FormField_parentFieldId_fkey" FOREIGN KEY ("parentFieldId") REFERENCES "FormField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormDraft" ADD CONSTRAINT "FormDraft_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormDraft" ADD CONSTRAINT "FormDraft_savedById_fkey" FOREIGN KEY ("savedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IsoClause" ADD CONSTRAINT "IsoClause_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "IsoStandard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IsoSubClause" ADD CONSTRAINT "IsoSubClause_clauseId_fkey" FOREIGN KEY ("clauseId") REFERENCES "IsoClause"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSchedule" ADD CONSTRAINT "AuditSchedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
