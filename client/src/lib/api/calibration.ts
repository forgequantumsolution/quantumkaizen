/**
 * Calibration & Measuring Equipment API client. Backend: /api/calibration.
 *
 * Self-contained like the module it talks to — no types imported from the LIMS
 * client, so this file compiles and works whether or not LIMS is deployed.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─────────────────────────── Enums & labels ───────────────────────────

export type InstrumentKind =
  | 'LAB_INSTRUMENT'
  | 'PRODUCTION_GAUGE'
  | 'MONITORING_DEVICE'
  | 'REFERENCE_STANDARD'
  | 'UTILITY';

export type Criticality = 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INDICATIVE';

export type CalibrationStatus =
  | 'CALIBRATED'
  | 'DUE_SOON'
  | 'OVERDUE'
  | 'UNDER_CALIBRATION'
  | 'LIMITED_USE'
  | 'OUT_OF_SERVICE'
  | 'NOT_REQUIRED';

export type InstrumentStatus = 'ACTIVE' | 'OUT_OF_SERVICE' | 'RETIRED';
export type ToleranceType = 'ABSOLUTE' | 'PERCENT_OF_READING' | 'PERCENT_OF_SPAN' | 'MPE_MULTIPLE';
export type IntervalType = 'DAYS' | 'MONTHS' | 'USAGE_HOURS' | 'USAGE_CYCLES' | 'RISK_MODULATED';
export type ProviderType = 'INTERNAL' | 'EXTERNAL' | 'MANUFACTURER';
export type EventType = 'PERIODIC' | 'INITIAL' | 'AFTER_REPAIR' | 'AFTER_RELOCATION' | 'AD_HOC' | 'VERIFICATION';
export type EventStatus =
  | 'PLANNED'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'PENDING_REVIEW'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';
export type Outcome = 'PASS' | 'FAIL' | 'CONDITIONAL' | 'NOT_PERFORMED';
export type OotStatus = 'OPEN' | 'IMPACT_IN_PROGRESS' | 'PENDING_QA_APPROVAL' | 'CLOSED';
export type OotDisposition = 'NO_IMPACT' | 'IMPACT_CONFIRMED' | 'INCONCLUSIVE';
export type QualificationState = 'NOT_STARTED' | 'IQ' | 'OQ' | 'PQ' | 'QUALIFIED' | 'REQUALIFICATION_DUE';
export type InUseFrequency = 'PER_SHIFT' | 'DAILY' | 'WEEKLY' | 'PER_BATCH' | 'MONTHLY';
export type MsaVerdict = 'ACCEPTABLE' | 'CONDITIONAL' | 'UNACCEPTABLE';
export type PackKey = 'PHARMA' | 'AUTOMOTIVE' | 'FMCG';

export const KIND_LABELS: Record<InstrumentKind, string> = {
  LAB_INSTRUMENT: 'Lab instrument',
  PRODUCTION_GAUGE: 'Production gauge',
  MONITORING_DEVICE: 'Monitoring device',
  REFERENCE_STANDARD: 'Reference standard',
  UTILITY: 'Utility / chamber',
};

/** Status → badge classes. Overdue and out-of-service must read as stop signs. */
export const STATUS_BADGE: Record<CalibrationStatus, { cls: string; label: string }> = {
  CALIBRATED: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Calibrated' },
  DUE_SOON: { cls: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Due soon' },
  OVERDUE: { cls: 'bg-red-50 text-red-700 border-red-200', label: 'Overdue' },
  UNDER_CALIBRATION: { cls: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Under calibration' },
  LIMITED_USE: { cls: 'bg-orange-50 text-orange-700 border-orange-200', label: 'Limited use' },
  OUT_OF_SERVICE: { cls: 'bg-red-100 text-red-800 border-red-300', label: 'Out of service' },
  NOT_REQUIRED: { cls: 'bg-gray-100 text-gray-600 border-gray-200', label: 'Not required' },
};

export const CRITICALITY_BADGE: Record<Criticality, string> = {
  CRITICAL: 'bg-red-50 text-red-700 border-red-200',
  MAJOR: 'bg-amber-50 text-amber-700 border-amber-200',
  MINOR: 'bg-blue-50 text-blue-700 border-blue-200',
  INDICATIVE: 'bg-gray-100 text-gray-600 border-gray-200',
};

export const EVENT_STATUS_BADGE: Record<EventStatus, { cls: string; label: string }> = {
  PLANNED: { cls: 'bg-gray-100 text-gray-600 border-gray-200', label: 'Planned' },
  SCHEDULED: { cls: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Scheduled' },
  IN_PROGRESS: { cls: 'bg-indigo-50 text-indigo-700 border-indigo-200', label: 'In progress' },
  PENDING_REVIEW: { cls: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Pending review' },
  PENDING_APPROVAL: { cls: 'bg-amber-50 text-amber-800 border-amber-300', label: 'Pending approval' },
  APPROVED: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Approved' },
  REJECTED: { cls: 'bg-red-50 text-red-700 border-red-200', label: 'Rejected' },
  CANCELLED: { cls: 'bg-gray-100 text-gray-500 border-gray-200', label: 'Cancelled' },
};

export const OUTCOME_BADGE: Record<Outcome, string> = {
  PASS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FAIL: 'bg-red-50 text-red-700 border-red-200',
  CONDITIONAL: 'bg-orange-50 text-orange-700 border-orange-200',
  NOT_PERFORMED: 'bg-gray-100 text-gray-500 border-gray-200',
};

// ─────────────────────────── Types ───────────────────────────

export interface Paged<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface Instrument {
  id: string;
  code: string;
  name: string;
  kind: InstrumentKind;
  status: InstrumentStatus;
  calibration_status: CalibrationStatus;
  criticality: Criticality;
  category_id: string | null;
  category_name: string | null;
  category_code: string | null;
  requires_msa: boolean;
  requires_in_use_check: boolean;
  in_use_check_frequency: InUseFrequency | null;
  site_id: string | null;
  site_name: string | null;
  department_id: string | null;
  department_name: string | null;
  custodian_id: string | null;
  custodian_name: string | null;
  lab_ref: string | null;
  lims_equipment_id: string | null;
  serial_no: string | null;
  manufacturer: string | null;
  model: string | null;
  location: string | null;
  asset_tag: string | null;
  qr_token: string | null;
  is_calibration_required: boolean;
  exemption_reason: string | null;
  measurement_range_min: number | null;
  measurement_range_max: number | null;
  unit_code: string | null;
  resolution: number | null;
  accuracy_class: string | null;
  mpe: number | null;
  qualification_state: QualificationState;
  aiq_group: string | null;
  gamp_category: string | null;
  legal_metrology_stamp_no: string | null;
  legal_metrology_valid_until: string | null;
  last_calibrated_at: string | null;
  calibration_due_at: string | null;
  days_until_due: number | null;
  received_at: string | null;
  warranty_until: string | null;
  retired_at: string | null;
  retirement_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface InstrumentDetail extends Instrument {
  blocked_for_use: boolean;
  open_oot_count: number;
  in_use_check_count: number;
  active_plan: {
    id: string;
    version: number;
    interval_type: IntervalType;
    interval_value: number;
    provider_type: ProviderType;
    provider_id: string | null;
    next_due_at: string | null;
    requires_msa: boolean;
    point_count: number;
  } | null;
  last_event: {
    id: string;
    event_no: string;
    performed_at: string | null;
    as_found_outcome: Outcome | null;
    overall_outcome: Outcome | null;
    certificate_no: string | null;
    next_due_at: string | null;
  } | null;
  open_event: { id: string; event_no: string; status: EventStatus; scheduled_for: string | null } | null;
}

export interface InstrumentUpsert {
  name: string;
  code?: string | null;
  kind?: InstrumentKind;
  category_id?: string | null;
  lims_equipment_id?: string | null;
  lab_ref?: string | null;
  site_id?: string | null;
  department_id?: string | null;
  custodian_id?: string | null;
  serial_no?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  location?: string | null;
  asset_tag?: string | null;
  criticality?: Criticality;
  is_calibration_required?: boolean;
  exemption_reason?: string | null;
  measurement_range_min?: number | null;
  measurement_range_max?: number | null;
  unit_code?: string | null;
  resolution?: number | null;
  accuracy_class?: string | null;
  mpe?: number | null;
  qualification_state?: QualificationState;
  aiq_group?: string | null;
  gamp_category?: string | null;
  received_at?: string | null;
  warranty_until?: string | null;
  legal_metrology_stamp_no?: string | null;
  legal_metrology_valid_until?: string | null;
}

export interface PlanPoint {
  id?: string;
  sequence: number;
  label: string;
  nominal_value: number;
  unit_code: string | null;
  tolerance_type: ToleranceType;
  tolerance_value: number;
  lower_limit: number;
  upper_limit: number;
}

export interface Plan {
  id: string;
  instrument_id: string;
  version: number;
  is_active: boolean;
  interval_type: IntervalType;
  interval_value: number;
  interval_justification: string | null;
  method_doc_id: string | null;
  method_ref: string | null;
  provider_type: ProviderType;
  provider_id: string | null;
  estimated_duration_hours: number | null;
  requires_msa: boolean;
  required_course_id: string | null;
  required_standard_category_ids: string[];
  next_due_at: string | null;
  points: PlanPoint[];
  created_at: string;
  updated_at: string;
}

export interface PlanUpsert {
  interval_type: IntervalType;
  interval_value: number;
  interval_justification?: string | null;
  method_ref?: string | null;
  provider_type: ProviderType;
  provider_id?: string | null;
  requires_msa?: boolean;
  next_due_at?: string | null;
  points: {
    sequence: number;
    label: string;
    nominal_value: number;
    unit_code?: string | null;
    tolerance_type: ToleranceType;
    tolerance_value: number;
  }[];
  change_reason?: string | null;
}

export interface Reading {
  id: string;
  sequence: number;
  label: string;
  nominal_value: number;
  unit_code: string | null;
  lower_limit: number;
  upper_limit: number;
  as_found_value: number | null;
  as_found_error: number | null;
  as_found_in_tolerance: boolean | null;
  as_left_value: number | null;
  as_left_error: number | null;
  as_left_in_tolerance: boolean | null;
  uncertainty: number | null;
  remarks: string | null;
}

export interface StandardUse {
  id: string;
  standard_instrument_id: string;
  certificate_no: string | null;
  certificate_valid_until: string | null;
  traceable_to: string | null;
  was_valid_at_use: boolean;
}

export interface CalibrationEvent {
  id: string;
  event_no: string;
  instrument_id: string;
  instrument_code: string | null;
  instrument_name: string | null;
  instrument_criticality: Criticality | null;
  plan_id: string | null;
  plan_version: number | null;
  type: EventType;
  status: EventStatus;
  site_id: string | null;
  scheduled_for: string | null;
  started_at: string | null;
  performed_at: string | null;
  performed_by_id: string | null;
  performed_by_external: string | null;
  provider_type: ProviderType;
  provider_id: string | null;
  ambient_temperature: number | null;
  ambient_humidity: number | null;
  environment_notes: string | null;
  as_found_outcome: Outcome | null;
  as_left_outcome: Outcome | null;
  overall_outcome: Outcome | null;
  adjustment_made: boolean;
  certificate_no: string | null;
  next_due_at: string | null;
  days_until_due: number | null;
  remarks: string | null;
  reviewed_by_id: string | null;
  reviewed_at: string | null;
  approved_by_id: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  cancel_reason: string | null;
  is_overdue: boolean;
  oot_id: string | null;
  oot_status: OotStatus | null;
  readings?: Reading[];
  standards?: StandardUse[];
  config?: {
    require_performer_signature: boolean;
    require_reviewer_signature: boolean;
    require_approver_signature: boolean;
    oot_impact_assessment_required: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface Oot {
  id: string;
  event_id: string;
  event_no: string | null;
  instrument_id: string | null;
  instrument_code: string | null;
  instrument_name: string | null;
  instrument_criticality: Criticality | null;
  as_found_outcome: Outcome | null;
  overall_outcome: Outcome | null;
  status: OotStatus;
  impact_window_from: string;
  impact_window_to: string;
  impact_window_days: number;
  max_observed_error: number | null;
  affected_result_ids: string[];
  affected_qc_result_ids: string[];
  affected_sample_ids: string[];
  affected_batch_refs: string[];
  affected_total: number;
  last_scanned_at: string | null;
  disposition: OotDisposition | null;
  justification: string | null;
  qa_comments: string | null;
  deviation_ticket_id: string | null;
  capa_ticket_id: string | null;
  risk_id: string | null;
  customer_notification_required: boolean;
  customer_notified_at: string | null;
  customer_notification_ref: string | null;
  product_hold_required: boolean;
  product_hold_ref: string | null;
  created_at: string;
  updated_at: string;
}

export interface OotDetail extends Oot {
  lims_linked: boolean;
  lims_scan?: { available: boolean; reason: string | null };
  affected_results: { id: string; analyte: string; value: number | null; unit: string | null; evaluation: string; entered_at: string; sample_no: string | null }[];
  affected_samples: { id: string; sample_no: string; status: string; batch_no: string | null }[];
  affected_qc_results: { id: string; material: string | null; value: number; status: string; measured_at: string }[];
}

export interface Category {
  id: string;
  code: string;
  name: string;
  kind: InstrumentKind;
  industry_pack: string | null;
  description: string | null;
  default_interval_days: number | null;
  default_criticality: Criticality;
  default_tolerance_type: ToleranceType | null;
  default_tolerance_value: number | null;
  requires_msa: boolean;
  requires_in_use_check: boolean;
  in_use_check_frequency: InUseFrequency | null;
  is_active: boolean;
  instrument_count?: number;
  point_templates?: {
    id: string;
    sequence: number;
    label: string;
    nominal_value: number | null;
    nominal_percent_of_span: number | null;
    unit_code: string | null;
    tolerance_type: ToleranceType;
    tolerance_value: number;
  }[];
}

export interface CalibrationConfig {
  id: string;
  site_id: string | null;
  industry_pack: string;
  event_number_prefix: string;
  certificate_number_prefix: string;
  due_soon_window_days: number;
  auto_spawn_lead_days: number;
  grace_days: number;
  allow_early_calibration: boolean;
  early_window_days: number;
  interval_reset_basis: 'PERFORMED_DATE' | 'PREVIOUS_DUE_DATE';
  block_use_when_overdue: boolean;
  block_use_when_failed: boolean;
  require_competency_to_perform: boolean;
  require_performer_signature: boolean;
  require_reviewer_signature: boolean;
  require_approver_signature: boolean;
  require_reason_for_change: boolean;
  oot_impact_assessment_required: boolean;
  oot_impact_window: 'SINCE_LAST_CALIBRATION' | 'SINCE_LAST_PASSING_CHECK' | 'FIXED_DAYS';
  oot_auto_spawn: string[];
  oot_requires_customer_notification: boolean;
  oot_requires_product_hold: boolean;
  enable_msa: boolean;
  enable_in_use_checks: boolean;
  enable_legal_metrology: boolean;
  enable_aiq_groups: boolean;
  enable_usage_intervals: boolean;
  is_default?: boolean;
  organization_industry?: string | null;
  suggested_pack?: PackKey | null;
}

export interface Pack {
  key: PackKey;
  label: string;
  summary: string;
  standards: string[];
  suggested_for: string[];
  category_count: number;
  point_count: number;
  applied_category_count: number;
  categories: {
    code: string;
    name: string;
    kind: InstrumentKind;
    default_interval_days: number;
    default_criticality: Criticality;
    requires_msa: boolean;
    requires_in_use_check: boolean;
    in_use_check_frequency: InUseFrequency | null;
    point_count: number;
  }[];
}

export interface Provider {
  id: string;
  code: string;
  name: string;
  type: ProviderType;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  accreditation_body: string | null;
  accreditation_no: string | null;
  accreditation_scope: string | null;
  accreditation_expiry: string | null;
  accreditation_days_left: number | null;
  accreditation_lapsed: boolean;
  lims_supplier_id: string | null;
  is_active: boolean;
  event_count?: number;
}

export interface Check {
  id: string;
  instrument_id: string;
  instrument_code: string | null;
  instrument_name: string | null;
  performed_at: string;
  shift: string | null;
  outcome: Outcome;
  readings: { label: string; nominal: number | null; observed: number | null; in_tolerance: boolean }[];
  batch_ref: string | null;
  remarks: string | null;
  hold_triggered: boolean;
  hold_ref: string | null;
  hold_window_from: string | null;
}

export interface DueCheck {
  instrument_id: string;
  code: string;
  name: string;
  category_name: string | null;
  frequency: InUseFrequency | null;
  last_check_at: string | null;
  last_outcome: Outcome | null;
  is_due: boolean;
  hours_since_last: number | null;
}

export interface MsaStudy {
  id: string;
  study_no: string;
  instrument_id: string;
  instrument_code: string | null;
  instrument_name: string | null;
  type: string;
  performed_at: string;
  part_count: number;
  operator_count: number;
  trial_count: number;
  repeatability_ev: number | null;
  reproducibility_av: number | null;
  grr: number | null;
  part_variation: number | null;
  total_variation: number | null;
  grr_percent: number | null;
  ndc: number | null;
  verdict: MsaVerdict | null;
  tolerance_used: number | null;
  notes: string | null;
  approved_at: string | null;
  trial_data_count: number;
  trials?: { part_no: number; operator: number; trial: number; measured: number }[];
}

export interface Summary {
  window_days: number;
  total_instruments: number;
  compliance_rate: number | null;
  calibrated: number;
  due_soon: number;
  overdue: number;
  under_calibration: number;
  limited_use: number;
  out_of_service: number;
  not_required: number;
  open_oot: number;
  lapsed_standards: number;
  instruments_without_plan: number;
  calibrations_completed: number;
  on_time_rate: number | null;
  as_found_failure_rate: number | null;
  by_status: { status: CalibrationStatus; count: number }[];
  by_criticality: { criticality: Criticality; count: number }[];
}

export interface Capabilities {
  industry_pack: string;
  features: {
    msa: boolean;
    in_use_checks: boolean;
    legal_metrology: boolean;
    aiq_groups: boolean;
    usage_intervals: boolean;
  };
  integrations: Record<string, { available: boolean; label: string }>;
}

export interface ScheduleEntry {
  instrument_id: string;
  code: string;
  name: string;
  criticality: Criticality;
  calibration_status: CalibrationStatus;
  due_at: string | null;
}

// ─────────────────────────── Query keys ───────────────────────────

const K = {
  all: ['calibration'] as const,
  config: ['calibration', 'config'] as const,
  packs: ['calibration', 'packs'] as const,
  categories: (p?: unknown) => ['calibration', 'categories', p ?? {}] as const,
  instruments: (p?: unknown) => ['calibration', 'instruments', p ?? {}] as const,
  instrument: (id: string) => ['calibration', 'instrument', id] as const,
  plans: (id: string) => ['calibration', 'plans', id] as const,
  events: (p?: unknown) => ['calibration', 'events', p ?? {}] as const,
  event: (id: string) => ['calibration', 'event', id] as const,
  oot: (p?: unknown) => ['calibration', 'oot', p ?? {}] as const,
  ootOne: (id: string) => ['calibration', 'ootOne', id] as const,
  checks: (p?: unknown) => ['calibration', 'checks', p ?? {}] as const,
  dueChecks: ['calibration', 'checks', 'due'] as const,
  standards: ['calibration', 'standards'] as const,
  providers: (p?: unknown) => ['calibration', 'providers', p ?? {}] as const,
  msa: (p?: unknown) => ['calibration', 'msa', p ?? {}] as const,
  msaOne: (id: string) => ['calibration', 'msaOne', id] as const,
  analytics: (k: string, p?: unknown) => ['calibration', 'analytics', k, p ?? {}] as const,
};

const get = <T>(url: string, params?: Record<string, unknown>) =>
  api.get<T>(url, { params }).then((r) => r.data);

/** Invalidate everything under the module — cheap and avoids stale cross-views. */
const useInvalidate = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: K.all });
};

// ─────────────────────────── Config & packs ───────────────────────────

export const useCalibrationConfig = () =>
  useQuery<CalibrationConfig>({ queryKey: K.config, queryFn: () => get('/calibration/config') });

export const useUpdateCalibrationConfig = () => {
  const inv = useInvalidate();
  return useMutation<CalibrationConfig, unknown, Partial<CalibrationConfig>>({
    mutationFn: (body) => api.put('/calibration/config', body).then((r) => r.data),
    onSuccess: inv,
  });
};

export const usePacks = () =>
  useQuery<{ data: Pack[]; organization_industry: string | null; suggested_pack: PackKey | null }>({
    queryKey: K.packs,
    queryFn: () => get('/calibration/config/packs'),
  });

export const useApplyPack = () => {
  const inv = useInvalidate();
  return useMutation<unknown, unknown, { pack: PackKey; mode: 'merge' | 'replace' }>({
    mutationFn: (body) => api.post('/calibration/config/apply-pack', body).then((r) => r.data),
    onSuccess: inv,
  });
};

// ─────────────────────────── Categories ───────────────────────────

export const useCategories = (params: { kind?: InstrumentKind; search?: string } = {}) =>
  useQuery<Paged<Category>>({
    queryKey: K.categories(params),
    queryFn: () => get('/calibration/categories', { ...params, page_size: 200 }),
  });

export const useCreateCategory = () => {
  const inv = useInvalidate();
  return useMutation<Category, unknown, Partial<Category> & { name: string }>({
    mutationFn: (body) => api.post('/calibration/categories', body).then((r) => r.data),
    onSuccess: inv,
  });
};

export const useUpdateCategory = (id: string) => {
  const inv = useInvalidate();
  return useMutation<Category, unknown, Partial<Category> & { name: string }>({
    mutationFn: (body) => api.put(`/calibration/categories/${id}`, body).then((r) => r.data),
    onSuccess: inv,
  });
};

/** Point templates are replaced wholesale — a half-updated set computes nonsense. */
export const useReplacePointTemplates = () => {
  const inv = useInvalidate();
  return useMutation<
    Category,
    unknown,
    {
      id: string;
      points: {
        sequence: number;
        label: string;
        nominal_value?: number | null;
        nominal_percent_of_span?: number | null;
        unit_code?: string | null;
        tolerance_type: ToleranceType;
        tolerance_value: number;
      }[];
    }
  >({
    mutationFn: ({ id, points }) =>
      api.put(`/calibration/categories/${id}/point-templates`, { points }).then((r) => r.data),
    onSuccess: inv,
  });
};

export const useDeleteCategory = () => {
  const inv = useInvalidate();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => api.delete(`/calibration/categories/${id}`).then(() => undefined),
    onSuccess: inv,
  });
};

// ─────────────────────────── Instruments ───────────────────────────

export interface InstrumentFilters {
  kind?: InstrumentKind;
  calibration_status?: string;
  criticality?: Criticality;
  category_id?: string;
  due_within?: number;
  include_retired?: boolean;
  search?: string;
}

export const useInstruments = (params: InstrumentFilters = {}) =>
  useQuery<Paged<Instrument>>({
    queryKey: K.instruments(params),
    queryFn: () => get('/calibration/instruments', { ...params, page_size: 200 }),
  });

export const useInstrument = (id?: string) =>
  useQuery<InstrumentDetail>({
    queryKey: K.instrument(id ?? ''),
    queryFn: () => get(`/calibration/instruments/${id}`),
    enabled: !!id,
  });

export const useCreateInstrument = () => {
  const inv = useInvalidate();
  return useMutation<Instrument, unknown, InstrumentUpsert>({
    mutationFn: (body) => api.post('/calibration/instruments', body).then((r) => r.data),
    onSuccess: inv,
  });
};

export const useUpdateInstrument = (id: string) => {
  const inv = useInvalidate();
  return useMutation<Instrument, unknown, InstrumentUpsert>({
    mutationFn: (body) => api.put(`/calibration/instruments/${id}`, body).then((r) => r.data),
    onSuccess: inv,
  });
};

export const useDeleteInstrument = () => {
  const inv = useInvalidate();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => api.delete(`/calibration/instruments/${id}`).then(() => undefined),
    onSuccess: inv,
  });
};

