-- CreateEnum
CREATE TYPE "CapaType" AS ENUM ('CORRECTIVE', 'PREVENTIVE', 'BOTH');

-- CreateEnum
CREATE TYPE "CapaStatus" AS ENUM ('OPEN', 'INVESTIGATION', 'PLAN', 'IMPLEMENTATION', 'VERIFICATION', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActionItemStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'VERIFIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActionItemPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "Capa" (
    "id" TEXT NOT NULL,
    "capaNumber" TEXT NOT NULL,
    "type" "CapaType" NOT NULL DEFAULT 'CORRECTIVE',
    "status" "CapaStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "nonConformanceId" TEXT,
    "rootCause" TEXT,
    "rootCauseData" JSONB,
    "correctiveAction" TEXT,
    "preventiveAction" TEXT,
    "ownerId" TEXT,
    "departmentId" TEXT,
    "dueDate" TIMESTAMP(3),
    "implementedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "effectivenessCheck" TEXT,
    "effectivenessDue" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Capa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionItem" (
    "id" TEXT NOT NULL,
    "actionNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ActionItemStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "ActionItemPriority" NOT NULL DEFAULT 'MEDIUM',
    "ownerId" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "capaId" TEXT,
    "nonConformanceId" TEXT,
    "findingId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Capa_capaNumber_key" ON "Capa"("capaNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Capa_nonConformanceId_key" ON "Capa"("nonConformanceId");

-- CreateIndex
CREATE INDEX "Capa_status_idx" ON "Capa"("status");

-- CreateIndex
CREATE INDEX "Capa_ownerId_idx" ON "Capa"("ownerId");

-- CreateIndex
CREATE INDEX "Capa_departmentId_idx" ON "Capa"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ActionItem_actionNumber_key" ON "ActionItem"("actionNumber");

-- CreateIndex
CREATE INDEX "ActionItem_status_dueDate_idx" ON "ActionItem"("status", "dueDate");

-- CreateIndex
CREATE INDEX "ActionItem_ownerId_idx" ON "ActionItem"("ownerId");

-- CreateIndex
CREATE INDEX "ActionItem_capaId_idx" ON "ActionItem"("capaId");

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_nonConformanceId_fkey" FOREIGN KEY ("nonConformanceId") REFERENCES "NonConformance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "Capa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_nonConformanceId_fkey" FOREIGN KEY ("nonConformanceId") REFERENCES "NonConformance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "AuditFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
