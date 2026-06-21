-- CreateEnum
CREATE TYPE "ChecklistTemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ChecklistScoringMode" AS ENUM ('NONE', 'WEIGHTED', 'PERCENT');

-- CreateEnum
CREATE TYPE "ChecklistResponseType" AS ENUM ('YESNO', 'SCALE', 'TEXT', 'NUMERIC', 'SINGLE_SELECT');

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ChecklistTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "auditType" TEXT,
    "isoStandardId" TEXT,
    "scoringMode" "ChecklistScoringMode" NOT NULL DEFAULT 'NONE',
    "passThreshold" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistSection" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChecklistSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistQuestion" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "responseType" "ChecklistResponseType" NOT NULL DEFAULT 'YESNO',
    "options" JSONB,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "isoSubClauseId" TEXT,
    "clauseRef" TEXT,
    "expectedAnswer" TEXT,
    "guidance" TEXT,
    "allowNa" BOOLEAN NOT NULL DEFAULT true,
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChecklistQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChecklistTemplate_templateKey_version_idx" ON "ChecklistTemplate"("templateKey", "version");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_status_idx" ON "ChecklistTemplate"("status");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_isActive_idx" ON "ChecklistTemplate"("isActive");

-- CreateIndex
CREATE INDEX "ChecklistSection_templateId_position_idx" ON "ChecklistSection"("templateId", "position");

-- CreateIndex
CREATE INDEX "ChecklistQuestion_sectionId_position_idx" ON "ChecklistQuestion"("sectionId", "position");

-- AddForeignKey
ALTER TABLE "ChecklistSection" ADD CONSTRAINT "ChecklistSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistQuestion" ADD CONSTRAINT "ChecklistQuestion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ChecklistSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
