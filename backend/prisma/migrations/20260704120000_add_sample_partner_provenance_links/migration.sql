-- AlterTable
ALTER TABLE "Sample" ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "samplingPointId" TEXT,
ADD COLUMN     "supplierId" TEXT;

-- AddForeignKey
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_samplingPointId_fkey" FOREIGN KEY ("samplingPointId") REFERENCES "SamplingPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
