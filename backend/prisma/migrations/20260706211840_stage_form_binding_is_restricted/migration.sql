-- StageFormBinding.isRestricted — make per-form openness EXPLICIT instead of
-- inferring it from "empty fill group".
--
-- New rows default to restricted (secure-by-default). Existing rows are
-- backfilled below so behaviour is preserved EXACTLY:
--   * a binding that already had any fill/view group  -> stays restricted
--     (it was already enforced; no change),
--   * a binding with NO group at all ("legacy open")  -> set open
--     (everyone could read & fill it before; keep it that way).

-- 1. Add the column. DEFAULT true applies to existing rows too (temporarily);
--    the backfill in step 2 flips the groupless ones back to open.
ALTER TABLE "StageFormBinding" ADD COLUMN "isRestricted" BOOLEAN NOT NULL DEFAULT true;

-- 2. Behaviour-preserving backfill: open up bindings that have no group of any
--    kind. Join-table orientation (from 20260628192443_form_access_control):
--      _FormBindingFillRoles : A=Role,             B=StageFormBinding
--      _FormBindingFillUsers : A=StageFormBinding, B=User
--      _FormBindingViewRoles : A=Role,             B=StageFormBinding
--      _FormBindingViewUsers : A=StageFormBinding, B=User
UPDATE "StageFormBinding" b
SET "isRestricted" = false
WHERE NOT EXISTS (SELECT 1 FROM "_FormBindingFillRoles" x WHERE x."B" = b."id")
  AND NOT EXISTS (SELECT 1 FROM "_FormBindingFillUsers" x WHERE x."A" = b."id")
  AND NOT EXISTS (SELECT 1 FROM "_FormBindingViewRoles" x WHERE x."B" = b."id")
  AND NOT EXISTS (SELECT 1 FROM "_FormBindingViewUsers" x WHERE x."A" = b."id");
