-- AlterTable
ALTER TABLE "AuditMaster" ADD COLUMN     "checklistForms" JSONB,
ALTER COLUMN "code" DROP NOT NULL;
