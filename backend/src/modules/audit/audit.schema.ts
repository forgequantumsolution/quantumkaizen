import { z } from 'zod';

const SubClauseSchema = z.object({
  id: z.string().optional(),
  sub_clause_number: z.string(),
  sub_clause_title: z.string(),
  requirement_text: z.string().optional().nullable(),
  position: z.number().int().optional(),
});

const ClauseSchema = z.object({
  id: z.string().optional(),
  clause_number: z.string(),
  clause_title: z.string(),
  position: z.number().int().optional(),
  sub_clauses: z.array(SubClauseSchema).default([]),
});

export const IsoUpsertSchema = z.object({
  name: z.string().min(1).max(200),
  remarks: z.string().max(1000).optional().nullable(),
  is_active: z.boolean().optional(),
  clauses: z.array(ClauseSchema).default([]),
});

export const ListIsoQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().optional(),
  _t: z.string().optional(),
});

const NamedRefSchema = z.object({ id: z.union([z.string(), z.number()]), name: z.string() });

export const AuditScheduleUpsertSchema = z.object({
  title: z.string().min(1).max(200),
  plant: z.string().optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  audit_date: z.string(),
  previous_audit_date: z.string().optional().nullable(),
  financial_year: z.string().optional().nullable(),
  audit_method: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
  locations: z.array(NamedRefSchema).optional(),
  main_processes: z.array(NamedRefSchema).optional(),
  sub_processes: z.array(NamedRefSchema).optional(),
  criteria: z.array(NamedRefSchema).optional(),
  departments: z.array(NamedRefSchema).optional(),
  focus_areas: z.array(NamedRefSchema).optional(),
});

export const ListAuditQuerySchema = z.object({
  title: z.string().optional(),
  location_id: z.string().optional(),
  financial_year: z.string().optional(),
});

export const UpdateAuditDateSchema = z.object({
  audit_date: z.string(),
});

export const IdParamSchema = z.object({ id: z.string() });
export const ScheduleIdParamSchema = z.object({ scheduleId: z.string() });

export type IsoUpsertInput = z.infer<typeof IsoUpsertSchema>;
export type ListIsoQuery = z.infer<typeof ListIsoQuerySchema>;
export type AuditScheduleUpsertInput = z.infer<typeof AuditScheduleUpsertSchema>;
export type ListAuditQuery = z.infer<typeof ListAuditQuerySchema>;
export type UpdateAuditDateInput = z.infer<typeof UpdateAuditDateSchema>;

// =====================================================================
// Audit Register → Program → Finding → Non-Conformance schemas
// =====================================================================

const AUDIT_TYPES = [
  'INTERNAL',
  'EXTERNAL',
  'SUPPLIER',
  'PROCESS',
  'PRODUCT',
  'SYSTEM',
  'COMPLIANCE',
] as const;
const AUDIT_FREQUENCIES = [
  'ONE_TIME',
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'HALF_YEARLY',
  'ANNUAL',
] as const;
const AUDIT_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CLOSED',
  'CANCELLED',
] as const;
const PROGRAM_STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
const FINDING_SEVERITIES = ['OBSERVATION', 'MINOR', 'MAJOR', 'CRITICAL'] as const;
const FINDING_STATUSES = ['OPEN', 'IN_REVIEW', 'ACCEPTED', 'REJECTED', 'CLOSED'] as const;
const NC_STATUSES = [
  'OPEN',
  'CAPA_RAISED',
  'IN_PROGRESS',
  'VERIFICATION',
  'CLOSED',
  'CANCELLED',
] as const;

export const AuditTypeEnum = z.enum(AUDIT_TYPES);
export const AuditFrequencyEnum = z.enum(AUDIT_FREQUENCIES);
export const AuditStatusEnum = z.enum(AUDIT_STATUSES);
export const ProgramStatusEnum = z.enum(PROGRAM_STATUSES);
export const FindingSeverityEnum = z.enum(FINDING_SEVERITIES);
export const FindingStatusEnum = z.enum(FINDING_STATUSES);
export const NCStatusEnum = z.enum(NC_STATUSES);

// ── Audit Master ──
export const AuditMasterUpsertSchema = z.object({
  code: z.string().max(50).optional().nullable(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  audit_type: AuditTypeEnum,
  frequency: AuditFrequencyEnum.default('ANNUAL'),
  default_iso_standard_id: z.string().optional().nullable(),
  // Multiple checklists — snapshot of [{ id, title }].
  checklist_forms: z
    .array(z.object({ id: z.string(), title: z.string() }))
    .optional()
    .default([]),
  scoring_rules: z.unknown().optional().nullable(),
  is_active: z.boolean().optional(),
});

export const ListAuditMasterQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(50),
  audit_type: AuditTypeEnum.optional(),
  is_active: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

// ── Focus Area (lookup master) ──
export const FocusAreaUpsertSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(1000).optional().nullable(),
  is_active: z.boolean().optional(),
});

export const ListFocusAreaQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(50),
  is_active: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

// ── Audit Type (lookup master) ──
export const AuditTypeMasterUpsertSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(1000).optional().nullable(),
  is_active: z.boolean().optional(),
});

export const ListAuditTypeMasterQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(50),
  is_active: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

