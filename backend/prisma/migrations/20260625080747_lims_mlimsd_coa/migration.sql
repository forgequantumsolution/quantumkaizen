-- CreateTable
CREATE TABLE "CoaTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "headerHtml" TEXT,
    "footerHtml" TEXT,
    "sections" TEXT NOT NULL DEFAULT 'description,results,conclusion,signatures',
    "customerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoaTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coa" (
    "id" TEXT NOT NULL,
    "coaNumber" TEXT NOT NULL,
    "sampleId" TEXT,
    "productName" TEXT NOT NULL,
    "batchNo" TEXT,
    "specVersionId" TEXT,
    "templateId" TEXT,
    "customerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "verifyToken" TEXT,
    "conclusion" TEXT,
    "resultsJson" TEXT,
    "issuedById" TEXT,
    "issuedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoaTemplate_code_key" ON "CoaTemplate"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Coa_coaNumber_key" ON "Coa"("coaNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Coa_verifyToken_key" ON "Coa"("verifyToken");

-- CreateIndex
CREATE INDEX "Coa_sampleId_idx" ON "Coa"("sampleId");

-- CreateIndex
CREATE INDEX "Coa_status_idx" ON "Coa"("status");