export const useInstrumentAction = (action: 'retire' | 'out-of-service' | 'return-to-service' | 'exempt') => {
  const inv = useInvalidate();
  return useMutation<Instrument, unknown, { id: string; reason: string }>({
    mutationFn: ({ id, reason }) =>
      api.post(`/calibration/instruments/${id}/${action}`, { reason }).then((r) => r.data),
    onSuccess: inv,
  });
};

export const useInstrumentHistory = (id?: string) =>
  useQuery<{ events: Record<string, unknown>[]; checks: Record<string, unknown>[] }>({
    queryKey: ['calibration', 'history', id],
    queryFn: () => get(`/calibration/instruments/${id}/history`),
    enabled: !!id,
  });

export const useInstrumentDrift = (id?: string) =>
  useQuery<{
    event_count: number;
    series: {
      label: string;
      max_abs_error: number | null;
      slope_per_day: number | null;
      points: { performed_at: string | null; as_found_error: number | null; upper: number; lower: number }[];
    }[];
  }>({
    queryKey: ['calibration', 'drift', id],
    queryFn: () => get(`/calibration/instruments/${id}/drift`),
    enabled: !!id,
  });

export const useInstrumentLabel = (id?: string) =>
  useQuery<{
    code: string;
    name: string;
    serial_no: string | null;
    location: string | null;
    calibration_status: CalibrationStatus;
    last_calibrated_at: string | null;
    calibration_due_at: string | null;
    certificate_no: string | null;
    qr_token: string;
    verify_path: string;
  }>({
    queryKey: ['calibration', 'label', id],
    queryFn: () => get(`/calibration/instruments/${id}/label`),
    enabled: !!id,
  });

