-- AlterTable
ALTER TABLE "Workflow" ADD COLUMN     "siteId" TEXT;

-- CreateIndex
CREATE INDEX "Workflow_siteId_idx" ON "Workflow"("siteId");

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
