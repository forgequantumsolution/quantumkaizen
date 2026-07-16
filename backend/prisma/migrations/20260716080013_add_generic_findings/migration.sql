-- AlterTable
ALTER TABLE "Capa" ADD COLUMN     "findingId" TEXT;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "sourceFindingId" TEXT;

-- AlterTable
ALTER TABLE "WorkflowType" ADD COLUMN     "supportsFindings" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL,
    "findingNumber" TEXT NOT NULL,
    "sourceTicketId" TEXT NOT NULL,
    "sourceStageId" TEXT,
    "severity" "FindingSeverity" NOT NULL,
    "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" JSONB,
    "recommendation" TEXT,
    "reference" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Finding_findingNumber_key" ON "Finding"("findingNumber");

-- CreateIndex
CREATE INDEX "Finding_sourceTicketId_idx" ON "Finding"("sourceTicketId");

-- CreateIndex
CREATE INDEX "Finding_status_idx" ON "Finding"("status");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_sourceFindingId_fkey" FOREIGN KEY ("sourceFindingId") REFERENCES "Finding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_sourceTicketId_fkey" FOREIGN KEY ("sourceTicketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
