/*
  Warnings:

  - Changed the type of `auditType` on the `AuditRegister` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "AuditRegister" DROP COLUMN "auditType",
ADD COLUMN     "auditType" TEXT NOT NULL;
