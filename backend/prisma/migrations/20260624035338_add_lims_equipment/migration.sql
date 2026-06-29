-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('ACTIVE', 'OUT_OF_SERVICE', 'RETIRED');

-- CreateEnum
CREATE TYPE "CalibrationResult" AS ENUM ('PASS', 'FAIL', 'CONDITIONAL');

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "labId" TEXT,
    "serialNo" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "location" TEXT,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "calibrationFrequencyDays" INTEGER,
    "lastCalibratedAt" TIMESTAMP(3),
    "calibrationDueAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationRecord" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "calibratedAt" TIMESTAMP(3) NOT NULL,
    "result" "CalibrationResult" NOT NULL DEFAULT 'PASS',
    "certificateNo" TEXT,
    "nextDueAt" TIMESTAMP(3),
    "performedBy" TEXT,
    "remarks" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalibrationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_code_key" ON "Equipment"("code");

-- CreateIndex
CREATE INDEX "Equipment_status_idx" ON "Equipment"("status");

-- CreateIndex
CREATE INDEX "Equipment_labId_idx" ON "Equipment"("labId");

-- CreateIndex
CREATE INDEX "CalibrationRecord_equipmentId_idx" ON "CalibrationRecord"("equipmentId");

-- AddForeignKey
ALTER TABLE "CalibrationRecord" ADD CONSTRAINT "CalibrationRecord_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
