/**
 * Zod contracts for the Calibration module. One file: every entity here shares
 * the same vocabulary (tolerance types, outcomes, kinds), and splitting it made
 * the enums drift in the LIMS module.
 */
import { z } from 'zod';

// ─────────────────────────── Shared enums ───────────────────────────

export const InstrumentKindEnum = z.enum([
  'LAB_INSTRUMENT',
  'PRODUCTION_GAUGE',
  'MONITORING_DEVICE',
  'REFERENCE_STANDARD',
  'UTILITY',
]);
export const CriticalityEnum = z.enum(['CRITICAL', 'MAJOR', 'MINOR', 'INDICATIVE']);
export const CalibrationStatusEnum = z.enum([
  'CALIBRATED',
  'DUE_SOON',
  'OVERDUE',
  'UNDER_CALIBRATION',
  'LIMITED_USE',
  'OUT_OF_SERVICE',
  'NOT_REQUIRED',
]);
export const QualificationStateEnum = z.enum([
  'NOT_STARTED',
  'IQ',
  'OQ',
  'PQ',
  'QUALIFIED',
  'REQUALIFICATION_DUE',
]);
export const ToleranceTypeEnum = z.enum([
  'ABSOLUTE',
  'PERCENT_OF_READING',
  'PERCENT_OF_SPAN',
  'MPE_MULTIPLE',
]);
export const InUseFrequencyEnum = z.enum(['PER_SHIFT', 'DAILY', 'WEEKLY', 'PER_BATCH', 'MONTHLY']);
export const IntervalTypeEnum = z.enum([
  'DAYS',
  'MONTHS',
  'USAGE_HOURS',
  'USAGE_CYCLES',
  'RISK_MODULATED',
]);
export const IntervalBasisEnum = z.enum(['PERFORMED_DATE', 'PREVIOUS_DUE_DATE']);
export const ProviderTypeEnum = z.enum(['INTERNAL', 'EXTERNAL', 'MANUFACTURER']);
export const EventTypeEnum = z.enum([
  'PERIODIC',
  'INITIAL',
  'AFTER_REPAIR',
  'AFTER_RELOCATION',
  'AD_HOC',
  'VERIFICATION',
]);
export const EventStatusEnum = z.enum([
  'PLANNED',
  'SCHEDULED',
  'IN_PROGRESS',
  'PENDING_REVIEW',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
]);
export const OutcomeEnum = z.enum(['PASS', 'FAIL', 'CONDITIONAL', 'NOT_PERFORMED']);
export const OotWindowEnum = z.enum([
  'SINCE_LAST_CALIBRATION',
  'SINCE_LAST_PASSING_CHECK',
  'FIXED_DAYS',
]);
export const OotStatusEnum = z.enum(['OPEN', 'IMPACT_IN_PROGRESS', 'PENDING_QA_APPROVAL', 'CLOSED']);
export const OotDispositionEnum = z.enum(['NO_IMPACT', 'IMPACT_CONFIRMED', 'INCONCLUSIVE']);
export const MsaTypeEnum = z.enum([
  'GAGE_RR_CROSSED',
  'GAGE_RR_NESTED',
  'BIAS',
  'LINEARITY',
  'STABILITY',
  'ATTRIBUTE_AGREEMENT',
]);
export const PackKeyEnum = z.enum(['PHARMA', 'AUTOMOTIVE', 'FMCG']);

export const IdParamSchema = z.object({ id: z.string().min(1) });
export const TokenParamSchema = z.object({ token: z.string().min(6).max(64) });

const page = {
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(50),
};

const optStr = (max: number) => z.string().max(max).optional().nullable();
const optNum = z.coerce.number().optional().nullable();

// ─────────────────────────── Config & packs ───────────────────────────

export const GetConfigQuerySchema = z.object({ site_id: z.string().optional() });

