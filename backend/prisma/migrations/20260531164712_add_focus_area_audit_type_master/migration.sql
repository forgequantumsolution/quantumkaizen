-- CreateTable
CREATE TABLE "FocusArea" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FocusArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditTypeMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditTypeMaster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FocusArea_name_key" ON "FocusArea"("name");

-- CreateIndex
CREATE INDEX "FocusArea_isActive_idx" ON "FocusArea"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AuditTypeMaster_name_key" ON "AuditTypeMaster"("name");

-- CreateIndex
CREATE INDEX "AuditTypeMaster_isActive_idx" ON "AuditTypeMaster"("isActive");
