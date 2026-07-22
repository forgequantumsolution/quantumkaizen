/**
 * Zod request schemas for the Risk Management module. Every exported schema has
 * a matching inferred type, following the module convention (see audit.schema.ts).
 */
import { z } from 'zod';

export const IdParamSchema = z.object({ id: z.string().uuid() });
export type IdParam = z.infer<typeof IdParamSchema>;

const METHODOLOGIES = ['MATRIX', 'FMEA', 'FMECA', 'HACCP', 'HAZOP', 'PHA', 'FTA', 'BOWTIE', 'CUSTOM'] as const;
const FORMULAS = ['PRODUCT', 'SUM', 'WEIGHTED_PRODUCT', 'MATRIX_LOOKUP', 'ACTION_PRIORITY'] as const;
const FACTOR_KINDS = ['SEVERITY', 'OCCURRENCE', 'PROBABILITY', 'DETECTABILITY', 'EXPOSURE', 'CUSTOM'] as const;
const ACCEPTANCE = ['ACCEPTABLE', 'ALARP', 'UNACCEPTABLE'] as const;
const REGISTER_SCOPES = ['SITE', 'PRODUCT', 'PROCESS', 'PROJECT', 'SUPPLIER', 'EQUIPMENT', 'SYSTEM', 'ENTERPRISE'] as const;
const RISK_STATUSES = [
  'IDENTIFIED', 'UNDER_ASSESSMENT', 'TREATMENT_PLANNED', 'TREATMENT_IN_PROGRESS',
  'RESIDUAL_ASSESSED', 'ACCEPTED', 'MONITORED', 'CLOSED', 'REOPENED', 'ESCALATED',
] as const;
const TREATMENTS = ['AVOID', 'REDUCE', 'TRANSFER', 'ACCEPT'] as const;
const SCORE_STAGES = ['INITIAL', 'RESIDUAL', 'TARGET', 'REVIEW'] as const;

// ── Frameworks ──────────────────────────────────────────────────────────────

const FactorLevelSchema = z.object({
  rank: z.number().int().min(1).max(100),
  label: z.string().min(1).max(120),
  definition: z.string().max(2000).optional().nullable(),
  guidance: z.string().max(2000).optional().nullable(),
  color: z.string().max(32).optional().nullable(),
});

const FactorSchema = z.object({
  kind: z.enum(FACTOR_KINDS).default('CUSTOM'),
  key: z.string().min(1).max(16).regex(/^[A-Za-z0-9_]+$/, 'Factor key must be alphanumeric'),
  label: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  weight: z.number().min(0.01).max(10).default(1),
  order: z.number().int().min(0).default(0),
  levels: z.array(FactorLevelSchema).min(2, 'A factor needs at least two levels'),
});

const LevelDefSchema = z.object({
  code: z.string().min(1).max(40),
  label: z.string().min(1).max(120),
  color: z.string().max(32).default('#64748B'),
  order: z.number().int().min(0).default(0),
  minScore: z.number().int().optional().nullable(),
  maxScore: z.number().int().optional().nullable(),
  acceptance: z.enum(ACCEPTANCE).default('ALARP'),
  requiresCapa: z.boolean().default(false),
  requiresApproval: z.boolean().default(false),
  requiresControl: z.boolean().default(false),
  reviewMonths: z.number().int().min(1).max(120).optional().nullable(),
  escalateToRoleId: z.string().uuid().optional().nullable(),
});

const MatrixCellSchema = z.object({
  rowFactorKey: z.string().min(1).max(16),
  rowRank: z.number().int().min(1),
  colFactorKey: z.string().min(1).max(16),
  colRank: z.number().int().min(1),
  score: z.number().int().optional().nullable(),
  levelCode: z.string().min(1).max(40),
});

export const FrameworkUpsertSchema = z
  .object({
    code: z.string().max(64).optional().nullable(),
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional().nullable(),
    standard: z.string().max(120).optional().nullable(),
    methodology: z.enum(METHODOLOGIES).default('MATRIX'),
    formula: z.enum(FORMULAS).default('PRODUCT'),
    isActive: z.boolean().default(true),
    isDefault: z.boolean().default(false),
    terminology: z.record(z.string()).optional().nullable(),
    fieldConfig: z.record(z.unknown()).optional().nullable(),
    siteId: z.string().uuid().optional().nullable(),
    factors: z.array(FactorSchema).min(1, 'A framework needs at least one factor'),
    levels: z.array(LevelDefSchema).min(1, 'A framework needs at least one risk level'),
    matrixCells: z.array(MatrixCellSchema).optional().default([]),
  })
  .superRefine((val, ctx) => {
    const factorKeys = new Set<string>();
    for (const f of val.factors) {
      if (factorKeys.has(f.key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['factors'], message: `Duplicate factor key "${f.key}"` });
      }
      factorKeys.add(f.key);
      const ranks = new Set<number>();
      for (const l of f.levels) {
        if (ranks.has(l.rank)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['factors'], message: `Duplicate rank ${l.rank} on factor "${f.key}"` });
        }
        ranks.add(l.rank);
      }
    }

    const levelCodes = new Set(val.levels.map((l) => l.code));
    if (levelCodes.size !== val.levels.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['levels'], message: 'Duplicate risk level code' });
    }

    if (val.formula === 'MATRIX_LOOKUP') {
      if (val.factors.length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['factors'], message: 'MATRIX_LOOKUP needs at least two factors' });
      }
      if (!val.matrixCells || val.matrixCells.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['matrixCells'], message: 'MATRIX_LOOKUP requires matrix cells' });
      }
      for (const cell of val.matrixCells ?? []) {
        if (!levelCodes.has(cell.levelCode)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['matrixCells'], message: `Cell references unknown level "${cell.levelCode}"` });
        }
        if (!factorKeys.has(cell.rowFactorKey) || !factorKeys.has(cell.colFactorKey)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['matrixCells'], message: 'Cell references an unknown factor key' });
        }
      }
    } else {
      // Band-based formulas must be able to classify every score they can produce.
      const unbanded = val.levels.filter((l) => l.minScore === null || l.minScore === undefined);
      if (unbanded.length === val.levels.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['levels'],
          message: 'Non-matrix frameworks need minScore/maxScore bands so a score can resolve to a level',
        });
      }
    }

    if (val.formula === 'ACTION_PRIORITY') {
      for (const required of ['S', 'O', 'D']) {
        if (!factorKeys.has(required)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['factors'], message: `ACTION_PRIORITY requires a factor keyed "${required}"` });
        }
      }
    }
  });
