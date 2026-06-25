-- CreateEnum
CREATE TYPE "SpecStatus" AS ENUM ('DRAFT', 'APPROVED', 'RETIRED');

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "number" TEXT,
    "labId" TEXT,
    "issuedBy" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiryFlaggedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestMethod" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "technique" TEXT,
    "sopRef" TEXT,
    "documentId" TEXT,
    "description" TEXT,
    "defaultUnit" TEXT,
    "price" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Specification" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "SpecStatus" NOT NULL DEFAULT 'DRAFT',
    "pharmacopoeia" TEXT,
    "description" TEXT,
    "isoStandardId" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Specification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecParameter" (
    "id" TEXT NOT NULL,
    "specificationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "targetValue" DOUBLE PRECISION,
    "textCriteria" TEXT,
    "methodId" TEXT,
    "pharmacopoeiaRef" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SpecParameter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Certification_code_key" ON "Certification"("code");

-- CreateIndex
CREATE INDEX "Certification_labId_idx" ON "Certification"("labId");

-- CreateIndex
CREATE INDEX "Certification_expiryDate_idx" ON "Certification"("expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "TestMethod_code_key" ON "TestMethod"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Specification_code_key" ON "Specification"("code");

-- CreateIndex
CREATE INDEX "Specification_status_idx" ON "Specification"("status");

-- CreateIndex
CREATE INDEX "SpecParameter_specificationId_idx" ON "SpecParameter"("specificationId");

-- AddForeignKey
ALTER TABLE "SpecParameter" ADD CONSTRAINT "SpecParameter_specificationId_fkey" FOREIGN KEY ("specificationId") REFERENCES "Specification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecParameter" ADD CONSTRAINT "SpecParameter_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "TestMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
