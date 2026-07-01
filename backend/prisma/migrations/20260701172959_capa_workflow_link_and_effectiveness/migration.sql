-- AlterTable
ALTER TABLE "Capa" ADD COLUMN     "effectivenessData" JSONB,
ADD COLUMN     "workflowId" TEXT,
ADD COLUMN     "workflowTicketId" TEXT,
ADD COLUMN     "workflowTicketUniqueId" TEXT;
