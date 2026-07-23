/**
 * Zod request schemas for risk assessments and their FMEA / matrix worksheets.
 *
 * The one rule this file enforces at the edge: a client may send factor *ranks*
 * and nothing else. There is deliberately no `score`, `level` or `actionPriority`
 * field on any body schema — those are computed server-side by
 * risk-scoring.service and would be untrustworthy coming from the wire.
 */
import { z } from 'zod';

const METHODOLOGIES = ['MATRIX', 'FMEA', 'FMECA', 'HACCP', 'HAZOP', 'PHA', 'FTA', 'BOWTIE', 'CUSTOM'] as const;

export const ASSESSMENT_STATUSES = [
  'DRAFT',
  'IN_ASSESSMENT',
  'PENDING_REVIEW',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'PERIODIC_REVIEW',
  'SUPERSEDED',
  'CLOSED',
  'CANCELLED',
] as const;

/** Ranks only — never a score. Bounded to the range a sane ordinal scale uses. */
const FactorValuesSchema = z.record(z.number().int().min(1).max(100));

const TeamMemberSchema = z.object({
  id: z.string().max(64),
  name: z.string().max(200),
  role: z.string().max(120).optional().nullable(),
});

// ── Assessments ─────────────────────────────────────────────────────────────

export const AssessmentCreateSchema = z.object({
  title: z.string().min(1).max(300),
  objective: z.string().max(5000).optional().nullable(),
  scopeText: z.string().max(5000).optional().nullable(),
  // Omitted -> inherited from the resolved framework's methodology.
  methodology: z.enum(METHODOLOGIES).optional().nullable(),
  registerId: z.string().uuid().optional().nullable(),
  // Omitted -> the register's framework, else the organisation default.
  frameworkId: z.string().uuid().optional().nullable(),
  teamMembers: z.array(TeamMemberSchema).max(100).optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  siteId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  startedAt: z.coerce.date().optional().nullable(),
  conclusion: z.string().max(10000).optional().nullable(),
  nextReviewAt: z.coerce.date().optional().nullable(),
  triggerType: z.string().max(64).optional().nullable(),
  triggerId: z.string().max(64).optional().nullable(),
  workflowId: z.string().uuid().optional().nullable(),
  workflowTicketId: z.string().max(64).optional().nullable(),
  workflowTicketUniqueId: z.string().max(64).optional().nullable(),
});
export type AssessmentCreate = z.infer<typeof AssessmentCreateSchema>;

// The framework is frozen once lines are scored against it, so it is not part of
// the editable surface — revise to a new version to change methodology.
export const AssessmentUpdateSchema = AssessmentCreateSchema.omit({ frameworkId: true }).partial();
export type AssessmentUpdate = z.infer<typeof AssessmentUpdateSchema>;

export const ListAssessmentQuerySchema = z.object({
  search: z.string().max(200).optional(),
  status: z.enum(ASSESSMENT_STATUSES).optional(),
  methodology: z.enum(METHODOLOGIES).optional(),
  registerId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  frameworkId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  sortBy: z.enum(['createdAt', 'updatedAt', 'assessmentNumber', 'nextReviewAt', 'approvedAt']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export type ListAssessmentQuery = z.infer<typeof ListAssessmentQuerySchema>;

export const UpdateAssessmentStatusSchema = z.object({
  status: z.enum(ASSESSMENT_STATUSES),
  reason: z.string().max(1000).optional().nullable(),
});
export type UpdateAssessmentStatus = z.infer<typeof UpdateAssessmentStatusSchema>;

/**
 * Approval body. `password` is the signature credential (the enrolled signature
 * PIN if the account has one, otherwise the login password) — recordSignature
 * re-authenticates with it, which is the whole point of a Part 11 signature.
 */
export const ApproveAssessmentSchema = z.object({
  password: z.string().min(1).max(200),
  meaning: z.string().min(1).max(200).default('Approved risk assessment'),
  reason: z.string().max(1000).optional().nullable(),
  conclusion: z.string().max(10000).optional().nullable(),
  nextReviewAt: z.coerce.date().optional().nullable(),
});
export type ApproveAssessment = z.infer<typeof ApproveAssessmentSchema>;

export const RejectAssessmentSchema = z.object({
  reason: z.string().min(1, 'A rejection reason is required').max(2000),
});
export type RejectAssessment = z.infer<typeof RejectAssessmentSchema>;

export const ReviseAssessmentSchema = z.object({
  reason: z.string().max(1000).optional().nullable(),
  title: z.string().min(1).max(300).optional().nullable(),
});
export type ReviseAssessment = z.infer<typeof ReviseAssessmentSchema>;

// ── Worksheet lines ─────────────────────────────────────────────────────────

const LineFieldsSchema = z.object({
  // FMEA columns
  itemFunction: z.string().max(1000).optional().nullable(),
  failureMode: z.string().max(1000).optional().nullable(),
  effect: z.string().max(2000).optional().nullable(),
  cause: z.string().max(2000).optional().nullable(),
  currentControls: z.string().max(2000).optional().nullable(),
  // Matrix / ISO 14971 columns
  hazard: z.string().max(1000).optional().nullable(),
  consequence: z.string().max(2000).optional().nullable(),

  // Ranks only. A partially filled map is allowed (a worksheet in progress);
  // the score stays null until every factor of the framework has a rank.
  initialFactors: FactorValuesSchema.optional().nullable(),
  residualFactors: FactorValuesSchema.optional().nullable(),

  recommendedAction: z.string().max(2000).optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  isCritical: z.boolean().default(false),
  notes: z.string().max(5000).optional().nullable(),
});

export const LineUpsertSchema = LineFieldsSchema.extend({
  lineNumber: z.number().int().min(1).max(100000).optional().nullable(),
});
export type LineUpsert = z.infer<typeof LineUpsertSchema>;

/** A bulk row carries its own id when it maps to an existing line. */
const BulkLineSchema = LineFieldsSchema.extend({
  id: z.string().uuid().optional().nullable(),
  lineNumber: z.number().int().min(1).max(100000).optional().nullable(),
});

export const BulkLinesSchema = z.object({
  lines: z.array(BulkLineSchema).max(1000, 'A worksheet save is capped at 1000 rows'),
  // true  -> the payload is the complete worksheet; rows omitted are deleted.
  // false -> upsert only; existing rows not in the payload are left alone.
  replace: z.boolean().default(true),
  reason: z.string().max(1000).optional().nullable(),
});
export type BulkLines = z.infer<typeof BulkLinesSchema>;

export const ListLineQuerySchema = z.object({
  search: z.string().max(200).optional(),
  isCritical: z.coerce.boolean().optional(),
  promoted: z.coerce.boolean().optional(),
});
export type ListLineQuery = z.infer<typeof ListLineQuerySchema>;

export const PromoteLineSchema = z.object({
  // Defaults to the assessment's register; required when it has none.
  registerId: z.string().uuid().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(300).optional().nullable(),
  reason: z.string().max(1000).optional().nullable(),
});
export type PromoteLine = z.infer<typeof PromoteLineSchema>;
