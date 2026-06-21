-- CreateTable
CREATE TABLE "AuditTrailEntry" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditTrailEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ESignature" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ESignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditTrailEntry_entityType_entityId_idx" ON "AuditTrailEntry"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditTrailEntry_createdAt_idx" ON "AuditTrailEntry"("createdAt");

-- CreateIndex
CREATE INDEX "ESignature_entityType_entityId_idx" ON "ESignature"("entityType", "entityId");
