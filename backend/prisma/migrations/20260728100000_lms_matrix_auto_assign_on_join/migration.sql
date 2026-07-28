-- Training matrix: per-rule "auto-assign on join" flag.
--
-- When set, the rule fires as soon as a user enters its target (role, department,
-- site or job function) instead of waiting for the next manual matrix sync.
--
-- Defaults to FALSE on purpose. Enrollments are append-only through the API today
-- (no unassign / delete / waive endpoint), so arming a rule is effectively one-way
-- and must be a deliberate act — defaulting to true would silently arm every
-- existing rule at migration time.

ALTER TABLE "LmsTrainingMatrixRule"
    ADD COLUMN "autoAssignOnJoin" BOOLEAN NOT NULL DEFAULT false;
