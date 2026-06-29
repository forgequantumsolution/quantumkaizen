-- CreateTable
CREATE TABLE "TestDefinition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "technique" TEXT,
    "methodId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestAnalyte" (
    "id" TEXT NOT NULL,
    "testDefinitionId" TEXT NOT NULL,
    "analyteId" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "dataType" TEXT NOT NULL DEFAULT 'NUMERIC',
    "decimals" INTEGER,
    "calculation" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestAnalyte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestPanel" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestPanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestPanelItem" (
    "id" TEXT NOT NULL,
    "panelId" TEXT NOT NULL,
    "testDefinitionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TestPanelItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecVersion" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "specificationId" TEXT,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'RELEASE',
    "grade" TEXT,
    "market" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "pharmacopoeia" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecLine" (
    "id" TEXT NOT NULL,
    "specVersionId" TEXT NOT NULL,
    "analyteId" TEXT,
    "testDefinitionId" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "targetValue" DOUBLE PRECISION,
    "textCriteria" TEXT,
    "decimals" INTEGER,
    "sigFigs" INTEGER,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpecLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TestDefinition_code_key" ON "TestDefinition"("code");

-- CreateIndex
CREATE INDEX "TestAnalyte_testDefinitionId_idx" ON "TestAnalyte"("testDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "TestPanel_code_key" ON "TestPanel"("code");

-- CreateIndex
CREATE INDEX "TestPanelItem_panelId_idx" ON "TestPanelItem"("panelId");

-- CreateIndex
CREATE UNIQUE INDEX "SpecVersion_code_key" ON "SpecVersion"("code");

-- CreateIndex
CREATE INDEX "SpecLine_specVersionId_idx" ON "SpecLine"("specVersionId");

-- AddForeignKey
ALTER TABLE "TestAnalyte" ADD CONSTRAINT "TestAnalyte_testDefinitionId_fkey" FOREIGN KEY ("testDefinitionId") REFERENCES "TestDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestPanelItem" ADD CONSTRAINT "TestPanelItem_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "TestPanel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecLine" ADD CONSTRAINT "SpecLine_specVersionId_fkey" FOREIGN KEY ("specVersionId") REFERENCES "SpecVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
