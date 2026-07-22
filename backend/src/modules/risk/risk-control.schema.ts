/**
 * Zod request schemas for Risk Management phases 3 & 4 — risk controls,
 * periodic reviews, formal residual-risk acceptance and the hazard / control
 * libraries. Follows the module convention: every schema has a matching
 * inferred type (see risk.schema.ts).
 */
import { z } from 'zod';

export const ControlIdParamSchema = z.object({ id: z.string().uuid() });
export type ControlIdParam = z.infer<typeof ControlIdParamSchema>;

const CONTROL_TYPES = ['PREVENTIVE', 'DETECTIVE', 'MITIGATING', 'CORRECTIVE'] as const;
const CONTROL_HIERARCHIES = [
  'ELIMINATION',
  'SUBSTITUTION',
  'ENGINEERING',
  'ADMINISTRATIVE',
  'PPE',
  'INHERENT_SAFETY',
  'PROTECTIVE_MEASURE',
  'INFORMATION_FOR_SAFETY',
] as const;
const CONTROL_STATUSES = [
  'PLANNED',
  'IN_PROGRESS',
  'IMPLEMENTED',
  'VERIFIED',
  'INEFFECTIVE',
  'CANCELLED',
] as const;
const REVIEW_OUTCOMES = ['NO_CHANGE', 'RESCORED', 'CONTROLS_ADDED', 'ESCALATED', 'CLOSED'] as const;
// HazardLibraryItem.type is a plain string column so a tenant can extend the
// taxonomy; the API still constrains it to the documented set.
const HAZARD_TYPES = ['HAZARD', 'CAUSE', 'CONSEQUENCE', 'FAILURE_MODE', 'THREAT'] as const;

// ── Controls ────────────────────────────────────────────────────────────────

export const ControlCreateSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional().nullable(),
  type: z.enum(CONTROL_TYPES).default('PREVENTIVE'),
  hierarchy: z.enum(CONTROL_HIERARCHIES).optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  // Execution is delegated to an existing QMS object; these are plain ids
  // validated in-service against the owning module.
  capaId: z.string().uuid().optional().nullable(),
  actionItemId: z.string().uuid().optional().nullable(),
  documentId: z.string().uuid().optional().nullable(),
  lmsCourseId: z.string().uuid().optional().nullable(),
  libraryItemId: z.string().uuid().optional().nullable(),
});
export type ControlCreate = z.infer<typeof ControlCreateSchema>;

export const ControlUpdateSchema = ControlCreateSchema.partial();
export type ControlUpdate = z.infer<typeof ControlUpdateSchema>;

export const ControlStatusSchema = z.object({
  status: z.enum(CONTROL_STATUSES),
  reason: z.string().max(1000).optional().nullable(),
});
export type ControlStatusUpdate = z.infer<typeof ControlStatusSchema>;

export const VerifyControlSchema = z.object({
  isEffective: z.boolean(),
  effectiveness: z.string().min(1, 'Describe the effectiveness evidence').max(4000),
  verifiedAt: z.coerce.date().optional().nullable(),
});
export type VerifyControl = z.infer<typeof VerifyControlSchema>;

export const ListControlQuerySchema = z.object({
  search: z.string().max(200).optional(),
  riskId: z.string().uuid().optional(),
  registerId: z.string().uuid().optional(),
  status: z.enum(CONTROL_STATUSES).optional(),
  type: z.enum(CONTROL_TYPES).optional(),
  hierarchy: z.enum(CONTROL_HIERARCHIES).optional(),
  ownerId: z.string().uuid().optional(),
  overdue: z.coerce.boolean().optional(),
  dueBefore: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  sortBy: z.enum(['createdAt', 'dueDate', 'status', 'controlNumber']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export type ListControlQuery = z.infer<typeof ListControlQuerySchema>;

// ── Periodic reviews ────────────────────────────────────────────────────────

export const ReviewCreateSchema = z.object({
  dueAt: z.coerce.date(),
  findings: z.string().max(4000).optional().nullable(),
});
export type ReviewCreate = z.infer<typeof ReviewCreateSchema>;

export const CompleteReviewSchema = z.object({
  outcome: z.enum(REVIEW_OUTCOMES),
  findings: z.string().min(1, 'Record what the review found').max(4000),
  // Omit to let the framework's level cadence (reviewMonths) decide.
  nextReviewAt: z.coerce.date().optional().nullable(),
});
export type CompleteReview = z.infer<typeof CompleteReviewSchema>;

export const ListReviewQuerySchema = z.object({
  riskId: z.string().uuid().optional(),
  registerId: z.string().uuid().optional(),
  outcome: z.enum(REVIEW_OUTCOMES).optional(),
  overdue: z.coerce.boolean().optional(),
  completed: z.coerce.boolean().optional(),
  dueBefore: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  sortBy: z.enum(['dueAt', 'createdAt', 'reviewedAt']).default('dueAt'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
});
export type ListReviewQuery = z.infer<typeof ListReviewQuerySchema>;

// ── Residual-risk acceptance ────────────────────────────────────────────────

export const AcceptRiskSchema = z.object({
  justification: z.string().min(1, 'A justification is required to accept residual risk').max(4000),
  // ISO 14971 §8 — mandatory when the resolved residual level is UNACCEPTABLE.
  benefitRiskRationale: z.string().max(4000).optional().nullable(),
  // Re-authentication credential for the 21 CFR Part 11 e-signature: the
  // signer's enrolled signature PIN, else their account password.
  credential: z.string().min(1, 'Signature credential is required'),
  meaning: z.string().max(200).optional(),
});
export type AcceptRisk = z.infer<typeof AcceptRiskSchema>;

// ── Libraries ───────────────────────────────────────────────────────────────

export const HazardLibraryUpsertSchema = z.object({
  code: z.string().max(64).optional().nullable(),
  name: z.string().min(1).max(300),
  type: z.enum(HAZARD_TYPES).default('HAZARD'),
  description: z.string().max(4000).optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  defaultSeverityRank: z.number().int().min(1).max(100).optional().nullable(),
  tags: z.array(z.string().max(64)).max(50).optional().nullable(),
  isActive: z.boolean().default(true),
});
export type HazardLibraryUpsert = z.infer<typeof HazardLibraryUpsertSchema>;

export const ControlLibraryUpsertSchema = z.object({
  code: z.string().max(64).optional().nullable(),
  name: z.string().min(1).max(300),
  type: z.enum(CONTROL_TYPES).default('PREVENTIVE'),
  hierarchy: z.enum(CONTROL_HIERARCHIES).optional().nullable(),
  description: z.string().max(4000).optional().nullable(),
  effectivenessRank: z.number().int().min(1).max(100).optional().nullable(),
  isActive: z.boolean().default(true),
});
export type ControlLibraryUpsert = z.infer<typeof ControlLibraryUpsertSchema>;

export const ListHazardLibraryQuerySchema = z.object({
  search: z.string().max(200).optional(),
  type: z.enum(HAZARD_TYPES).optional(),
  categoryId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListHazardLibraryQuery = z.infer<typeof ListHazardLibraryQuerySchema>;

export const ListControlLibraryQuerySchema = z.object({
  search: z.string().max(200).optional(),
  type: z.enum(CONTROL_TYPES).optional(),
  hierarchy: z.enum(CONTROL_HIERARCHIES).optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListControlLibraryQuery = z.infer<typeof ListControlLibraryQuerySchema>;