export const useReferenceStandards = () =>
  useQuery<{ data: (Instrument & { times_used: number; is_lapsed: boolean })[]; total: number }>({
    queryKey: K.standards,
    queryFn: () => get('/calibration/instruments/standards'),
  });

/** LIMS typeahead for the optional soft link; `available:false` when absent. */
export const useLimsEquipmentSearch = (q: string, enabled: boolean) =>
  useQuery<{ data: { id: string; code: string; name: string }[]; available: boolean; reason: string | null }>({
    queryKey: ['calibration', 'lims-search', q],
    queryFn: () => get('/calibration/instruments/lims-search', { q }),
    enabled,
  });

// ─────────────────────────── Plans ───────────────────────────

export const usePlans = (instrumentId?: string) =>
  useQuery<{ data: Plan[]; total: number }>({
    queryKey: K.plans(instrumentId ?? ''),
    queryFn: () => get(`/calibration/instruments/${instrumentId}/plans`),
    enabled: !!instrumentId,
  });

export const usePlanSuggestion = (instrumentId?: string, enabled = false) =>
  useQuery<{
    available: boolean;
    reason: string | null;
    category_name?: string | null;
    interval_value?: number;
    requires_msa?: boolean;
    points: Omit<PlanPoint, 'id'>[];
  }>({
    queryKey: ['calibration', 'plan-suggestion', instrumentId],
    queryFn: () => get(`/calibration/instruments/${instrumentId}/plan-suggestion`),
    enabled: !!instrumentId && enabled,
  });

