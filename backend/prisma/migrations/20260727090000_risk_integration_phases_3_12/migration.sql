-- Risk cross-module integration, phases 3-12.
--
-- Entirely additive: new nullable columns, new columns with defaults, and three
-- new tables. No column is dropped, retyped or made stricter, so existing rows
-- and in-flight workflows are unaffected and the migration is reversible by
-- dropping what it adds.

-- ── Phase 3: policy flags that actually gate something ──────────────────────
ALTER TABLE "RiskLevelDef"
  ADD COLUMN "requiresTraining"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "blocksChangeApproval" BOOLEAN NOT NULL DEFAULT false;

-- Second-person sign-off for `requiresApproval`. Deliberately separate from the
-- workflow ApprovalInstance, which is anchored to a ticket and needs a policy
-- bound to a workflow stage — neither of which a risk has.
CREATE TABLE "RiskApproval" (
    "id"            TEXT NOT NULL,
    "riskId"        TEXT NOT NULL,
    "levelCode"     TEXT,
    "status"        TEXT NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT,
    "requestedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById"   TEXT,
    "decidedAt"     TIMESTAMP(3),
    "decision"      TEXT,
    "comment"       TEXT,
    "eSignatureId"  TEXT,

    CONSTRAINT "RiskApproval_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RiskApproval_riskId_status_idx" ON "RiskApproval"("riskId", "status");
CREATE INDEX "RiskApproval_status_idx"        ON "RiskApproval"("status");
ALTER TABLE "RiskApproval"
  ADD CONSTRAINT "RiskApproval_riskId_fkey"
  FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Phase 4: trigger routing ────────────────────────────────────────────────
CREATE TABLE "RiskTriggerRule" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "condition"   JSONB,
    "mode"        TEXT NOT NULL DEFAULT 'RISK',
    "registerId"  TEXT,
    "frameworkId" TEXT,
    "categoryId"  TEXT,
    "autoCreate"  BOOLEAN NOT NULL DEFAULT false,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskTriggerRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RiskTriggerRule_triggerType_isActive_idx" ON "RiskTriggerRule"("triggerType", "isActive");

-- ── Phase 5: evaluable stage criteria ───────────────────────────────────────
-- Null `kind` = a label-only criterion, which is what every existing row is;
-- those never block a transition.
ALTER TABLE "ActionCriteria"
  ADD COLUMN "kind"   TEXT,
  ADD COLUMN "config" JSONB;
CREATE INDEX "ActionCriteria_kind_idx" ON "ActionCriteria"("kind");

-- ── Phase 6: risk-weighted audit programme planning ─────────────────────────
ALTER TABLE "AuditScheduleRule"
  ADD COLUMN "riskWeighted"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "riskEntityType"   TEXT,
  ADD COLUMN "riskEntityId"     TEXT,
  ADD COLUMN "minFrequencyDays" INTEGER,
  ADD COLUMN "maxFrequencyDays" INTEGER;

-- ── Phase 8: derived supplier risk tier ─────────────────────────────────────
ALTER TABLE "Supplier"
  ADD COLUMN "riskTier"          TEXT,
  ADD COLUMN "riskTierUpdatedAt" TIMESTAMP(3);

-- ── Phase 10/11: risk-scored checklist fields ───────────────────────────────
ALTER TABLE "FormField"
  ADD COLUMN "riskFactorKey" TEXT,
  ADD COLUMN "riskRankMap"   JSONB,
  ADD COLUMN "raisesRisk"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "riskSeverity"  TEXT;

-- ── Phase 12: risk appetite ─────────────────────────────────────────────────
CREATE TABLE "RiskAppetite" (
    "id"                  TEXT NOT NULL,
    "name"                TEXT NOT NULL,
    "organizationId"      TEXT,
    "siteId"              TEXT,
    "categoryId"          TEXT,
    "toleranceRank"       INTEGER NOT NULL,
    "statement"           TEXT,
    "requiresBoardReview" BOOLEAN NOT NULL DEFAULT false,
    "isActive"            BOOLEAN NOT NULL DEFAULT true,
    "createdById"         TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskAppetite_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RiskAppetite_isActive_siteId_categoryId_idx" ON "RiskAppetite"("isActive", "siteId", "categoryId");
