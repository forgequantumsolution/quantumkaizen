-- Async hash-chain sealing.
--
-- Chaining on the write path required an advisory lock per entry. Because
-- `pg_advisory_xact_lock` is transaction-scoped, an audit write that joined a
-- caller's transaction held that lock until the caller committed — so one slow
-- workflow transition serialised every other write in the application, and under
-- concurrency the pool starved and requests hung.
--
-- Entries are now inserted unsealed and chained afterwards by the sealer
-- (src/lib/audit-seal.ts). That requires exactly one permitted UPDATE: NULL hash
-- becoming non-NULL, with no other column altered. Everything else stays
-- rejected, and DELETE stays rejected unconditionally.

CREATE OR REPLACE FUNCTION qk_audit_seal_or_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'audit records are append-only: DELETE on %.% is not permitted',
      TG_TABLE_SCHEMA, TG_TABLE_NAME
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- One-way seal: the chain columns may be filled in once, and only once,
  -- provided the recorded facts are byte-for-byte unchanged.
  IF OLD."hash" IS NULL
     AND NEW."hash" IS NOT NULL
     AND (to_jsonb(OLD) - 'hash' - 'prevHash' - 'chainKey')
       = (to_jsonb(NEW) - 'hash' - 'prevHash' - 'chainKey')
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'audit records are append-only: UPDATE on %.% is not permitted (only the one-way chain seal is allowed)',
    TG_TABLE_SCHEMA, TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "AuditTrailEntry_append_only" ON "AuditTrailEntry";
CREATE TRIGGER "AuditTrailEntry_append_only"
  BEFORE UPDATE OR DELETE ON "AuditTrailEntry"
  FOR EACH ROW EXECUTE FUNCTION qk_audit_seal_or_immutable();

-- ESignature and AuditTrailReview are never sealed, so they keep the strict rule.

-- Finding the unsealed tail is the sealer's hot path.
CREATE INDEX IF NOT EXISTS "AuditTrailEntry_unsealed_idx"
  ON "AuditTrailEntry"("seq") WHERE "hash" IS NULL;
