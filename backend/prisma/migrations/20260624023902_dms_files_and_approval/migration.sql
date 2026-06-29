-- CreateEnum
CREATE TYPE "DocContentType" AS ENUM ('EDITOR', 'FILE');

-- AlterTable
ALTER TABLE "DocumentVersion" ADD COLUMN     "contentType" "DocContentType" NOT NULL DEFAULT 'EDITOR',
ADD COLUMN     "fileData" TEXT,
ADD COLUMN     "fileMime" TEXT,
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "fileSize" INTEGER;
