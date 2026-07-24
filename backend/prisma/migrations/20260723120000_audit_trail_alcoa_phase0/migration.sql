-- ALCOA++ audit trail — Phase 0.
--
-- Additive only: no column is dropped, retyped or backfilled, and no existing
-- row is modified. Historic entries keep NULL provenance/hash columns; the
-- chain starts at the first entry written after this migration and the
-- commencement date is recorded as a system event (see below). Fabricating
-- history for pre-existing rows would itself be a data-integrity offence.

-- ── Enums ──────────────────────────────────────────────────────────────────
CREATE TYPE "AuditCriticality" AS ENUM ('NORMAL', 'CRITICAL');
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'SYSTEM', 'JOB', 'INTEGRATION');

-- ── AuditTrailEntry: provenance, integrity and classification columns ──────
ALTER TABLE "AuditTrailEntry"
  ADD COLUMN "seq"               BIGSERIAL,
  ADD COLUMN "entityLabel"       TEXT,
  ADD COLUMN "module"            TEXT,
  ADD COLUMN "valueType"         TEXT,
  ADD COLUMN "diff"              JSONB,
  ADD COLUMN "criticality"       "AuditCriticality" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "reasonCode"        TEXT,
  ADD COLUMN "signatureId"       TEXT,
  ADD COLUMN "actorType"         "AuditActorType" NOT NULL DEFAULT 'USER',
  ADD COLUMN "userEmployeeId"    TEXT,
  ADD COLUMN "userRole"          TEXT,
  ADD COLUMN "userDepartment"    TEXT,
  ADD COLUMN "onBehalfOfId"      TEXT,
  ADD COLUMN "sessionId"         TEXT,
  ADD COLUMN "ipAddress"         TEXT,
  ADD COLUMN "userAgent"         TEXT,
  ADD COLUMN "requestId"         TEXT,
  ADD COLUMN "source"            TEXT,
  ADD COLUMN "clientTzOffsetMin" INTEGER,
  ADD COLUMN "chainKey"          TEXT,
  ADD COLUMN "prevHash"          TEXT,
  ADD COLUMN "hash"              TEXT;

-- Timestamps become timezone-aware. Existing values are interpreted as UTC,
-- which is what `now()` on a UTC-configured server already wrote.
ALTER TABLE "AuditTrailEntry"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(6) USING "createdAt" AT TIME ZONE 'UTC';

CREATE INDEX "AuditTrailEntry_userId_createdAt_idx"      ON "AuditTrailEntry"("userId", "createdAt");
CREATE INDEX "AuditTrailEntry_module_action_createdAt_idx" ON "AuditTrailEntry"("module", "action", "createdAt");
CREATE INDEX "AuditTrailEntry_criticality_createdAt_idx" ON "AuditTrailEntry"("criticality", "createdAt");
CREATE INDEX "AuditTrailEntry_chainKey_seq_idx"          ON "AuditTrailEntry"("chainKey", "seq");
CREATE INDEX "AuditTrailEntry_requestId_idx"             ON "AuditTrailEntry"("requestId");

-- ── ESignature: bind signatures to content and to the trail ───────────────
ALTER TABLE "ESignature"
  ADD COLUMN "meaningCode"        TEXT,
  ADD COLUMN "recordHash"         TEXT,
  ADD COLUMN "auditEntryId"       TEXT,
  ADD COLUMN "sessionId"          TEXT,
  ADD COLUMN "ipAddress"          TEXT,
  ADD COLUMN "invalidatedAt"      TIMESTAMPTZ(6),
  ADD COLUMN "invalidatedById"    TEXT,
  ADD COLUMN "invalidationReason" TEXT;

ALTER TABLE "ESignature"
  ALTER COLUMN "signedAt" TYPE TIMESTAMPTZ(6) USING "signedAt" AT TIME ZONE 'UTC';

CREATE INDEX "ESignature_userId_signedAt_idx" ON "ESignature"("userId", "signedAt");

-- ── Governance tables ─────────────────────────────────────────────────────
CREATE TABLE "AuditTrailReview" (
  "id"           TEXT NOT NULL,
  "scope"        TEXT NOT NULL,
  "periodStart"  TIMESTAMPTZ(6) NOT NULL,
  "periodEnd"    TIMESTAMPTZ(6) NOT NULL,
  "eventCount"   INTEGER NOT NULL,
  "findings"     TEXT,
  "outcome"      TEXT NOT NULL,
  "reviewerId"   TEXT NOT NULL,
  "reviewerName" TEXT NOT NULL,
  "signatureId"  TEXT,
  "reviewedAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "AuditTrailReview_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditTrailReview_scope_periodEnd_idx" ON "AuditTrailReview"("scope", "periodEnd");

CREATE TABLE "AuditChainCheckpoint" (
  "id"            TEXT NOT NULL,
  "chainKey"      TEXT NOT NULL,
  "fromSeq"       BIGINT NOT NULL,
  "toSeq"         BIGINT NOT NULL,
  "headHash"      TEXT NOT NULL,
  "entryCount"    INTEGER NOT NULL,
  "verified"      BOOLEAN NOT NULL,
  "failureDetail" TEXT,
  "checkedAt"     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "AuditChainCheckpoint_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditChainCheckpoint_chainKey_idx"  ON "AuditChainCheckpoint"("chainKey");
CREATE INDEX "AuditChainCheckpoint_checkedAt_idx" ON "AuditChainCheckpoint"("checkedAt");

-- ── Append-only enforcement ───────────────────────────────────────────────
-- Application-side discipline is not evidence. These triggers make UPDATE and
-- DELETE fail at the database, for every client, including psql.
CREATE OR REPLACE FUNCTION qk_audit_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit records are append-only: % on %.% is not permitted',
    TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditTrailEntry_append_only"
  BEFORE UPDATE OR DELETE ON "AuditTrailEntry"
  FOR EACH ROW EXECUTE FUNCTION qk_audit_immutable();

CREATE TRIGGER "ESignature_append_only"
  BEFORE UPDATE OR DELETE ON "ESignature"
  FOR EACH ROW EXECUTE FUNCTION qk_audit_immutable();

CREATE TRIGGER "AuditTrailReview_append_only"
  BEFORE UPDATE OR DELETE ON "AuditTrailReview"
  FOR EACH ROW EXECUTE FUNCTION qk_audit_immutable();

-- ── Commencement marker ───────────────────────────────────────────────────
-- Honest start line for the tamper-evident trail, instead of backfilled hashes.
INSERT INTO "AuditTrailEntry"
  ("id", "entityType", "entityId", "action", "newValue", "userName", "actorType",
   "module", "criticality", "source", "createdAt")
VALUES
  (gen_random_uuid()::text, 'System', 'audit-trail', 'CONFIG_CHANGE',
   'ALCOA++ audit trail commenced: provenance capture, append-only enforcement and hash chaining enabled',
   'system', 'SYSTEM', 'ADMIN', 'CRITICAL', 'API', now());
