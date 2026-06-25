-- CreateEnum
CREATE TYPE "TrainingStatus" AS ENUM ('ASSIGNED', 'COMPLETED');

-- CreateTable
CREATE TABLE "TrainingItem" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "documentId" TEXT,
    "roleId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingAssignment" (
    "id" TEXT NOT NULL,
    "trainingItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "TrainingStatus" NOT NULL DEFAULT 'ASSIGNED',
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "TrainingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingItem_code_key" ON "TrainingItem"("code");

-- CreateIndex
CREATE INDEX "TrainingItem_isActive_idx" ON "TrainingItem"("isActive");

-- CreateIndex
CREATE INDEX "TrainingAssignment_userId_status_idx" ON "TrainingAssignment"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingAssignment_trainingItemId_userId_key" ON "TrainingAssignment"("trainingItemId", "userId");

-- AddForeignKey
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_trainingItemId_fkey" FOREIGN KEY ("trainingItemId") REFERENCES "TrainingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