// ── Audit Register ──
export const AuditRegisterUpsertSchema = z.object({
  title: z.string().min(1).max(200),
  audit_master_id: z.string().optional().nullable(),
  // Free-form: sourced from the configured "Audit Type" master (or an Audit Master template).
  audit_type: z.string().min(1).max(150),
  plant: z.string().optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  planned_date: z.string(),
  previous_audit_date: z.string().optional().nullable(),
  financial_year: z.string().optional().nullable(),
  audit_method: z.string().optional().nullable(),
  iso_standard_id: z.string().optional().nullable(),
  locations: z.array(NamedRefSchema).optional(),
  main_processes: z.array(NamedRefSchema).optional(),
  sub_processes: z.array(NamedRefSchema).optional(),
  criteria: z.array(NamedRefSchema).optional(),
  departments: z.array(NamedRefSchema).optional(),
  focus_areas: z.array(NamedRefSchema).optional(),
  // Audit team members assigned to this register.
  team_members: z.array(NamedRefSchema).optional().default([]),
  // Per-checklist member assignments (multiple members per checklist).
  checklist_assignments: z
    .array(
      z.object({
        checklist_form_id: z.string(),
        checklist_title: z.string(),
        members: z.array(NamedRefSchema).default([]),
      }),
    )
    .optional()
    .default([]),
  checklist_form_id: z.string().optional().nullable(),
  auditor_id: z.string().optional().nullable(),
  approver_id: z.string().optional().nullable(),
});

export const ListAuditRegisterQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(50),
  status: AuditStatusEnum.optional(),
  audit_type: z.string().optional(),
  financial_year: z.string().optional(),
  search: z.string().optional(),
});

export const ApproveAuditRegisterSchema = z.object({
  remarks: z.string().max(2000).optional().nullable(),
});
export const RejectAuditRegisterSchema = z.object({
  reason: z.string().min(1).max(2000),
});

// ── Audit Program ──
export const ListAuditProgramQuerySchema = z.object({
  status: ProgramStatusEnum.optional(),
  financial_year: z.string().optional(),
  search: z.string().optional(),
});

export const StartAuditProgramSchema = z.object({
  notes: z.string().max(2000).optional().nullable(),
});

export const CompleteAuditProgramSchema = z.object({
  summary: z.string().max(4000).optional().nullable(),
  score: z.coerce.number().optional().nullable(),
  checklist_submission_id: z.string().optional().nullable(),
});

// ── Audit Finding ──
export const FindingUpsertSchema = z.object({
  program_id: z.string(),
  severity: FindingSeverityEnum,
  status: FindingStatusEnum.optional(),
  clause_ref: z.string().optional().nullable(),
  iso_sub_clause_id: z.string().optional().nullable(),
  description: z.string().min(1).max(4000),
  evidence: z.unknown().optional().nullable(),
  recommendation: z.string().max(4000).optional().nullable(),
});

export const ListFindingQuerySchema = z.object({
  program_id: z.string().optional(),
  status: FindingStatusEnum.optional(),
  severity: FindingSeverityEnum.optional(),
});

// ── Non-Conformance ──
export const PromoteFindingToNcSchema = z.object({
  track: z.string().max(100).optional().nullable(),
  department_id: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
});

export const ListNcQuerySchema = z.object({
  status: NCStatusEnum.optional(),
  track: z.string().optional(),
  department_id: z.string().optional(),
  severity: FindingSeverityEnum.optional(),
});

export const RaiseCapaSchema = z.object({
  capa_ticket_id: z.string(),
});

export const UpdateNcStatusSchema = z.object({
  status: NCStatusEnum,
  closed_at: z.string().optional().nullable(),
});

export type AuditMasterUpsertInput = z.infer<typeof AuditMasterUpsertSchema>;
export type ListAuditMasterQuery = z.infer<typeof ListAuditMasterQuerySchema>;
export type FocusAreaUpsertInput = z.infer<typeof FocusAreaUpsertSchema>;
export type ListFocusAreaQuery = z.infer<typeof ListFocusAreaQuerySchema>;
export type AuditTypeMasterUpsertInput = z.infer<typeof AuditTypeMasterUpsertSchema>;
export type ListAuditTypeMasterQuery = z.infer<typeof ListAuditTypeMasterQuerySchema>;
export type AuditRegisterUpsertInput = z.infer<typeof AuditRegisterUpsertSchema>;
export type ListAuditRegisterQuery = z.infer<typeof ListAuditRegisterQuerySchema>;
export type ApproveAuditRegisterInput = z.infer<typeof ApproveAuditRegisterSchema>;
export type RejectAuditRegisterInput = z.infer<typeof RejectAuditRegisterSchema>;
export type ListAuditProgramQuery = z.infer<typeof ListAuditProgramQuerySchema>;
export type StartAuditProgramInput = z.infer<typeof StartAuditProgramSchema>;
export type CompleteAuditProgramInput = z.infer<typeof CompleteAuditProgramSchema>;
export type FindingUpsertInput = z.infer<typeof FindingUpsertSchema>;
export type ListFindingQuery = z.infer<typeof ListFindingQuerySchema>;
export type PromoteFindingToNcInput = z.infer<typeof PromoteFindingToNcSchema>;
export type ListNcQuery = z.infer<typeof ListNcQuerySchema>;
export type RaiseCapaInput = z.infer<typeof RaiseCapaSchema>;
export type UpdateNcStatusInput = z.infer<typeof UpdateNcStatusSchema>;