export const useCreatePlan = (instrumentId: string) => {
  const inv = useInvalidate();
  return useMutation<Plan, unknown, PlanUpsert>({
    mutationFn: (body) => api.post(`/calibration/instruments/${instrumentId}/plans`, body).then((r) => r.data),
    onSuccess: inv,
  });
};

export const useSupersedePlan = (planId: string) => {
  const inv = useInvalidate();
  return useMutation<Plan, unknown, PlanUpsert>({
    mutationFn: (body) => api.put(`/calibration/plans/${planId}`, body).then((r) => r.data),
    onSuccess: inv,
  });
};

// ─────────────────────────── Events ───────────────────────────

export interface EventFilters {
  status?: string;
  type?: EventType;
  instrument_id?: string;
  outcome?: Outcome;
  overdue?: boolean;
  search?: string;
}

export const useEvents = (params: EventFilters = {}) =>
  useQuery<Paged<CalibrationEvent>>({
    queryKey: K.events(params),
    queryFn: () => get('/calibration/events', { ...params, page_size: 200 }),
  });

export const useEvent = (id?: string) =>
  useQuery<CalibrationEvent>({
    queryKey: K.event(id ?? ''),
    queryFn: () => get(`/calibration/events/${id}`),
    enabled: !!id,
  });

export const useCreateEvent = () => {
  const inv = useInvalidate();
  return useMutation<CalibrationEvent, unknown, { instrument_id: string; type: EventType; scheduled_for?: string | null }>({
    mutationFn: (body) => api.post('/calibration/events', body).then((r) => r.data),
    onSuccess: inv,
  });
};

