-- CreateTable
CREATE TABLE "QcMaterial" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "analyteName" TEXT,
    "methodId" TEXT,
    "lotNo" TEXT,
    "unit" TEXT,
    "targetMean" DOUBLE PRECISION,
    "targetSd" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QcMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QcResult" (
    "id" TEXT NOT NULL,
    "qcMaterialId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "analystName" TEXT,
    "instrumentId" TEXT,
    "zScore" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'ACCEPT',
    "violatedRules" TEXT,
    "remarks" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QcResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StabilityStudy" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "batchNo" TEXT,
    "title" TEXT NOT NULL,
    "specVersionId" TEXT,
    "packaging" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3),
    "timepointsMonths" TEXT NOT NULL DEFAULT '0,3,6,9,12,18,24',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StabilityStudy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StabilityCondition" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tempZone" TEXT,
    "storageLocationId" TEXT,
    "orientation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StabilityCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StabilityPull" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "conditionId" TEXT,
    "conditionName" TEXT,
    "timepointLabel" TEXT NOT NULL,
    "timepointMonths" INTEGER NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "sampleId" TEXT,
    "pulledAt" TIMESTAMP(3),
    "testedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StabilityPull_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QcMaterial_code_key" ON "QcMaterial"("code");

-- CreateIndex
CREATE INDEX "QcResult_qcMaterialId_idx" ON "QcResult"("qcMaterialId");

-- CreateIndex
CREATE UNIQUE INDEX "StabilityStudy_code_key" ON "StabilityStudy"("code");

-- CreateIndex
CREATE INDEX "StabilityCondition_studyId_idx" ON "StabilityCondition"("studyId");

-- CreateIndex
CREATE INDEX "StabilityPull_studyId_idx" ON "StabilityPull"("studyId");

-- CreateIndex
CREATE INDEX "StabilityPull_status_idx" ON "StabilityPull"("status");

-- AddForeignKey
ALTER TABLE "QcResult" ADD CONSTRAINT "QcResult_qcMaterialId_fkey" FOREIGN KEY ("qcMaterialId") REFERENCES "QcMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StabilityCondition" ADD CONSTRAINT "StabilityCondition_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "StabilityStudy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StabilityPull" ADD CONSTRAINT "StabilityPull_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "StabilityStudy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