export type FrameworkUpsert = z.infer<typeof FrameworkUpsertSchema>;

export const ListFrameworkQuerySchema = z.object({
  search: z.string().max(200).optional(),
  methodology: z.enum(METHODOLOGIES).optional(),
  isActive: z.coerce.boolean().optional(),
  siteId: z.string().uuid().optional(),
});
export type ListFrameworkQuery = z.infer<typeof ListFrameworkQuerySchema>;

// ── Categories ──────────────────────────────────────────────────────────────

export const CategoryUpsertSchema = z.object({
  code: z.string().max(64).optional().nullable(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  color: z.string().max(32).optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().default(true),
});
export type CategoryUpsert = z.infer<typeof CategoryUpsertSchema>;

export const ListCategoryQuerySchema = z.object({
  search: z.string().max(200).optional(),
  isActive: z.coerce.boolean().optional(),
});
export type ListCategoryQuery = z.infer<typeof ListCategoryQuerySchema>;

// ── Registers ───────────────────────────────────────────────────────────────

export const RegisterUpsertSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  scope: z.enum(REGISTER_SCOPES).default('SITE'),
  scopeRef: z
    .object({
      entityType: z.string().max(64),
      entityId: z.string().max(64),
      label: z.string().max(200).optional(),
    })
    .optional()
    .nullable(),
  frameworkId: z.string().uuid().optional().nullable(),
  siteId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().default(true),
});
export type RegisterUpsert = z.infer<typeof RegisterUpsertSchema>;

export const ListRegisterQuerySchema = z.object({
  search: z.string().max(200).optional(),
  scope: z.enum(REGISTER_SCOPES).optional(),
  siteId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});
export type ListRegisterQuery = z.infer<typeof ListRegisterQuerySchema>;

// ── Risks ───────────────────────────────────────────────────────────────────

const FactorValuesSchema = z.record(z.number().int().min(1).max(100));

export const RiskCreateSchema = z.object({
  registerId: z.string().uuid(),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  frameworkId: z.string().uuid().optional().nullable(),
  hazard: z.string().max(1000).optional().nullable(),
  hazardousSituation: z.string().max(1000).optional().nullable(),
  harm: z.string().max(1000).optional().nullable(),
  cause: z.string().max(2000).optional().nullable(),
  consequence: z.string().max(2000).optional().nullable(),
  treatment: z.enum(TREATMENTS).optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  siteId: z.string().uuid().optional().nullable(),
  // Optional initial scoring at creation time — scored server-side.
  initialFactors: FactorValuesSchema.optional().nullable(),
});
export type RiskCreate = z.infer<typeof RiskCreateSchema>;

export const RiskUpdateSchema = RiskCreateSchema.partial().omit({ registerId: true, initialFactors: true });
export type RiskUpdate = z.infer<typeof RiskUpdateSchema>;

export const ScoreRiskSchema = z.object({
  stage: z.enum(SCORE_STAGES),
  factors: FactorValuesSchema,
  reason: z.string().max(1000).optional().nullable(),
});
export type ScoreRisk = z.infer<typeof ScoreRiskSchema>;

export const UpdateRiskStatusSchema = z.object({
  status: z.enum(RISK_STATUSES),
  reason: z.string().max(1000).optional().nullable(),
});
export type UpdateRiskStatus = z.infer<typeof UpdateRiskStatusSchema>;

export const ListRiskQuerySchema = z.object({
  search: z.string().max(200).optional(),
  registerId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(RISK_STATUSES).optional(),
  ownerId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  levelCode: z.string().max(40).optional(),
  overdueReview: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  sortBy: z.enum(['createdAt', 'residualScore', 'initialScore', 'nextReviewAt', 'riskNumber']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export type ListRiskQuery = z.infer<typeof ListRiskQuerySchema>;

export const LinkUpsertSchema = z.object({
  entityType: z.string().min(1).max(64),
  entityId: z.string().min(1).max(64),
  label: z.string().max(300).optional().nullable(),
  relation: z.string().max(64).optional().nullable(),
});
export type LinkUpsert = z.infer<typeof LinkUpsertSchema>;

export const HeatmapQuerySchema = z.object({
  registerId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  frameworkId: z.string().uuid().optional(),
  stage: z.enum(['INITIAL', 'RESIDUAL']).default('RESIDUAL'),
});
export type HeatmapQuery = z.infer<typeof HeatmapQuerySchema>;
