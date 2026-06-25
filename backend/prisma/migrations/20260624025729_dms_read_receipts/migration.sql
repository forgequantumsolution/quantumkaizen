-- CreateEnum
CREATE TYPE "ReadReceiptStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED');

-- CreateTable
CREATE TABLE "DocumentReadReceipt" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ReadReceiptStatus" NOT NULL DEFAULT 'PENDING',
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "DocumentReadReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentReadReceipt_userId_status_idx" ON "DocumentReadReceipt"("userId", "status");

-- CreateIndex
CREATE INDEX "DocumentReadReceipt_documentId_idx" ON "DocumentReadReceipt"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentReadReceipt_documentId_versionId_userId_key" ON "DocumentReadReceipt"("documentId", "versionId", "userId");

-- AddForeignKey
ALTER TABLE "DocumentReadReceipt" ADD CONSTRAINT "DocumentReadReceipt_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
