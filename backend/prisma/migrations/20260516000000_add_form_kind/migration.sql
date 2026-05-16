-- CreateEnum
CREATE TYPE "FormKind" AS ENUM ('FORM', 'CHECKLIST');

-- AlterTable
ALTER TABLE "Form" ADD COLUMN "kind" "FormKind" NOT NULL DEFAULT 'FORM';

-- CreateIndex
CREATE INDEX "Form_kind_status_idx" ON "Form"("kind", "status");
