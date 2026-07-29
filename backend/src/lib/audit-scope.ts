import type { AuditModule } from './audit';

/**
 * Which models the automatic audit interceptor covers, and how each one is
 * classified. Coverage is decided here, in one reviewable list, rather than
 * being an emergent property of ~400 scattered call sites.
 *
 * Three dispositions:
 *   AUTO     — the interceptor writes CREATE/UPDATE/DELETE entries.
 *   MANUAL   — the module already writes richer, semantic entries by hand;
 *              auto-capture is suppressed so a single change is not recorded
 *              twice under two different shapes.
 *   EXCLUDED — deliberately not audited. Every entry here needs a stated
 *              reason: an inspector is entitled to ask why a table is silent,
 *              and "nobody thought about it" is not an answer.
 */

/** Not audited, with the justification that has to survive an audit question. */
export const EXCLUDED_MODELS: Record<string, string> = {
  // Auditing the audit trail would recurse infinitely; these tables are
  // protected by append-only DB triggers and the hash chain instead.
  AuditTrailEntry: 'audit infrastructure — protected by append-only triggers + hash chain',
  ESignature: 'audit infrastructure — protected by append-only triggers',
  AuditTrailReview: 'audit infrastructure — protected by append-only triggers',
  AuditChainCheckpoint: 'audit infrastructure — integrity verification output',

  // Not records: autosave scratch space that the user has not committed. The
  // committed FormSubmission is audited.
  FormDraft: 'unsubmitted autosave scratch — the resulting FormSubmission is audited',

  // Machine-generated clock state, rewritten continuously by the SLA sweep.
  // Auditing it would bury human actions under timer ticks. The human
  // decisions (SlaExtension, SlaPolicy) are audited.
  SlaTimer: 'machine clock state — high-frequency sweep writes; SlaExtension/SlaPolicy are audited',
  SlaTimerEvent: 'machine clock state — derived from SlaTimer',

  // Superseded by a richer hand-written entry that renders the whole
  // permission set as a before/after diff (user.service.ts, department.service.ts).
  UserPermission: 'covered by the permission-diff entry written in user.service.ts',
};

/**
 * Models whose services already write semantic entries. Auto-capture of
 * CREATE/UPDATE/DELETE is suppressed to avoid double-recording; these modules
 * migrate to the interceptor one at a time, by deleting their manual calls and
 * removing the model from this list.
 */
export const MANUALLY_AUDITED_MODELS = new Set([
  'Analyte', 'AuditRegister', 'Capa', 'Certification', 'Coa', 'CoaTemplate',
  'ControlLibraryItem', 'Customer', 'Document', 'Equipment', 'HazardLibraryItem',
  'Lab', 'LmsAssessmentAttempt', 'LmsCourse', 'LmsCurriculum', 'LmsEnrollment',
  'LmsTrainingMatrixRule', 'OosInvestigation', 'Product', 'QcMaterial', 'QcResult',
  'Risk', 'RiskAssessment', 'RiskAssessmentLine', 'RiskCategory', 'RiskControl',
  'RiskFramework', 'RiskRegister', 'RiskReview', 'Sample', 'SampleTest',
  'SamplingPoint', 'SpecVersion', 'Specification', 'StabilityStudy',
  'StorageLocation', 'Supplier', 'TestDefinition', 'TestMethod', 'TestPanel',
  'TrainingItem', 'UnitOfMeasure', 'Worklist',
]);

/**
 * Configuration and security models. A change here alters how every future
 * record behaves, or who can act on it, so entries are flagged CRITICAL and
 * surface in the periodic review by default.
 */
const CRITICAL_MODELS = new Set([
  'Workflow', 'WorkflowStage', 'WorkflowStageAction', 'WorkflowTransition',
  'WorkflowType', 'WorkflowStageStatus', 'TemporaryWorkflow', 'StageFormBinding',
  'ApprovalPolicy', 'SlaPolicy', 'SlaThreshold', 'BusinessCalendar',
  'Form', 'FormSection', 'FormField', 'FormType', 'FieldType',
  'Role', 'Permission', 'UserPermission', 'User', 'Site', 'Organization',
  'Department', 'ActionType', 'ActionCriteria', 'Priority', 'Severity',
  'IsoStandard', 'IsoClause', 'IsoSubClause', 'AuditMaster', 'AuditScheduleRule',
  'SpecVersion', 'Specification', 'TestMethod', 'CoaTemplate',
]);