export const UpdateConfigSchema = z.object({
  site_id: z.string().optional().nullable(),
  industry_pack: z.string().max(40).optional(),
  event_number_prefix: z.string().min(1).max(10).optional(),
  certificate_number_prefix: z.string().min(1).max(10).optional(),
  due_soon_window_days: z.coerce.number().int().min(1).max(365).optional(),
  auto_spawn_lead_days: z.coerce.number().int().min(0).max(365).optional(),
  grace_days: z.coerce.number().int().min(0).max(90).optional(),
  allow_early_calibration: z.boolean().optional(),
  early_window_days: z.coerce.number().int().min(0).max(180).optional(),
  interval_reset_basis: IntervalBasisEnum.optional(),
  block_use_when_overdue: z.boolean().optional(),
  block_use_when_failed: z.boolean().optional(),
  require_competency_to_perform: z.boolean().optional(),
  require_performer_signature: z.boolean().optional(),
  require_reviewer_signature: z.boolean().optional(),
  require_approver_signature: z.boolean().optional(),
  require_reason_for_change: z.boolean().optional(),
  oot_impact_assessment_required: z.boolean().optional(),
  oot_impact_window: OotWindowEnum.optional(),
  oot_auto_spawn: z.array(z.enum(['DEVIATION', 'CAPA', 'RISK'])).max(3).optional(),
  oot_requires_customer_notification: z.boolean().optional(),
  oot_requires_product_hold: z.boolean().optional(),
  enable_msa: z.boolean().optional(),
  enable_in_use_checks: z.boolean().optional(),
  enable_legal_metrology: z.boolean().optional(),
  enable_aiq_groups: z.boolean().optional(),
  enable_usage_intervals: z.boolean().optional(),
});

export const ApplyPackSchema = z.object({
  pack: PackKeyEnum,
  /** merge keeps tenant-authored categories; replace deactivates other packs'. */
  mode: z.enum(['merge', 'replace']).default('merge'),
  site_id: z.string().optional().nullable(),
});

// ─────────────────────────── Categories ───────────────────────────

