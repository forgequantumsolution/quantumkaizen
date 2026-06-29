-- CreateTable
CREATE TABLE "AuditScheduleRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "auditMasterId" TEXT NOT NULL,
    "frequency" "AuditFrequency" NOT NULL,
    "anchorDate" TIMESTAMP(3) NOT NULL,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 14,
    "plant" TEXT,
    "defaultAuditorId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSpawnedAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditScheduleRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditScheduleRule_isActive_nextRunAt_idx" ON "AuditScheduleRule"("isActive", "nextRunAt");

-- CreateIndex
CREATE INDEX "AuditScheduleRule_auditMasterId_idx" ON "AuditScheduleRule"("auditMasterId");

-- AddForeignKey
ALTER TABLE "AuditScheduleRule" ADD CONSTRAINT "AuditScheduleRule_auditMasterId_fkey" FOREIGN KEY ("auditMasterId") REFERENCES "AuditMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