/** Prefix rules, longest match first. */
const MODULE_PREFIXES: Array<[string, AuditModule]> = [
  ['Lms', 'LMS'],
  ['Risk', 'QMS'],
  ['Workflow', 'WORKFLOW'],
  ['Ticket', 'WORKFLOW'],
  ['Form', 'WORKFLOW'],
  ['Stage', 'WORKFLOW'],
  ['Approval', 'WORKFLOW'],
  ['Sla', 'WORKFLOW'],
  ['Document', 'DMS'],
  ['Audit', 'QMS'],
  ['Iso', 'QMS'],
  ['Spec', 'LIMS'],
  ['Test', 'LIMS'],
  ['Sample', 'LIMS'],
  ['Qc', 'LIMS'],
  ['Coa', 'LIMS'],
  ['Stability', 'LIMS'],
];

const MODULE_OVERRIDES: Record<string, AuditModule> = {
  User: 'ADMIN', Role: 'ADMIN', Permission: 'ADMIN', UserPermission: 'ADMIN',
  Site: 'ADMIN', Organization: 'ADMIN', Department: 'ADMIN', BusinessCalendar: 'ADMIN',
  NavGroup: 'ADMIN', NavGroupModule: 'ADMIN',
  FieldType: 'WORKFLOW', ActionType: 'WORKFLOW', ActionCriteria: 'WORKFLOW',
  Priority: 'WORKFLOW', Severity: 'WORKFLOW', ChildWorkflowTrigger: 'WORKFLOW',
  ParallelBranchTracking: 'WORKFLOW',
  Capa: 'QMS', NonConformance: 'QMS', Finding: 'QMS', ActionItem: 'QMS',
  TrainingItem: 'LMS', TrainingAssignment: 'LMS',
  Lab: 'LIMS', Equipment: 'LIMS', CalibrationRecord: 'LIMS', Certification: 'LIMS',
  StorageLocation: 'LIMS', Aliquot: 'LIMS', CustodyEvent: 'LIMS', Result: 'LIMS',
  Worklist: 'LIMS', OosInvestigation: 'LIMS', Product: 'LIMS', Analyte: 'LIMS',
  UnitOfMeasure: 'LIMS', SamplingPoint: 'LIMS', Customer: 'LIMS', Supplier: 'LIMS',
  HazardLibraryItem: 'QMS', ControlLibraryItem: 'QMS',
};

export const moduleFor = (model: string): AuditModule => {
  const override = MODULE_OVERRIDES[model];
  if (override) return override;
  for (const [prefix, mod] of MODULE_PREFIXES) {
    if (model.startsWith(prefix)) return mod;
  }
  return 'QMS';
};

export const criticalityFor = (model: string): 'NORMAL' | 'CRITICAL' =>
  CRITICAL_MODELS.has(model) ? 'CRITICAL' : 'NORMAL';

/** True when the automatic interceptor should write entries for this model. */
export const isAutoAudited = (model: string): boolean =>
  !(model in EXCLUDED_MODELS) && !MANUALLY_AUDITED_MODELS.has(model);

/**
 * Never written to the trail, on any model. Credentials must not be recoverable
 * from audit records — not even as a hash, and not even as a before-image.
 */
export const REDACTED_FIELDS = new Set([
  'passwordHash', 'signaturePinHash', 'password', 'credential', 'token',
  'refreshToken', 'secret', 'apiKey',
]);

/** Volatile bookkeeping columns — noise, not evidence of a human decision. */
export const IGNORED_FIELDS = new Set([
  'updatedAt', 'createdAt', 'lastLoginAt', 'searchVector',
]);

/** Candidate columns for the human-readable label, in preference order. */
const LABEL_FIELDS = [
  'ticketNumber', 'docNumber', 'code', 'name', 'title', 'label', 'email',
  'versionLabel', 'key', 'sampleCode', 'batchNumber',
];

export const labelFor = (row: Record<string, unknown> | null | undefined): string | null => {
  if (!row) return null;
  for (const f of LABEL_FIELDS) {
    const v = row[f];
    if (typeof v === 'string' && v.trim()) return v.slice(0, 200);
  }
  return null;
};
