-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "defaultPanelId" TEXT;

-- AlterTable
ALTER TABLE "Sample" ADD COLUMN     "disposition" TEXT,
ADD COLUMN     "productId" TEXT,
ADD COLUMN     "releasedAt" TIMESTAMP(3),
ADD COLUMN     "releasedById" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "specVersionId" TEXT;

-- CreateTable
CREATE TABLE "SampleTest" (
    "id" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "testDefinitionId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "specVersionId" TEXT,
    "worklistId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "overallResult" TEXT,
    "analystId" TEXT,
    "analystName" TEXT,
    "instrumentId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SampleTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL,
    "sampleTestId" TEXT NOT NULL,
    "analyteName" TEXT NOT NULL,
    "specLineId" TEXT,
    "unit" TEXT,
    "numericValue" DOUBLE PRECISION,
    "textValue" TEXT,
    "evaluation" TEXT NOT NULL DEFAULT 'PENDING',
    "isOutOfSpec" BOOLEAN NOT NULL DEFAULT false,
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "decimals" INTEGER,
    "calculation" TEXT,
    "instrumentId" TEXT,
    "enteredById" TEXT,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Worklist" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "analystId" TEXT,
    "analystName" TEXT,
    "instrumentId" TEXT,
    "systemSuitability" TEXT,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Worklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OosInvestigation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sampleId" TEXT,
    "sampleTestId" TEXT,
    "resultId" TEXT,
    "title" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'PHASE_1A',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "classification" TEXT,
    "hypothesis" TEXT,
    "investigationSummary" TEXT,
    "retestRequired" BOOLEAN NOT NULL DEFAULT false,
    "resampleRequired" BOOLEAN NOT NULL DEFAULT false,
    "conclusion" TEXT,
    "capaId" TEXT,
    "openedById" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OosInvestigation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SampleTest_sampleId_idx" ON "SampleTest"("sampleId");

-- CreateIndex
CREATE INDEX "SampleTest_worklistId_idx" ON "SampleTest"("worklistId");

-- CreateIndex
CREATE INDEX "SampleTest_status_idx" ON "SampleTest"("status");

-- CreateIndex
CREATE INDEX "Result_sampleTestId_idx" ON "Result"("sampleTestId");

-- CreateIndex
CREATE UNIQUE INDEX "Worklist_code_key" ON "Worklist"("code");

-- CreateIndex
CREATE UNIQUE INDEX "OosInvestigation_code_key" ON "OosInvestigation"("code");

-- CreateIndex
CREATE INDEX "OosInvestigation_sampleId_idx" ON "OosInvestigation"("sampleId");

-- CreateIndex
CREATE INDEX "OosInvestigation_status_idx" ON "OosInvestigation"("status");

-- AddForeignKey
ALTER TABLE "SampleTest" ADD CONSTRAINT "SampleTest_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleTest" ADD CONSTRAINT "SampleTest_worklistId_fkey" FOREIGN KEY ("worklistId") REFERENCES "Worklist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_sampleTestId_fkey" FOREIGN KEY ("sampleTestId") REFERENCES "SampleTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
