-- CreateEnum
CREATE TYPE "TicketClassification" AS ENUM ('PRODUCT', 'PROCESS', 'SYSTEM', 'EQUIPMENT', 'DOCUMENTATION', 'TRAINING', 'OTHER');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "classification" "TicketClassification",
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "severityId" TEXT;

-- CreateTable
CREATE TABLE "Severity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Severity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Severity_name_key" ON "Severity"("name");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_severityId_fkey" FOREIGN KEY ("severityId") REFERENCES "Severity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