export const ListCategoriesQuerySchema = z.object({
  ...page,
  kind: InstrumentKindEnum.optional(),
  industry_pack: z.string().optional(),
  is_active: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

export const CategoryUpsertSchema = z.object({
  code: z.string().min(1).max(60).optional(),
  name: z.string().min(1).max(150),
  kind: InstrumentKindEnum.default('LAB_INSTRUMENT'),
  description: optStr(500),
  site_id: optStr(60),
  default_interval_days: z.coerce.number().int().min(1).max(3650).optional().nullable(),
  default_criticality: CriticalityEnum.optional(),
  default_tolerance_type: ToleranceTypeEnum.optional().nullable(),
  default_tolerance_value: optNum,
  requires_msa: z.boolean().optional(),
  requires_in_use_check: z.boolean().optional(),
  in_use_check_frequency: InUseFrequencyEnum.optional().nullable(),
  is_active: z.boolean().optional(),
});

export const PointTemplateUpsertSchema = z.object({
  sequence: z.coerce.number().int().min(1).max(200),
  label: z.string().min(1).max(150),
  nominal_value: optNum,
  nominal_percent_of_span: optNum,
  unit_code: optStr(40),
  tolerance_type: ToleranceTypeEnum.default('ABSOLUTE'),
  tolerance_value: z.coerce.number(),
});

// ─────────────────────────── Instruments ───────────────────────────

export const ListInstrumentsQuerySchema = z.object({
  ...page,
  kind: InstrumentKindEnum.optional(),
  /** Comma-separated, so the registry can show "everything not healthy". */
  calibration_status: z.string().optional(),
  criticality: CriticalityEnum.optional(),
  category_id: z.string().optional(),
  site_id: z.string().optional(),
  department_id: z.string().optional(),
  custodian_id: z.string().optional(),
  /** Instruments due within N days (includes already-overdue). */
  due_within: z.coerce.number().int().min(0).max(3650).optional(),
  include_retired: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

export const InstrumentUpsertSchema = z.object({
  name: z.string().min(1).max(200),
  code: optStr(60),
  kind: InstrumentKindEnum.optional(),
  category_id: optStr(60),
  /** Optional soft link to a LIMS Equipment.id — no FK, module works without it. */
  lims_equipment_id: optStr(60),
  lab_ref: optStr(120),
  site_id: optStr(60),
  department_id: optStr(60),
  custodian_id: optStr(60),
  serial_no: optStr(120),
  manufacturer: optStr(150),
  model: optStr(150),
  location: optStr(200),
  asset_tag: optStr(80),
  criticality: CriticalityEnum.optional(),
  is_calibration_required: z.boolean().optional(),
  exemption_reason: optStr(500),
  measurement_range_min: optNum,
  measurement_range_max: optNum,
  unit_code: optStr(40),
  resolution: optNum,
  accuracy_class: optStr(80),
  mpe: optNum,
  qualification_state: QualificationStateEnum.optional(),
  aiq_group: optStr(4),
  gamp_category: optStr(8),
  received_at: optStr(40),
  warranty_until: optStr(40),
  legal_metrology_stamp_no: optStr(80),
  legal_metrology_valid_until: optStr(40),
});

export const ReasonSchema = z.object({ reason: z.string().min(3).max(1000) });

// ─────────────────────────── Plans ───────────────────────────

export const PlanPointSchema = z.object({
  sequence: z.coerce.number().int().min(1).max(200),
  label: z.string().min(1).max(150),
  nominal_value: z.coerce.number(),
  unit_code: optStr(40),
  tolerance_type: ToleranceTypeEnum.default('ABSOLUTE'),
  tolerance_value: z.coerce.number(),
});

export const PlanUpsertSchema = z.object({
  interval_type: IntervalTypeEnum.default('MONTHS'),
  interval_value: z.coerce.number().int().min(1).max(3650),
  interval_justification: optStr(1000),
  method_doc_id: optStr(60),
  method_ref: optStr(200),
  provider_type: ProviderTypeEnum.default('INTERNAL'),
  provider_id: optStr(60),
  estimated_duration_hours: optNum,
  requires_msa: z.boolean().optional(),
  required_course_id: optStr(60),
  required_standard_category_ids: z.array(z.string()).max(20).optional(),
  next_due_at: optStr(40),
  /** Full replacement set — a plan version's points are atomic. */
  points: z.array(PlanPointSchema).min(1).max(100),
  /** Mandatory when config.requireReasonForChange and this supersedes a version. */
  change_reason: optStr(1000),
});

// ─────────────────────────── Events ───────────────────────────

export const ListEventsQuerySchema = z.object({
  ...page,
  status: z.string().optional(), // comma-separated
  type: EventTypeEnum.optional(),
  instrument_id: z.string().optional(),
  site_id: z.string().optional(),
  outcome: OutcomeEnum.optional(),
  provider_id: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  overdue: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

export const CreateEventSchema = z.object({
  instrument_id: z.string().min(1),
  type: EventTypeEnum.default('PERIODIC'),
  scheduled_for: optStr(40),
  plan_id: optStr(60),
  provider_type: ProviderTypeEnum.optional(),
  provider_id: optStr(60),
  remarks: optStr(1000),
});

export const UpdateEventSchema = z.object({
  scheduled_for: optStr(40),
  performed_at: optStr(40),
  performed_by_id: optStr(60),
  performed_by_external: optStr(200),
  provider_type: ProviderTypeEnum.optional(),
  provider_id: optStr(60),
  ambient_temperature: optNum,
  ambient_humidity: optNum,
  environment_notes: optStr(500),
  certificate_no: optStr(150),
  certificate_doc_id: optStr(60),
  adjustment_made: z.boolean().optional(),
  remarks: optStr(1000),
});

export const SaveReadingsSchema = z.object({
  readings: z
    .array(
      z.object({
        sequence: z.coerce.number().int().min(1).max(200),
        as_found_value: optNum,
        as_left_value: optNum,
        uncertainty: optNum,
        remarks: optStr(300),
      }),
    )
    .min(1)
    .max(200),
});

export const AddStandardSchema = z.object({
  standard_instrument_id: z.string().min(1),
  certificate_no: optStr(150),
  certificate_valid_until: optStr(40),
  traceable_to: optStr(150),
});

/** Electronic signature envelope — meaning is fixed by the endpoint, not the caller. */
export const SignatureSchema = z.object({
  signature_pin: z.string().min(1).max(64).optional(),
  comments: optStr(1000),
});

export const ReviewDecisionSchema = SignatureSchema.extend({
  decision: z.enum(['APPROVE', 'REJECT']),
  reason: optStr(1000),
});

// ─────────────────────────── OOT ───────────────────────────

export const ListOotQuerySchema = z.object({
  ...page,
  status: OotStatusEnum.optional(),
  site_id: z.string().optional(),
  instrument_id: z.string().optional(),
});

export const UpdateOotSchema = z.object({
  disposition: OotDispositionEnum.optional(),
  justification: optStr(4000),
  qa_comments: optStr(2000),
  affected_batch_refs: z.array(z.string().max(120)).max(500).optional(),
  product_hold_ref: optStr(150),
});

export const SpawnFromOotSchema = z.object({
  kind: z.enum(['DEVIATION', 'CAPA', 'RISK']),
  title: optStr(300),
});

export const NotifyCustomerSchema = z.object({
  reference: z.string().min(1).max(150),
  notes: optStr(2000),
});

export const ProductHoldSchema = z.object({
  reference: z.string().min(1).max(150),
  notes: optStr(2000),
});

// ─────────────────────────── In-use checks ───────────────────────────

export const ListChecksQuerySchema = z.object({
  ...page,
  instrument_id: z.string().optional(),
  outcome: OutcomeEnum.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const CreateCheckSchema = z.object({
  performed_at: z.string().optional(),
  shift: optStr(40),
  batch_ref: optStr(120),
  remarks: optStr(1000),
  readings: z
    .array(
      z.object({
        label: z.string().min(1).max(150),
        nominal: optNum,
        observed: optNum,
        in_tolerance: z.boolean(),
      }),
    )
    .min(1)
    .max(50),
});

// ─────────────────────────── MSA ───────────────────────────

export const ListMsaQuerySchema = z.object({
  ...page,
  instrument_id: z.string().optional(),
  type: MsaTypeEnum.optional(),
});

export const CreateMsaSchema = z.object({
  instrument_id: z.string().min(1),
  type: MsaTypeEnum.default('GAGE_RR_CROSSED'),
  performed_at: z.string().optional(),
  part_count: z.coerce.number().int().min(2).max(50).default(10),
  operator_count: z.coerce.number().int().min(1).max(10).default(3),
  trial_count: z.coerce.number().int().min(2).max(10).default(3),
  tolerance_used: optNum,
  notes: optStr(1000),
});

export const SaveMsaTrialsSchema = z.object({
  trials: z
    .array(
      z.object({
        part_no: z.coerce.number().int().min(1).max(50),
        operator: z.coerce.number().int().min(1).max(10),
        trial: z.coerce.number().int().min(1).max(10),
        measured: z.coerce.number(),
      }),
    )
    .min(1)
    .max(2000),
});

// ─────────────────────────── Providers ───────────────────────────

export const ListProvidersQuerySchema = z.object({
  ...page,
  is_active: z.coerce.boolean().optional(),
  type: ProviderTypeEnum.optional(),
  search: z.string().optional(),
});

export const ProviderUpsertSchema = z.object({
  code: optStr(60),
  name: z.string().min(1).max(200),
  type: ProviderTypeEnum.default('EXTERNAL'),
  contact_name: optStr(150),
  email: optStr(150),
  phone: optStr(50),
  country: optStr(80),
  accreditation_body: optStr(80),
  accreditation_no: optStr(80),
  accreditation_scope: optStr(500),
  accreditation_expiry: optStr(40),
  lims_supplier_id: optStr(60),
  is_active: z.boolean().optional(),
});

export const SearchQuerySchema = z.object({ q: z.string().optional().default(''), });

// ─────────────────────────── Analytics ───────────────────────────

export const AnalyticsQuerySchema = z.object({
  site_id: z.string().optional(),
  days: z.coerce.number().int().min(7).max(730).default(90),
});

// ─────────────────────────── Inferred types ───────────────────────────

export type UpdateConfigInput = z.infer<typeof UpdateConfigSchema>;
export type ApplyPackInput = z.infer<typeof ApplyPackSchema>;
export type ListCategoriesQuery = z.infer<typeof ListCategoriesQuerySchema>;
export type CategoryUpsertInput = z.infer<typeof CategoryUpsertSchema>;
export type PointTemplateUpsertInput = z.infer<typeof PointTemplateUpsertSchema>;
export type ListInstrumentsQuery = z.infer<typeof ListInstrumentsQuerySchema>;
export type InstrumentUpsertInput = z.infer<typeof InstrumentUpsertSchema>;
export type ReasonInput = z.infer<typeof ReasonSchema>;
export type PlanUpsertInput = z.infer<typeof PlanUpsertSchema>;
export type ListEventsQuery = z.infer<typeof ListEventsQuerySchema>;
export type CreateEventInput = z.infer<typeof CreateEventSchema>;
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;
export type SaveReadingsInput = z.infer<typeof SaveReadingsSchema>;
export type AddStandardInput = z.infer<typeof AddStandardSchema>;
export type SignatureInput = z.infer<typeof SignatureSchema>;
export type ReviewDecisionInput = z.infer<typeof ReviewDecisionSchema>;
export type ListOotQuery = z.infer<typeof ListOotQuerySchema>;
export type UpdateOotInput = z.infer<typeof UpdateOotSchema>;
export type SpawnFromOotInput = z.infer<typeof SpawnFromOotSchema>;
export type NotifyCustomerInput = z.infer<typeof NotifyCustomerSchema>;
export type ProductHoldInput = z.infer<typeof ProductHoldSchema>;
export type ListChecksQuery = z.infer<typeof ListChecksQuerySchema>;
export type CreateCheckInput = z.infer<typeof CreateCheckSchema>;
export type ListMsaQuery = z.infer<typeof ListMsaQuerySchema>;
export type CreateMsaInput = z.infer<typeof CreateMsaSchema>;
export type SaveMsaTrialsInput = z.infer<typeof SaveMsaTrialsSchema>;
export type ListProvidersQuery = z.infer<typeof ListProvidersQuerySchema>;
export type ProviderUpsertInput = z.infer<typeof ProviderUpsertSchema>;
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;
