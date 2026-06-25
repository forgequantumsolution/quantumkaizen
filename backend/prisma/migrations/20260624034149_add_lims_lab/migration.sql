-- CreateEnum
CREATE TYPE "LabType" AS ENUM ('INTERNAL', 'PARTNER', 'CONTRACT');

-- CreateTable
CREATE TABLE "Lab" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LabType" NOT NULL DEFAULT 'INTERNAL',
    "gmpClass" TEXT,
    "siteCode" TEXT,
    "location" TEXT,
    "accreditation" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lab_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lab_code_key" ON "Lab"("code");

-- CreateIndex
CREATE INDEX "Lab_type_idx" ON "Lab"("type");

-- CreateIndex
CREATE INDEX "Lab_isActive_idx" ON "Lab"("isActive");
