-- Risk integration phase 2: materialised per-entity risk profile.
-- Additive only. The table is a pure projection of RiskLink -> Risk and can be
-- truncated and rebuilt at any time (see risk-profile.service.ts recomputeAll).

-- CreateTable
CREATE TABLE "RiskProfile" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "openRiskCount" INTEGER NOT NULL DEFAULT 0,
    "totalRiskCount" INTEGER NOT NULL DEFAULT 0,
    "highestLevelCode" TEXT,
    "highestLevelLabel" TEXT,
    "highestLevelColor" TEXT,
    "severityRank" INTEGER,
    "acceptance" "RiskAcceptanceLevel",
    "maxResidualScore" INTEGER,
    "unacceptableCount" INTEGER NOT NULL DEFAULT 0,
    "overdueReviews" INTEGER NOT NULL DEFAULT 0,
    "openControls" INTEGER NOT NULL DEFAULT 0,
    "lastRiskEventAt" TIMESTAMP(3),
    "recomputedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RiskProfile_entityType_entityId_key" ON "RiskProfile"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "RiskProfile_entityType_severityRank_idx" ON "RiskProfile"("entityType", "severityRank");

-- CreateIndex
CREATE INDEX "RiskProfile_severityRank_idx" ON "RiskProfile"("severityRank");