export const useUpdateEvent = (id: string) => {
  const inv = useInvalidate();
  return useMutation<CalibrationEvent, unknown, Record<string, unknown>>({
    mutationFn: (body) => api.put(`/calibration/events/${id}`, body).then((r) => r.data),
    onSuccess: inv,
  });
};

/** POST helper for the event lifecycle verbs — all share a shape. */
export const useEventAction = <B = Record<string, unknown>>(
  action: 'start' | 'submit' | 'review' | 'approve' | 'reject' | 'cancel' | 'raise-oot',
) => {
  const inv = useInvalidate();
  return useMutation<CalibrationEvent, unknown, { id: string; body?: B }>({
    mutationFn: ({ id, body }) => api.post(`/calibration/events/${id}/${action}`, body ?? {}).then((r) => r.data),
    onSuccess: inv,
  });
};

export const useSaveReadings = () => {
  const inv = useInvalidate();
  return useMutation<
    CalibrationEvent,
    unknown,
    {
      id: string;
      readings: { sequence: number; as_found_value?: number | null; as_left_value?: number | null; uncertainty?: number | null }[];
    }
  >({
    mutationFn: ({ id, readings }) => api.put(`/calibration/events/${id}/readings`, { readings }).then((r) => r.data),
    onSuccess: inv,
  });
};

