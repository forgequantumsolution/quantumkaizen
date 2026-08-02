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
  workflow_id: z.string().optional().nullable(),
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
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(20),
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

// =====================================================================
// CAPA (first-class) + Action Item schemas
// =====================================================================

const CAPA_TYPES = ['CORRECTIVE', 'PREVENTIVE', 'BOTH'] as const;
const CAPA_STATUSES = [
  'OPEN',
  'INVESTIGATION',
  'PLAN',
  'IMPLEMENTATION',
  'VERIFICATION',
  'CLOSED',
  'CANCELLED',
] as const;
const ACTION_ITEM_STATUSES = ['OPEN', 'IN_PROGRESS', 'DONE', 'VERIFIED', 'CANCELLED'] as const;
const ACTION_ITEM_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export const CapaTypeEnum = z.enum(CAPA_TYPES);
export const CapaStatusEnum = z.enum(CAPA_STATUSES);
export const ActionItemStatusEnum = z.enum(ACTION_ITEM_STATUSES);
export const ActionItemPriorityEnum = z.enum(ACTION_ITEM_PRIORITIES);

// ── CAPA ──
export const CapaSourceEnum = z.enum(['AUDIT', 'FINDING', 'RISK', 'OOS', 'CALIBRATION', 'MANUAL']);

export const CapaCreateSchema = z.object({
  /** Which module raised this. Inferred from the origin links when omitted. */
  source: CapaSourceEnum.optional(),
  /** Human reference of the originating record — RISK-2026-0007, OOS-24. */
  source_ref: z.string().max(80).optional().nullable(),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional().nullable(),
  type: CapaTypeEnum.default('CORRECTIVE'),
  // Origin NC — when set, the CAPA is linked and the NC is moved to CAPA_RAISED.
  non_conformance_id: z.string().optional().nullable(),
  // Origin finding (generic non-audit modules) — links Capa.findingId.
  finding_id: z.string().optional().nullable(),
  // When raised from a finding, the source module ticket to nest this CAPA's
  // spawned workflow ticket under (Ticket.parentTicketId).
  parent_ticket_id: z.string().optional().nullable(),
  owner_id: z.string().optional().nullable(),
  department_id: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
});

export const CapaUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).optional().nullable(),
  type: CapaTypeEnum.optional(),
  root_cause: z.string().max(4000).optional().nullable(),
  root_cause_data: z.unknown().optional().nullable(),
  corrective_action: z.string().max(4000).optional().nullable(),
  preventive_action: z.string().max(4000).optional().nullable(),
  owner_id: z.string().optional().nullable(),
  department_id: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  effectiveness_check: z.string().max(4000).optional().nullable(),
  effectiveness_due: z.string().optional().nullable(),
  // Structured 30/60/90-day effectiveness check-ins (see Capa.effectivenessData).
  effectiveness_data: z.unknown().optional().nullable(),
});

export const UpdateCapaStatusSchema = z.object({
  status: CapaStatusEnum,
});

export const ListCapaQuerySchema = z.object({
  /** Comma-separated origins; omitted means all. */
  source: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(20),
  status: CapaStatusEnum.optional(),
  type: CapaTypeEnum.optional(),
  owner_id: z.string().optional(),
  department_id: z.string().optional(),
  search: z.string().optional(),
});

// ── Action Item ──
export const ActionItemUpsertSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(4000).optional().nullable(),
    status: ActionItemStatusEnum.optional(),
    priority: ActionItemPriorityEnum.default('MEDIUM'),
    owner_id: z.string().optional().nullable(),
    due_date: z.string().optional().nullable(),
    capa_id: z.string().optional().nullable(),
    non_conformance_id: z.string().optional().nullable(),
    finding_id: z.string().optional().nullable(),
  });

export const UpdateActionItemStatusSchema = z.object({
  status: ActionItemStatusEnum,
});

export const ListActionItemQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(20),
  status: ActionItemStatusEnum.optional(),
  priority: ActionItemPriorityEnum.optional(),
  owner_id: z.string().optional(),
  capa_id: z.string().optional(),
  non_conformance_id: z.string().optional(),
  finding_id: z.string().optional(),
  search: z.string().optional(),
});

export type CapaCreateInput = z.infer<typeof CapaCreateSchema>;
export type CapaUpdateInput = z.infer<typeof CapaUpdateSchema>;
export type UpdateCapaStatusInput = z.infer<typeof UpdateCapaStatusSchema>;
export type ListCapaQuery = z.infer<typeof ListCapaQuerySchema>;
export type ActionItemUpsertInput = z.infer<typeof ActionItemUpsertSchema>;
export type UpdateActionItemStatusInput = z.infer<typeof UpdateActionItemStatusSchema>;
export type ListActionItemQuery = z.infer<typeof ListActionItemQuerySchema>;

// =====================================================================
// Audit Schedule Rule (recurrence) schemas
// =====================================================================

export const AuditScheduleRuleUpsertSchema = z.object({
  name: z.string().min(1).max(200),
  audit_master_id: z.string(),
  frequency: AuditFrequencyEnum,
  anchor_date: z.string(),
  lead_time_days: z.coerce.number().int().min(0).max(365).default(14),
  plant: z.string().max(200).optional().nullable(),
  default_auditor_id: z.string().optional().nullable(),
  workflow_id: z.string().optional().nullable(),
  checklist_form_id: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});

export const ListScheduleRuleQuerySchema = z.object({
  is_active: z.coerce.boolean().optional(),
  audit_master_id: z.string().optional(),
});

export const CalendarQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export type AuditScheduleRuleUpsertInput = z.infer<typeof AuditScheduleRuleUpsertSchema>;
export type ListScheduleRuleQuery = z.infer<typeof ListScheduleRuleQuerySchema>;
export type CalendarQuery = z.infer<typeof CalendarQuerySchema>;

// =====================================================================
// Compliance — e-signature
// =====================================================================

export const SignSchema = z.object({
  entity_type: z.string().min(1).max(60),
  entity_id: z.string().min(1),
  meaning: z.string().min(1).max(200),
  credential: z.string().min(1).max(200),
});

export const TrailParamSchema = z.object({
  entityType: z.string().min(1).max(60),
  entityId: z.string().min(1),
});

export type SignSchemaInput = z.infer<typeof SignSchema>;
