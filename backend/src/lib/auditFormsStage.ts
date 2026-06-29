/**
 * Identifies the single workflow stage where an audit's dynamic checklist (the
 * one selected on the linked AuditRegister / master) should auto-appear and be
 * required — typically "Perform Audit". Every OTHER stage shows only the forms a
 * designer manually bound in the workflow builder (real StageFormBindings).
 *
 * Designation, in order of precedence:
 *   1. stageType === 'AUDIT_FORMS'  (explicit, set in the builder)
 *   2. the stage name contains "perform" (e.g. "Perform Audit") — covers
 *      existing workflows authored before the explicit type was available.
 */
export const isAuditFormsStage = (stage: {
  name?: string | null;
  stageType?: string | null;
}): boolean =>
  stage.stageType === 'AUDIT_FORMS' || /\bperform\b/i.test(stage.name ?? '');
