/*
  Warnings:

  - You are about to drop the `ChecklistQuestion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ChecklistSection` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ChecklistTemplate` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ChecklistQuestion" DROP CONSTRAINT "ChecklistQuestion_sectionId_fkey";

-- DropForeignKey
ALTER TABLE "ChecklistSection" DROP CONSTRAINT "ChecklistSection_templateId_fkey";

-- DropTable
DROP TABLE "ChecklistQuestion";

-- DropTable
DROP TABLE "ChecklistSection";

-- DropTable
DROP TABLE "ChecklistTemplate";

-- DropEnum
DROP TYPE "ChecklistResponseType";

-- DropEnum
DROP TYPE "ChecklistScoringMode";

-- DropEnum
DROP TYPE "ChecklistTemplateStatus";
