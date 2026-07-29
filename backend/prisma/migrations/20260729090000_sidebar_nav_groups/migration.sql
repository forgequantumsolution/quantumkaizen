-- CreateTable
CREATE TABLE "NavGroup" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "collapsible" BOOLEAN NOT NULL DEFAULT true,
    "defaultOpen" BOOLEAN NOT NULL DEFAULT false,
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NavGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NavGroupModule" (
    "id" TEXT NOT NULL,
    "navGroupId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NavGroupModule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NavGroup_key_key" ON "NavGroup"("key");

-- CreateIndex
CREATE UNIQUE INDEX "NavGroupModule_moduleKey_key" ON "NavGroupModule"("moduleKey");

-- CreateIndex
CREATE INDEX "NavGroupModule_navGroupId_sortOrder_idx" ON "NavGroupModule"("navGroupId", "sortOrder");

-- AddForeignKey
ALTER TABLE "NavGroupModule" ADD CONSTRAINT "NavGroupModule_navGroupId_fkey" FOREIGN KEY ("navGroupId") REFERENCES "NavGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- At most one fallback group. Prisma cannot express a partial unique index, so
-- it is applied here by hand; ensureNavGroups() repairs the zero-fallback case
-- (see src/lib/nav-group-defaults.ts).
CREATE UNIQUE INDEX "NavGroup_single_fallback" ON "NavGroup" ("isFallback") WHERE "isFallback";
