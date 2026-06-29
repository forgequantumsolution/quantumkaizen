-- AlterTable
ALTER TABLE "AuditRegister" ADD COLUMN     "workflowId" TEXT,
ADD COLUMN     "workflowTicketId" TEXT,
ADD COLUMN     "workflowTicketUniqueId" TEXT;

-- AlterTable
ALTER TABLE "AuditScheduleRule" ADD COLUMN     "workflowId" TEXT;