export const useAddStandard = () => {
  const inv = useInvalidate();
  return useMutation<
    CalibrationEvent,
    unknown,
    { id: string; standard_instrument_id: string; certificate_no?: string | null; traceable_to?: string | null }
  >({
    mutationFn: ({ id, ...body }) => api.post(`/calibration/events/${id}/standards`, body).then((r) => r.data),
    onSuccess: inv,
  });
};

export const useCertificate = (id?: string, enabled = false) =>
  useQuery<Record<string, unknown>>({
    queryKey: ['calibration', 'certificate', id],
    queryFn: () => get(`/calibration/events/${id}/certificate`),
    enabled: !!id && enabled,
  });

// ─────────────────────────── Out of tolerance ───────────────────────────

export const useOotList = (params: { status?: OotStatus; instrument_id?: string } = {}) =>
  useQuery<Paged<Oot>>({
    queryKey: K.oot(params),
    queryFn: () => get('/calibration/oot', { ...params, page_size: 200 }),
  });

export const useOot = (id?: string) =>
  useQuery<OotDetail>({
    queryKey: K.ootOne(id ?? ''),
    queryFn: () => get(`/calibration/oot/${id}`),
    enabled: !!id,
  });

export const useScanImpact = () => {
  const inv = useInvalidate();
  return useMutation<OotDetail, unknown, string>({
    mutationFn: (id) => api.post(`/calibration/oot/${id}/scan-impact`).then((r) => r.data),
    onSuccess: inv,
  });
};

