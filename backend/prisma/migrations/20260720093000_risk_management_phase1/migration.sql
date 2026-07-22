-- CreateEnum
CREATE TYPE "RiskMethodology" AS ENUM ('MATRIX', 'FMEA', 'FMECA', 'HACCP', 'HAZOP', 'PHA', 'FTA', 'BOWTIE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RiskFactorKind" AS ENUM ('SEVERITY', 'OCCURRENCE', 'PROBABILITY', 'DETECTABILITY', 'EXPOSURE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RiskScoreFormula" AS ENUM ('PRODUCT', 'SUM', 'WEIGHTED_PRODUCT', 'MATRIX_LOOKUP', 'ACTION_PRIORITY');

-- CreateEnum
CREATE TYPE "RiskAcceptanceLevel" AS ENUM ('ACCEPTABLE', 'ALARP', 'UNACCEPTABLE');

-- CreateEnum
CREATE TYPE "RiskRegisterScope" AS ENUM ('SITE', 'PRODUCT', 'PROCESS', 'PROJECT', 'SUPPLIER', 'EQUIPMENT', 'SYSTEM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('IDENTIFIED', 'UNDER_ASSESSMENT', 'TREATMENT_PLANNED', 'TREATMENT_IN_PROGRESS', 'RESIDUAL_ASSESSED', 'ACCEPTED', 'MONITORED', 'CLOSED', 'REOPENED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "RiskTreatment" AS ENUM ('AVOID', 'REDUCE', 'TRANSFER', 'ACCEPT');

-- CreateEnum
CREATE TYPE "RiskScoreStage" AS ENUM ('INITIAL', 'RESIDUAL', 'TARGET', 'REVIEW');

-- CreateTable
CREATE TABLE "RiskFramework" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "standard" TEXT,
    "methodology" "RiskMethodology" NOT NULL DEFAULT 'MATRIX',
    "formula" "RiskScoreFormula" NOT NULL DEFAULT 'PRODUCT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "terminology" JSONB,
    "fieldConfig" JSONB,
    "siteId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskFramework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskFactor" (
    "id" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "kind" "RiskFactorKind" NOT NULL DEFAULT 'CUSTOM',
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RiskFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskFactorLevel" (
    "id" TEXT NOT NULL,
    "factorId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "definition" TEXT,
    "guidance" TEXT,
    "color" TEXT,

    CONSTRAINT "RiskFactorLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskLevelDef" (
    "id" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748B',
    "order" INTEGER NOT NULL DEFAULT 0,
    "minScore" INTEGER,
    "maxScore" INTEGER,
    "acceptance" "RiskAcceptanceLevel" NOT NULL DEFAULT 'ALARP',
    "requiresCapa" BOOLEAN NOT NULL DEFAULT false,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "requiresControl" BOOLEAN NOT NULL DEFAULT false,
    "reviewMonths" INTEGER,
    "escalateToRoleId" TEXT,

    CONSTRAINT "RiskLevelDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskMatrixCell" (
    "id" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "rowFactorKey" TEXT NOT NULL,
    "rowRank" INTEGER NOT NULL,
    "colFactorKey" TEXT NOT NULL,
    "colRank" INTEGER NOT NULL,
    "score" INTEGER,
    "levelId" TEXT NOT NULL,

    CONSTRAINT "RiskMatrixCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskRegister" (
    "id" TEXT NOT NULL,
    "registerNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" "RiskRegisterScope" NOT NULL DEFAULT 'SITE',
    "scopeRef" JSONB,
    "frameworkId" TEXT,
    "siteId" TEXT,
    "departmentId" TEXT,
    "ownerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskRegister_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL,
    "riskNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "registerId" TEXT NOT NULL,
    "frameworkId" TEXT,
    "categoryId" TEXT,
    "hazard" TEXT,
    "hazardousSituation" TEXT,
    "harm" TEXT,
    "cause" TEXT,
    "consequence" TEXT,
    "status" "RiskStatus" NOT NULL DEFAULT 'IDENTIFIED',
    "treatment" "RiskTreatment",
    "initialFactors" JSONB,
    "initialScore" INTEGER,
    "initialLevelId" TEXT,
    "residualFactors" JSONB,
    "residualScore" INTEGER,
    "residualLevelId" TEXT,
    "targetFactors" JSONB,
    "targetScore" INTEGER,
    "targetLevelId" TEXT,
    "ownerId" TEXT,
    "departmentId" TEXT,
    "siteId" TEXT,
    "identifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "workflowId" TEXT,
    "workflowTicketId" TEXT,
    "workflowTicketUniqueId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskScoreSnapshot" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "stage" "RiskScoreStage" NOT NULL,
    "factors" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "levelCode" TEXT NOT NULL,
    "levelLabel" TEXT NOT NULL,
    "formula" "RiskScoreFormula" NOT NULL,
    "frameworkId" TEXT,
    "reason" TEXT,
    "userId" TEXT,
    "userName" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskScoreSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskLink" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "label" TEXT,
    "relation" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RiskFramework_code_key" ON "RiskFramework"("code");

-- CreateIndex
CREATE INDEX "RiskFramework_isActive_methodology_idx" ON "RiskFramework"("isActive", "methodology");

-- CreateIndex
CREATE INDEX "RiskFactor_frameworkId_order_idx" ON "RiskFactor"("frameworkId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "RiskFactor_frameworkId_key_key" ON "RiskFactor"("frameworkId", "key");

-- CreateIndex
CREATE INDEX "RiskFactorLevel_factorId_idx" ON "RiskFactorLevel"("factorId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskFactorLevel_factorId_rank_key" ON "RiskFactorLevel"("factorId", "rank");

-- CreateIndex
CREATE INDEX "RiskLevelDef_frameworkId_order_idx" ON "RiskLevelDef"("frameworkId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "RiskLevelDef_frameworkId_code_key" ON "RiskLevelDef"("frameworkId", "code");

-- CreateIndex
CREATE INDEX "RiskMatrixCell_frameworkId_idx" ON "RiskMatrixCell"("frameworkId");

-- CreateIndex
CREATE INDEX "RiskMatrixCell_levelId_idx" ON "RiskMatrixCell"("levelId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskMatrixCell_frameworkId_rowFactorKey_rowRank_colFactorKe_key" ON "RiskMatrixCell"("frameworkId", "rowFactorKey", "rowRank", "colFactorKey", "colRank");

-- CreateIndex
CREATE UNIQUE INDEX "RiskCategory_code_key" ON "RiskCategory"("code");

-- CreateIndex
CREATE INDEX "RiskCategory_parentId_isActive_idx" ON "RiskCategory"("parentId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RiskRegister_registerNumber_key" ON "RiskRegister"("registerNumber");

-- CreateIndex
CREATE INDEX "RiskRegister_siteId_isActive_idx" ON "RiskRegister"("siteId", "isActive");

-- CreateIndex
CREATE INDEX "RiskRegister_scope_idx" ON "RiskRegister"("scope");

-- CreateIndex
CREATE INDEX "RiskRegister_ownerId_idx" ON "RiskRegister"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Risk_riskNumber_key" ON "Risk"("riskNumber");

-- CreateIndex
CREATE INDEX "Risk_registerId_status_idx" ON "Risk"("registerId", "status");

-- CreateIndex
CREATE INDEX "Risk_ownerId_idx" ON "Risk"("ownerId");

-- CreateIndex
CREATE INDEX "Risk_nextReviewAt_idx" ON "Risk"("nextReviewAt");

-- CreateIndex
CREATE INDEX "Risk_residualScore_idx" ON "Risk"("residualScore");

-- CreateIndex
CREATE INDEX "Risk_categoryId_idx" ON "Risk"("categoryId");

-- CreateIndex
CREATE INDEX "RiskScoreSnapshot_riskId_createdAt_idx" ON "RiskScoreSnapshot"("riskId", "createdAt");

-- CreateIndex
CREATE INDEX "RiskLink_entityType_entityId_idx" ON "RiskLink"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskLink_riskId_entityType_entityId_relation_key" ON "RiskLink"("riskId", "entityType", "entityId", "relation");

-- AddForeignKey
ALTER TABLE "RiskFactor" ADD CONSTRAINT "RiskFactor_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "RiskFramework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskFactorLevel" ADD CONSTRAINT "RiskFactorLevel_factorId_fkey" FOREIGN KEY ("factorId") REFERENCES "RiskFactor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskLevelDef" ADD CONSTRAINT "RiskLevelDef_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "RiskFramework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskMatrixCell" ADD CONSTRAINT "RiskMatrixCell_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "RiskFramework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskMatrixCell" ADD CONSTRAINT "RiskMatrixCell_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "RiskLevelDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskCategory" ADD CONSTRAINT "RiskCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "RiskCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskRegister" ADD CONSTRAINT "RiskRegister_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "RiskFramework"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "RiskRegister"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "RiskFramework"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "RiskCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskScoreSnapshot" ADD CONSTRAINT "RiskScoreSnapshot_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskLink" ADD CONSTRAINT "RiskLink_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

