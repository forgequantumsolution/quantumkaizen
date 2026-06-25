-- CreateEnum
CREATE TYPE "SampleStatus" AS ENUM ('REGISTERED', 'IN_TESTING', 'IN_REVIEW', 'RELEASED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CustodyAction" AS ENUM ('REGISTERED', 'RECEIVED', 'TRANSFERRED', 'STORED', 'ALIQUOTED', 'RETURNED', 'DISPOSED');

-- CreateTable
CREATE TABLE "StorageLocation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "tempZone" TEXT,
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sample" (
    "id" TEXT NOT NULL,
    "sampleNumber" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "batchNo" TEXT,
    "sampleType" TEXT,
    "sourceSite" TEXT,
    "specificationId" TEXT,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "collectedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "status" "SampleStatus" NOT NULL DEFAULT 'REGISTERED',
    "labId" TEXT,
    "currentLocationId" TEXT,
    "priority" TEXT,
    "remarks" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustodyEvent" (
    "id" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "action" "CustodyAction" NOT NULL,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "handlerName" TEXT,
    "handledById" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustodyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aliquot" (
    "id" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "storageLocationId" TEXT,
    "tempZone" TEXT,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "expiryAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'STORED',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Aliquot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StorageLocation_code_key" ON "StorageLocation"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Sample_sampleNumber_key" ON "Sample"("sampleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Sample_barcode_key" ON "Sample"("barcode");

-- CreateIndex
CREATE INDEX "Sample_status_idx" ON "Sample"("status");

-- CreateIndex
CREATE INDEX "CustodyEvent_sampleId_idx" ON "CustodyEvent"("sampleId");

-- CreateIndex
CREATE INDEX "Aliquot_sampleId_idx" ON "Aliquot"("sampleId");

-- CreateIndex
CREATE UNIQUE INDEX "Aliquot_sampleId_code_key" ON "Aliquot"("sampleId", "code");

-- AddForeignKey
ALTER TABLE "CustodyEvent" ADD CONSTRAINT "CustodyEvent_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aliquot" ADD CONSTRAINT "Aliquot_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample"("id") ON DELETE CASCADE ON UPDATE CASCADE;