export const useUpdateOot = () => {
  const inv = useInvalidate();
  return useMutation<Oot, unknown, { id: string; body: Record<string, unknown> }>({
    mutationFn: ({ id, body }) => api.put(`/calibration/oot/${id}`, body).then((r) => r.data),
    onSuccess: inv,
  });
};

export const useOotAction = (action: 'submit' | 'approve' | 'spawn' | 'notify-customer' | 'product-hold') => {
  const inv = useInvalidate();
  return useMutation<Oot, unknown, { id: string; body?: Record<string, unknown> }>({
    mutationFn: ({ id, body }) => api.post(`/calibration/oot/${id}/${action}`, body ?? {}).then((r) => r.data),
    onSuccess: inv,
  });
};

// ─────────────────────────── In-use checks ───────────────────────────

export const useChecks = (params: { instrument_id?: string; outcome?: Outcome } = {}) =>
  useQuery<Paged<Check>>({
    queryKey: K.checks(params),
    queryFn: () => get('/calibration/checks', { ...params, page_size: 200 }),
  });

export const useDueChecks = () =>
  useQuery<{ data: DueCheck[]; all: DueCheck[]; total: number }>({
    queryKey: K.dueChecks,
    queryFn: () => get('/calibration/checks/due'),
  });

export const useCreateCheck = () => {
  const inv = useInvalidate();
  return useMutation<
    Check & { hold_window: { from: string | null; to: string; hours: number | null; note: string } | null },
    unknown,
    {
      id: string;
      shift?: string | null;
      batch_ref?: string | null;
      remarks?: string | null;
      readings: { label: string; nominal?: number | null; observed?: number | null; in_tolerance: boolean }[];
    }
  >({
    mutationFn: ({ id, ...body }) => api.post(`/calibration/instruments/${id}/checks`, body).then((r) => r.data),
    onSuccess: inv,
  });
};

// ─────────────────────────── Providers ───────────────────────────

export const useProviders = (params: { search?: string } = {}) =>
  useQuery<Paged<Provider>>({
    queryKey: K.providers(params),
    queryFn: () => get('/calibration/providers', { ...params, page_size: 200 }),
  });

export const useCreateProvider = () => {
  const inv = useInvalidate();
  return useMutation<Provider, unknown, Partial<Provider> & { name: string }>({
    mutationFn: (body) => api.post('/calibration/providers', body).then((r) => r.data),
    onSuccess: inv,
  });
};

export const useUpdateProvider = (id: string) => {
  const inv = useInvalidate();
  return useMutation<Provider, unknown, Partial<Provider> & { name: string }>({
    mutationFn: (body) => api.put(`/calibration/providers/${id}`, body).then((r) => r.data),
    onSuccess: inv,
  });
};

export const useDeleteProvider = () => {
  const inv = useInvalidate();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => api.delete(`/calibration/providers/${id}`).then(() => undefined),
    onSuccess: inv,
  });
};

// ─────────────────────────── MSA ───────────────────────────

export const useMsaStudies = (params: { instrument_id?: string } = {}) =>
  useQuery<Paged<MsaStudy>>({
    queryKey: K.msa(params),
    queryFn: () => get('/calibration/msa', { ...params, page_size: 200 }),
  });

export const useMsaStudy = (id?: string) =>
  useQuery<MsaStudy>({
    queryKey: K.msaOne(id ?? ''),
    queryFn: () => get(`/calibration/msa/${id}`),
    enabled: !!id,
  });

export const useCreateMsa = () => {
  const inv = useInvalidate();
  return useMutation<MsaStudy, unknown, Record<string, unknown>>({
    mutationFn: (body) => api.post('/calibration/msa', body).then((r) => r.data),
    onSuccess: inv,
  });
};

export const useMsaAction = (action: 'compute' | 'approve') => {
  const inv = useInvalidate();
  return useMutation<MsaStudy, unknown, string>({
    mutationFn: (id) => api.post(`/calibration/msa/${id}/${action}`).then((r) => r.data),
    onSuccess: inv,
  });
};

export const useSaveMsaTrials = () => {
  const inv = useInvalidate();
  return useMutation<MsaStudy, unknown, { id: string; trials: { part_no: number; operator: number; trial: number; measured: number }[] }>({
    mutationFn: ({ id, trials }) => api.put(`/calibration/msa/${id}/trials`, { trials }).then((r) => r.data),
    onSuccess: inv,
  });
};

// ─────────────────────────── Analytics ───────────────────────────

export const useCalibrationSummary = (days = 90) =>
  useQuery<Summary>({ queryKey: K.analytics('summary', days), queryFn: () => get('/calibration/analytics/summary', { days }) });

