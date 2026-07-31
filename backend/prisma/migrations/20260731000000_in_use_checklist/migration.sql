-- In-use verification checklist per instrument category.
--
-- Purely additive: one new table and one new enum. Without this the check
-- screen can only offer a single generic row for every device type.

-- CreateEnum
CREATE TYPE "InUseCheckType" AS ENUM ('NUMERIC', 'PASS_FAIL');

-- CreateTable
CREATE TABLE "InUseCheckItem" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "checkType" "InUseCheckType" NOT NULL DEFAULT 'NUMERIC',
    "nominalValue" DECIMAL(18,6),
    "toleranceValue" DECIMAL(18,6),
    "unitCode" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "guidance" TEXT,

    CONSTRAINT "InUseCheckItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InUseCheckItem_categoryId_sequence_key" ON "InUseCheckItem"("categoryId", "sequence");

-- AddForeignKey
ALTER TABLE "InUseCheckItem" ADD CONSTRAINT "InUseCheckItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EquipmentCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

