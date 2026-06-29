-- CreateEnum
CREATE TYPE "FormFillMode" AS ENUM ('ANYONE', 'EACH');

-- AlterTable
ALTER TABLE "StageFormBinding" ADD COLUMN     "fillMode" "FormFillMode" NOT NULL DEFAULT 'ANYONE';

-- CreateTable
CREATE TABLE "_FormBindingFillRoles" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_FormBindingViewRoles" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_FormBindingFillUsers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_FormBindingViewUsers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_FormBindingFillRoles_AB_unique" ON "_FormBindingFillRoles"("A", "B");

-- CreateIndex
CREATE INDEX "_FormBindingFillRoles_B_index" ON "_FormBindingFillRoles"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_FormBindingViewRoles_AB_unique" ON "_FormBindingViewRoles"("A", "B");

-- CreateIndex
CREATE INDEX "_FormBindingViewRoles_B_index" ON "_FormBindingViewRoles"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_FormBindingFillUsers_AB_unique" ON "_FormBindingFillUsers"("A", "B");

-- CreateIndex
CREATE INDEX "_FormBindingFillUsers_B_index" ON "_FormBindingFillUsers"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_FormBindingViewUsers_AB_unique" ON "_FormBindingViewUsers"("A", "B");

-- CreateIndex
CREATE INDEX "_FormBindingViewUsers_B_index" ON "_FormBindingViewUsers"("B");

-- AddForeignKey
ALTER TABLE "_FormBindingFillRoles" ADD CONSTRAINT "_FormBindingFillRoles_A_fkey" FOREIGN KEY ("A") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FormBindingFillRoles" ADD CONSTRAINT "_FormBindingFillRoles_B_fkey" FOREIGN KEY ("B") REFERENCES "StageFormBinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FormBindingViewRoles" ADD CONSTRAINT "_FormBindingViewRoles_A_fkey" FOREIGN KEY ("A") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FormBindingViewRoles" ADD CONSTRAINT "_FormBindingViewRoles_B_fkey" FOREIGN KEY ("B") REFERENCES "StageFormBinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FormBindingFillUsers" ADD CONSTRAINT "_FormBindingFillUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "StageFormBinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FormBindingFillUsers" ADD CONSTRAINT "_FormBindingFillUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FormBindingViewUsers" ADD CONSTRAINT "_FormBindingViewUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "StageFormBinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FormBindingViewUsers" ADD CONSTRAINT "_FormBindingViewUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