export const useCalibrationSchedule = (days = 90) =>
  useQuery<{ overdue: ScheduleEntry[]; upcoming: ScheduleEntry[]; by_month: { month: string; count: number }[] }>({
    queryKey: K.analytics('schedule', days),
    queryFn: () => get('/calibration/analytics/schedule', { days }),
  });

export const useCalibrationByCategory = (days = 90) =>
  useQuery<{
    data: {
      category_id: string;
      category_name: string;
      kind: InstrumentKind;
      instrument_count: number;
      overdue_count: number;
      calibrations: number;
      as_found_failure_rate: number | null;
    }[];
  }>({ queryKey: K.analytics('by-category', days), queryFn: () => get('/calibration/analytics/by-category', { days }) });

export const useProviderPerformance = (days = 90) =>
  useQuery<{
    data: {
      provider_id: string;
      code: string;
      name: string;
      type: ProviderType;
      accreditation_lapsed: boolean;
      calibrations: number;
      on_time_rate: number | null;
      as_found_failure_rate: number | null;
    }[];
  }>({ queryKey: K.analytics('providers', days), queryFn: () => get('/calibration/analytics/providers', { days }) });

export const useOotTrend = (days = 90) =>
  useQuery<{
    total: number;
    open: number;
    impact_confirmed: number;
    no_impact: number;
    total_affected_records: number;
    largest_error: number | null;
    by_month: { month: string; count: number; confirmed: number }[];
  }>({ queryKey: K.analytics('oot-trend', days), queryFn: () => get('/calibration/analytics/oot-trend', { days }) });

/** One block per module surface, in a single round trip — see backend getOverview. */
export interface Overview {
  generated_at: string;
  window_days: number;
  config: {
    industry_pack: string;
    due_soon_window_days: number;
    enable_msa: boolean;
    enable_in_use_checks: boolean;
    oot_impact_window: string;
  };
  instruments: {
    total: number;
    by_status: { status: CalibrationStatus; count: number }[];
    by_kind: { kind: InstrumentKind; count: number }[];
    by_criticality: { criticality: Criticality; count: number }[];
    without_plan: number;
    blocked_for_use: number;
    compliance_rate: number | null;
  };
  schedule: {
    overdue: number;
    due_7: number;
    due_30: number;
    due_90: number;
    next: ScheduleEntry[];
  };
  events: {
    scheduled: number;
    in_progress: number;
    pending_review: number;
    pending_approval: number;
    rejected: number;
    approved_total: number;
    open_workload: number;
    completed_in_window: number;
    on_time_rate: number | null;
    as_found_failure_rate: number | null;
    recent: {
      id: string;
      event_no: string;
      status: EventStatus;
      type: EventType;
      instrument_code: string | null;
      instrument_name: string | null;
      scheduled_for: string | null;
      performed_at: string | null;
      as_found_outcome: Outcome | null;
      overall_outcome: Outcome | null;
    }[];
  };
  oot: {
    open: number;
    by_status: { status: OotStatus; count: number }[];
    impact_confirmed: number;
    no_impact: number;
    affected_records: number;
    largest_error: number | null;
    awaiting_customer_notification: number;
    awaiting_product_hold: number;
    recent: {
      id: string;
      status: OotStatus;
      disposition: OotDisposition | null;
      event_no: string | null;
      instrument_code: string | null;
      instrument_name: string | null;
      window_days: number;
      affected_total: number;
    }[];
  };
  checks: {
    enabled: boolean;
    monitored_instruments: number;
    due_now: number;
    failed_7d: number;
    holds_unreferenced: number;
    recent: {
      id: string;
      instrument_code: string | null;
      instrument_name: string | null;
      performed_at: string;
      shift: string | null;
      outcome: Outcome;
      batch_ref: string | null;
      hold_triggered: boolean;
    }[];
  };
  standards: {
    total: number;
    lapsed: number;
    expiring_60: number;
    items: { instrument_id: string; code: string; name: string; due_at: string | null; is_lapsed: boolean }[];
  };
  msa: {
    enabled: boolean;
    total: number;
    acceptable: number;
    conditional: number;
    unacceptable: number;
    not_computed: number;
    awaiting_approval: number;
    recent: { id: string; study_no: string; instrument_code: string | null; verdict: MsaVerdict | null; grr_percent: number | null; approved: boolean }[];
  };
  providers: {
    total: number;
    active: number;
    accreditation_lapsed: number;
    accreditation_expiring_60: number;
    items: { provider_id: string; code: string; name: string; expires: string | null; is_lapsed: boolean }[];
  };
  categories: { total: number; active: number; in_use: number; requiring_msa: number; requiring_checks: number };
}

export const useCalibrationOverview = (days = 90) =>
  useQuery<Overview>({
    queryKey: K.analytics('overview', days),
    queryFn: () => get('/calibration/analytics/overview', { days }),
  });

export const useCapabilities = () =>
  useQuery<Capabilities>({ queryKey: K.analytics('capabilities'), queryFn: () => get('/calibration/analytics/capabilities') });

/** Shared date formatter — keeps "—" for nulls consistent across every page. */
export const fmtDate = (d: string | null | undefined): string =>
  d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' }) : '—';

export const fmtDateTime = (d: string | null | undefined): string =>
  d ? new Date(d).toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
