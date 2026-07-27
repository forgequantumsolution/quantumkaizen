/**
 * Risk Management (QRM) API client. Backend: /api/risk.
 *
 * Two naming conventions live side by side here, and both are deliberate:
 *  - RESPONSE shapes are snake_case, exactly as the backend serializers emit
 *    them (risk.service.ts, risk-framework.service.ts, risk-assessment.service.ts,
 *    risk-control.service.ts, risk-review.service.ts, risk-library.service.ts).
 *  - REQUEST bodies and query params are camelCase, because the zod schemas at
 *    the edge (risk.schema.ts, risk-assessment.schema.ts, risk-control.schema.ts)
 *    validate camelCase keys.
 *
 * Envelope: GET -> { status: 200, data: <payload> }; POST/PUT/PATCH/DELETE ->
 * { status: 'success', message, data }. Both unwrap through `r.data.data`.
 * Paginated list payloads are { data, total, page, page_size }.
 */
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { BadgeVariant } from '@/components/ui/Badge';

// ── Enums ───────────────────────────────────────────────────────────────────

export type RiskMethodology =
  | 'MATRIX' | 'FMEA' | 'FMECA' | 'HACCP' | 'HAZOP' | 'PHA' | 'FTA' | 'BOWTIE' | 'CUSTOM';
export type RiskFormula =
  | 'PRODUCT' | 'SUM' | 'WEIGHTED_PRODUCT' | 'MATRIX_LOOKUP' | 'ACTION_PRIORITY';
export type RiskFactorKind =
  | 'SEVERITY' | 'OCCURRENCE' | 'PROBABILITY' | 'DETECTABILITY' | 'EXPOSURE' | 'CUSTOM';
export type RiskAcceptance = 'ACCEPTABLE' | 'ALARP' | 'UNACCEPTABLE';
export type RegisterScope =
  | 'SITE' | 'PRODUCT' | 'PROCESS' | 'PROJECT' | 'SUPPLIER' | 'EQUIPMENT' | 'SYSTEM' | 'ENTERPRISE';
export type RiskStatus =
  | 'IDENTIFIED' | 'UNDER_ASSESSMENT' | 'TREATMENT_PLANNED' | 'TREATMENT_IN_PROGRESS'
  | 'RESIDUAL_ASSESSED' | 'ACCEPTED' | 'MONITORED' | 'CLOSED' | 'REOPENED' | 'ESCALATED';
export type RiskTreatment = 'AVOID' | 'REDUCE' | 'TRANSFER' | 'ACCEPT';
export type ScoreStage = 'INITIAL' | 'RESIDUAL' | 'TARGET' | 'REVIEW';
export type HeatmapStage = 'INITIAL' | 'RESIDUAL';
export type RiskAssessmentStatus =
  | 'DRAFT' | 'IN_ASSESSMENT' | 'PENDING_REVIEW' | 'PENDING_APPROVAL' | 'APPROVED'
  | 'REJECTED' | 'PERIODIC_REVIEW' | 'SUPERSEDED' | 'CLOSED' | 'CANCELLED';
export type ControlType = 'PREVENTIVE' | 'DETECTIVE' | 'MITIGATING' | 'CORRECTIVE';
export type ControlHierarchy =
  | 'ELIMINATION' | 'SUBSTITUTION' | 'ENGINEERING' | 'ADMINISTRATIVE' | 'PPE'
  | 'INHERENT_SAFETY' | 'PROTECTIVE_MEASURE' | 'INFORMATION_FOR_SAFETY';
export type ControlStatus =
  | 'PLANNED' | 'IN_PROGRESS' | 'IMPLEMENTED' | 'VERIFIED' | 'INEFFECTIVE' | 'CANCELLED';
export type ReviewOutcome = 'NO_CHANGE' | 'RESCORED' | 'CONTROLS_ADDED' | 'ESCALATED' | 'CLOSED';
export type HazardType = 'HAZARD' | 'CAUSE' | 'CONSEQUENCE' | 'FAILURE_MODE' | 'THREAT';
export type LibraryKind = 'HAZARD' | 'CONTROL';

/** A factor-key -> rank map. Ranks only; scores are always computed server-side. */
export type FactorValues = Record<string, number>;

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
}

// ── Frameworks ──────────────────────────────────────────────────────────────

export interface RiskFactorLevel {
  id: string;
  rank: number;
  label: string;
  definition: string | null;
  guidance: string | null;
  color: string | null;
}

export interface RiskFactor {
  id: string;
  kind: RiskFactorKind;
  key: string;
  label: string;
  description: string | null;
  weight: number;
  order: number;
  levels: RiskFactorLevel[];
}

export interface RiskLevelDef {
  id: string;
  code: string;
  label: string;
  color: string;
  order: number;
  min_score: number | null;
  max_score: number | null;
  acceptance: RiskAcceptance;
  requires_capa: boolean;
  requires_approval: boolean;
  requires_control: boolean;
  review_months: number | null;
  escalate_to_role_id: string | null;
}

export interface RiskMatrixCell {
  id: string;
  row_factor_key: string;
  row_rank: number;
  col_factor_key: string;
  col_rank: number;
  score: number | null;
  level_id: string | null;
}

export interface RiskFramework {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  standard: string | null;
  methodology: RiskMethodology;
  formula: RiskFormula;
  version: number;
  is_active: boolean;
  is_default: boolean;
  terminology: Record<string, string> | null;
  field_config: Record<string, unknown> | null;
  site_id: string | null;
  factors: RiskFactor[];
  levels: RiskLevelDef[];
  matrix_cells: RiskMatrixCell[];
  risk_count: number;
  register_count: number;
  created_at: string;
  updated_at: string;
}

export interface FactorLevelUpsert {
  rank: number;
  label: string;
  definition?: string | null;
  guidance?: string | null;
  color?: string | null;
}

export interface FactorUpsert {
  kind: RiskFactorKind;
  key: string;
  label: string;
  description?: string | null;
  weight: number;
  order: number;
  levels: FactorLevelUpsert[];
}

export interface LevelDefUpsert {
  code: string;
  label: string;
  color: string;
  order: number;
  minScore?: number | null;
  maxScore?: number | null;
  acceptance: RiskAcceptance;
  requiresCapa: boolean;
  requiresApproval: boolean;
  requiresControl: boolean;
  reviewMonths?: number | null;
  escalateToRoleId?: string | null;
}

export interface MatrixCellUpsert {
  rowFactorKey: string;
  rowRank: number;
  colFactorKey: string;
  colRank: number;
  score?: number | null;
  levelCode: string;
}

export interface RiskFrameworkUpsert {
  code?: string | null;
  name: string;
  description?: string | null;
  standard?: string | null;
  methodology: RiskMethodology;
  formula: RiskFormula;
  isActive: boolean;
  isDefault: boolean;
  terminology?: Record<string, string> | null;
  fieldConfig?: Record<string, unknown> | null;
  siteId?: string | null;
  factors: FactorUpsert[];
  levels: LevelDefUpsert[];
  matrixCells?: MatrixCellUpsert[];
}

export interface ListFrameworkParams {
  search?: string;
  methodology?: RiskMethodology;
  isActive?: boolean;
  siteId?: string;
}

// ── Categories ──────────────────────────────────────────────────────────────

export interface RiskCategory {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  color: string | null;
  is_active: boolean;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RiskCategoryUpsert {
  code?: string | null;
  name: string;
  description?: string | null;
  color?: string | null;
  parentId?: string | null;
  isActive: boolean;
}

export interface ListCategoryParams {
  search?: string;
  isActive?: boolean;
}

// ── Registers ───────────────────────────────────────────────────────────────

export interface RegisterScopeRef {
  entityType: string;
  entityId: string;
  label?: string;
}

/** Nested framework relation on a register — Prisma-shaped, so camelCase. */
export interface RegisterFrameworkRef {
  id: string;
  code: string | null;
  name: string;
  methodology: RiskMethodology;
}

export interface RiskRegister {
  id: string;
  register_number: string;
  name: string;
  description: string | null;
  scope: RegisterScope;
  scope_ref: RegisterScopeRef | null;
  framework: RegisterFrameworkRef | null;
  site_id: string | null;
  department_id: string | null;
  owner_id: string | null;
  is_active: boolean;
  risk_count: number;
  created_at: string;
  updated_at: string;
}

export interface RiskRegisterUpsert {
  name: string;
  description?: string | null;
  scope: RegisterScope;
  scopeRef?: RegisterScopeRef | null;
  frameworkId?: string | null;
  siteId?: string | null;
  departmentId?: string | null;
  ownerId?: string | null;
  isActive: boolean;
}

export interface ListRegisterParams {
  search?: string;
  scope?: RegisterScope;
  siteId?: string;
  ownerId?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

// ── Risks ───────────────────────────────────────────────────────────────────

/** Resolved risk-level display block, denormalised onto a scored record. */
export interface RiskLevelRef {
  code: string;
  label: string;
  color: string;
  acceptance: RiskAcceptance;
  /** Policy the level implies — travels with the level so a page can tell
   *  whether a risk needs approval/controls/training without a second call. */
  requires_approval: boolean;
  requires_control: boolean;
  requires_capa: boolean;
  requires_training: boolean;
}

/** Prisma relation blocks passed through the serializer verbatim (camelCase). */
export interface RiskRegisterRef {
  id: string;
  registerNumber: string;
  name: string;
  frameworkId: string | null;
}
export interface RiskCategoryRef {
  id: string;
  name: string;
  code: string | null;
  color: string | null;
}
export interface RiskFrameworkRef {
  id: string;
  name: string;
  methodology: RiskMethodology;
  formula: RiskFormula;
}

export interface RiskLink {
  id: string;
  entity_type: string;
  /** Human name of the type ("CAPA", "Document") from the backend registry. */
  entity_type_label: string;
  entity_id: string;
  label: string | null;
  /** Freshly resolved reference — present on the detail view only. */
  entity_number: string | null;
  entity_title: string | null;
  /** Client route to the linked record; null for types with no detail page. */
  entity_route: string | null;
  /**
   * Whether the target still exists. null on list payloads (not resolved);
   * false marks a dangling link, which is a traceability defect worth showing.
   */
  entity_exists: boolean | null;
  relation: string | null;
  created_at: string;
}

/** A record type a risk may be linked to (from GET /risk/links/types). */
export interface LinkableType {
  type: string;
  label: string;
  has_route: boolean;
}

/** One typeahead hit (from GET /risk/links/search). */
export interface LinkableHit {
  id: string;
  number: string;
  title: string;
  label: string;
  route: string | null;
}

/** A risk linked to some other record (from GET /risk/links). */
export interface LinkedRisk {
  link_id: string;
  relation: string | null;
  linked_at: string;
  risk: Risk;
}

/**
 * "How risky is this record?" — the materialised cross-module read model
 * (GET /risk/profile). Every field is derived from the risks linked to the
 * entity; an entity with no risks comes back zeroed rather than 404.
 */
export interface RiskProfile {
  entity_type: string;
  entity_id: string;
  open_risk_count: number;
  total_risk_count: number;
  highest_level_code: string | null;
  highest_level_label: string | null;
  highest_level_color: string | null;
  /** Cross-framework severity, 0-100. Comparable between frameworks; level
   *  `order` is not. Null when no linked risk has been scored. */
  severity_rank: number | null;
  acceptance: RiskAcceptance | null;
  max_residual_score: number | null;
  /** Open risks at an UNACCEPTABLE level with no acceptance record. */
  unacceptable_count: number;
  overdue_reviews: number;
  open_controls: number;
  last_risk_event_at: string | null;
  recomputed_at: string | null;
}

export interface Risk {
  id: string;
  risk_number: string;
  title: string;
  description: string | null;
  register: RiskRegisterRef | null;
  category: RiskCategoryRef | null;
  framework: RiskFrameworkRef | null;
  hazard: string | null;
  hazardous_situation: string | null;
  harm: string | null;
  cause: string | null;
  consequence: string | null;
  status: RiskStatus;
  treatment: RiskTreatment | null;
  initial_factors: FactorValues | null;
  initial_score: number | null;
  initial_level: RiskLevelRef | null;
  residual_factors: FactorValues | null;
  residual_score: number | null;
  residual_level: RiskLevelRef | null;
  target_factors: FactorValues | null;
  target_score: number | null;
  target_level: RiskLevelRef | null;
  owner_id: string | null;
  department_id: string | null;
  site_id: string | null;
  identified_at: string | null;
  accepted_at: string | null;
  closed_at: string | null;
  next_review_at: string | null;
  is_review_overdue: boolean;
  workflow_id: string | null;
  workflow_ticket_id: string | null;
  workflow_ticket_unique_id: string | null;
  links: RiskLink[];
  snapshot_count: number;
  link_count: number;
  created_at: string;
  updated_at: string;
  /** Present only on the response to POST /risks/:id/score. */
  computed?: {
    stage: ScoreStage;
    score: number;
    level: RiskLevelRef & { id: string };
    action_priority: string | null;
    requires_capa: boolean;
    requires_approval: boolean;
    requires_control: boolean;
  };
}

export interface RiskCreateBody {
  registerId: string;
  title: string;
  description?: string | null;
  categoryId?: string | null;
  frameworkId?: string | null;
  hazard?: string | null;
  hazardousSituation?: string | null;
  harm?: string | null;
  cause?: string | null;
  consequence?: string | null;
  treatment?: RiskTreatment | null;
  ownerId?: string | null;
  departmentId?: string | null;
  siteId?: string | null;
  initialFactors?: FactorValues | null;
}

export type RiskUpdateBody = Partial<Omit<RiskCreateBody, 'registerId' | 'initialFactors'>>;

export interface ScoreRiskBody {
  stage: ScoreStage;
  factors: FactorValues;
  reason?: string | null;
}

export interface UpdateRiskStatusBody {
  status: RiskStatus;
  reason?: string | null;
}

export interface RiskLinkUpsert {
  entityType: string;
  entityId: string;
  label?: string | null;
  relation?: string | null;
}

export interface ListRiskParams {
  search?: string;
  registerId?: string;
  categoryId?: string;
  status?: RiskStatus;
  ownerId?: string;
  siteId?: string;
  levelCode?: string;
  overdueReview?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'residualScore' | 'initialScore' | 'nextReviewAt' | 'riskNumber';
  sortDir?: 'asc' | 'desc';
}

export interface RiskScoreSnapshot {
  id: string;
  stage: ScoreStage;
  factors: FactorValues | null;
  score: number | null;
  level_code: string | null;
  level_label: string | null;
  formula: RiskFormula | null;
  reason: string | null;
  user_id: string | null;
  user_name: string;
  created_at: string;
}

/** Formal, e-signed acceptance of residual risk (ISO 14971 §8). */
export interface RiskAcceptanceRecord {
  id: string;
  risk_id: string;
  justification: string;
  residual_score: number | null;
  residual_level_code: string | null;
  benefit_risk_rationale: string | null;
  accepted_by_id: string | null;
  accepted_at: string;
  e_signature_id: string | null;
}

export interface AcceptRiskBody {
  justification: string;
  benefitRiskRationale?: string | null;
  credential: string;
  meaning?: string;
}

// ── Assessments ─────────────────────────────────────────────────────────────

export interface AssessmentTeamMember {
  id: string;
  name: string;
  role?: string | null;
}

export interface AssessmentRegisterRef {
  id: string;
  registerNumber: string;
  name: string;
}
export interface AssessmentFrameworkRef {
  id: string;
  name: string;
  methodology: RiskMethodology;
  formula: RiskFormula;
  version: number;
}
export interface AssessmentVersionRef {
  id: string;
  assessment_number: string;
  version: number;
  status: RiskAssessmentStatus;
}
export interface AssessmentParentRef {
  id: string;
  assessmentNumber: string;
  version: number;
  status: RiskAssessmentStatus;
}

/** The risk relation carried on a promoted worksheet line (Prisma-shaped). */
export interface LineRiskRef {
  id: string;
  riskNumber: string;
  title: string;
  status: RiskStatus;
}

export interface RiskAssessmentLine {
  id: string;
  assessment_id: string;
  line_number: number;
  item_function: string | null;
  failure_mode: string | null;
  effect: string | null;
  cause: string | null;
  current_controls: string | null;
  hazard: string | null;
  consequence: string | null;
  initial_factors: FactorValues | null;
  initial_score: number | null;
  initial_level: (RiskLevelRef & { id: string }) | null;
  action_priority: string | null;
  recommended_action: string | null;
  owner_id: string | null;
  due_date: string | null;
  residual_factors: FactorValues | null;
  residual_score: number | null;
  residual_level: (RiskLevelRef & { id: string }) | null;
  risk_id: string | null;
  risk: LineRiskRef | null;
  is_promoted: boolean;
  is_critical: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RiskAssessment {
  id: string;
  assessment_number: string;
  title: string;
  objective: string | null;
  scope_text: string | null;
  methodology: RiskMethodology;
  status: RiskAssessmentStatus;
  register: AssessmentRegisterRef | null;
  framework: AssessmentFrameworkRef | null;
  framework_id: string;
  has_framework_snapshot: boolean;
  version: number;
  parent_id: string | null;
  team_members: AssessmentTeamMember[] | null;
  lead_id: string | null;
  site_id: string | null;
  department_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  approved_at: string | null;
  approved_by_id: string | null;
  rejection_reason: string | null;
  conclusion: string | null;
  next_review_at: string | null;
  is_review_overdue: boolean;
  is_locked: boolean;
  trigger_type: string | null;
  trigger_id: string | null;
  workflow_id: string | null;
  workflow_ticket_id: string | null;
  workflow_ticket_unique_id: string | null;
  line_count: number;
  version_count: number;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
  // Detail-only fields (GET /assessments/:id).
  framework_snapshot?: RiskFramework | null;
  parent?: AssessmentParentRef | null;
  versions?: AssessmentVersionRef[];
  lines?: RiskAssessmentLine[];
  links?: RiskLink[];
}

export interface RiskAssessmentCreateBody {
  title: string;
  objective?: string | null;
  scopeText?: string | null;
  methodology?: RiskMethodology | null;
  registerId?: string | null;
  frameworkId?: string | null;
  teamMembers?: AssessmentTeamMember[] | null;
  leadId?: string | null;
  siteId?: string | null;
  departmentId?: string | null;
  startedAt?: string | null;
  conclusion?: string | null;
  nextReviewAt?: string | null;
  triggerType?: string | null;
  triggerId?: string | null;
  workflowId?: string | null;
  workflowTicketId?: string | null;
  workflowTicketUniqueId?: string | null;
}

export type RiskAssessmentUpdateBody = Partial<Omit<RiskAssessmentCreateBody, 'frameworkId'>>;

export interface UpdateAssessmentStatusBody {
  status: RiskAssessmentStatus;
  reason?: string | null;
}

export interface ApproveAssessmentBody {
  password: string;
  meaning?: string;
  reason?: string | null;
  conclusion?: string | null;
  nextReviewAt?: string | null;
}

export interface RejectAssessmentBody {
  reason: string;
}

export interface ReviseAssessmentBody {
  reason?: string | null;
  title?: string | null;
}

export interface RiskAssessmentLineUpsert {
  itemFunction?: string | null;
  failureMode?: string | null;
  effect?: string | null;
  cause?: string | null;
  currentControls?: string | null;
  hazard?: string | null;
  consequence?: string | null;
  initialFactors?: FactorValues | null;
  residualFactors?: FactorValues | null;
  recommendedAction?: string | null;
  ownerId?: string | null;
  dueDate?: string | null;
  isCritical?: boolean;
  notes?: string | null;
  lineNumber?: number | null;
}

export interface BulkLinesBody {
  lines: (RiskAssessmentLineUpsert & { id?: string | null })[];
  /** true -> the payload is the complete worksheet; omitted rows are deleted. */
  replace?: boolean;
  reason?: string | null;
}

export interface PromoteLineBody {
  registerId?: string | null;
  categoryId?: string | null;
  ownerId?: string | null;
  title?: string | null;
  reason?: string | null;
}

export interface PromoteLineResult {
  line: RiskAssessmentLine;
  risk: { id: string; risk_number: string; title: string; status: RiskStatus };
}

export interface ListAssessmentParams {
  search?: string;
  status?: RiskAssessmentStatus;
  methodology?: RiskMethodology;
  registerId?: string;
  siteId?: string;
  frameworkId?: string;
  leadId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'assessmentNumber' | 'nextReviewAt' | 'approvedAt';
  sortDir?: 'asc' | 'desc';
}

// ── Controls ────────────────────────────────────────────────────────────────

export interface ControlRiskRef {
  id: string;
  risk_number: string;
  title: string;
  status: RiskStatus;
  register_id: string;
}

export interface ControlLibraryRef {
  id: string;
  name: string;
  code: string | null;
  type: ControlType;
  hierarchy: ControlHierarchy | null;
}

export interface RiskControl {
  id: string;
  control_number: string;
  risk_id: string;
  risk: ControlRiskRef | null;
  title: string;
  description: string | null;
  type: ControlType;
  hierarchy: ControlHierarchy | null;
  status: ControlStatus;
  owner_id: string | null;
  due_date: string | null;
  implemented_at: string | null;
  verified_by_id: string | null;
  verified_at: string | null;
  effectiveness: string | null;
  is_effective: boolean | null;
  capa_id: string | null;
  action_item_id: string | null;
  document_id: string | null;
  lms_course_id: string | null;
  library_item: ControlLibraryRef | null;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
}

export interface RiskControlUpsert {
  title: string;
  description?: string | null;
  type: ControlType;
  hierarchy?: ControlHierarchy | null;
  ownerId?: string | null;
  dueDate?: string | null;
  capaId?: string | null;
  actionItemId?: string | null;
  documentId?: string | null;
  lmsCourseId?: string | null;
  libraryItemId?: string | null;
}

export interface ControlStatusBody {
  status: ControlStatus;
  reason?: string | null;
}

export interface VerifyControlBody {
  isEffective: boolean;
  effectiveness: string;
  verifiedAt?: string | null;
}

export interface ListControlParams {
  search?: string;
  riskId?: string;
  registerId?: string;
  status?: ControlStatus;
  type?: ControlType;
  hierarchy?: ControlHierarchy;
  ownerId?: string;
  overdue?: boolean;
  dueBefore?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'dueDate' | 'status' | 'controlNumber';
  sortDir?: 'asc' | 'desc';
}

// ── Periodic reviews ────────────────────────────────────────────────────────

export interface ReviewRiskRef {
  id: string;
  risk_number: string;
  title: string;
  status: RiskStatus;
  register_id: string;
  owner_id: string | null;
  residual_score: number | null;
}

export interface RiskReview {
  id: string;
  risk_id: string;
  risk: ReviewRiskRef | null;
  due_at: string;
  reviewed_at: string | null;
  reviewed_by_id: string | null;
  outcome: ReviewOutcome | null;
  findings: string | null;
  next_review_at: string | null;
  overdue_at: string | null;
  is_overdue: boolean;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface RiskReviewUpsert {
  dueAt: string;
  findings?: string | null;
}

export interface CompleteReviewBody {
  outcome: ReviewOutcome;
  findings: string;
  nextReviewAt?: string | null;
}

export interface ListReviewParams {
  riskId?: string;
  registerId?: string;
  outcome?: ReviewOutcome;
  overdue?: boolean;
  completed?: boolean;
  dueBefore?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'dueAt' | 'createdAt' | 'reviewedAt';
  sortDir?: 'asc' | 'desc';
}

// ── Libraries ───────────────────────────────────────────────────────────────

export interface HazardLibraryItem {
  id: string;
  code: string | null;
  name: string;
  type: HazardType;
  description: string | null;
  category: RiskCategoryRef | null;
  default_severity_rank: number | null;
  tags: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ControlLibraryItem {
  id: string;
  code: string | null;
  name: string;
  type: ControlType;
  hierarchy: ControlHierarchy | null;
  description: string | null;
  effectiveness_rank: number | null;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface HazardLibraryUpsert {
  code?: string | null;
  name: string;
  type: HazardType;
  description?: string | null;
  categoryId?: string | null;
  defaultSeverityRank?: number | null;
  tags?: string[] | null;
  isActive: boolean;
}

export interface ControlLibraryUpsert {
  code?: string | null;
  name: string;
  type: ControlType;
  hierarchy?: ControlHierarchy | null;
  description?: string | null;
  effectivenessRank?: number | null;
  isActive: boolean;
}

export interface ListLibraryParams {
  search?: string;
  /** Hazard library: HazardType. Control library: ControlType. */
  type?: HazardType | ControlType;
  hierarchy?: ControlHierarchy;
  categoryId?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

// ── Analytics ───────────────────────────────────────────────────────────────

export interface HeatmapAxisLevel {
  rank: number;
  label: string;
  color: string | null;
}

export interface RiskHeatmap {
  stage: HeatmapStage;
  framework: { id: string; name: string; methodology: RiskMethodology };
  axes: {
    row: { key: string; label: string; levels: HeatmapAxisLevel[] };
    col: { key: string; label: string; levels: HeatmapAxisLevel[] };
  };
  cells: { row_rank: number; col_rank: number; count: number; risk_ids: string[] }[];
  by_level: Record<string, number>;
  total: number;
  unscored: number;
}

export interface RiskSummary {
  total: number;
  by_status: Partial<Record<RiskStatus, number>>;
  overdue_reviews: number;
  unscored: number;
}

export interface HeatmapParams {
  registerId?: string;
  siteId?: string;
  frameworkId?: string;
  stage?: HeatmapStage;
}

export interface SummaryParams {
  registerId?: string;
  siteId?: string;
}

// ── Query keys ──────────────────────────────────────────────────────────────

export const riskKeys = {
  all: ['risk'] as const,
  frameworks: (p?: object) => ['risk', 'frameworks', p] as const,
  framework: (id: string) => ['risk', 'framework', id] as const,
  categories: (p?: object) => ['risk', 'categories', p] as const,
  registers: (p?: object) => ['risk', 'registers', p] as const,
  register: (id: string) => ['risk', 'register', id] as const,
  risks: (p?: object) => ['risk', 'risks', p] as const,
  risk: (id: string) => ['risk', 'risk', id] as const,
  history: (id: string) => ['risk', 'history', id] as const,
  assessments: (p?: object) => ['risk', 'assessments', p] as const,
  assessment: (id: string) => ['risk', 'assessment', id] as const,
  controls: (p?: object) => ['risk', 'controls', p] as const,
  reviews: (p?: object) => ['risk', 'reviews', p] as const,
  library: (p?: object) => ['risk', 'library', p] as const,
  heatmap: (p?: object) => ['risk', 'heatmap', p] as const,
  summary: (p?: object) => ['risk', 'summary', p] as const,
  linkableTypes: () => ['risk', 'linkable-types'] as const,
  linkableSearch: (type: string, q: string) => ['risk', 'linkable-search', type, q] as const,
  linkedRisks: (entityType: string, entityId: string) =>
    ['risk', 'linked-risks', entityType, entityId] as const,
  profile: (entityType: string, entityId: string) =>
    ['risk', 'profile', entityType, entityId] as const,
  profiles: (entityType: string, ids: string[]) =>
    ['risk', 'profiles', entityType, [...ids].sort().join(',')] as const,
  profileRanked: (entityType: string, take: number) =>
    ['risk', 'profile-ranked', entityType, take] as const,
};

// ── Transport helpers ───────────────────────────────────────────────────────
//
// Every risk endpoint speaks the shared envelope, so unwrapping lives in one
// place rather than being repeated (and mistyped) in twenty hooks.

const getOne = <T>(url: string, params?: object): Promise<T> =>
  api.get(url, { params }).then((r) => r.data.data as T);

const getList = <T>(url: string, params?: object): Promise<Paginated<T>> =>
  api.get(url, { params }).then((r) => r.data.data as Paginated<T>);

const getArray = <T>(url: string, params?: object): Promise<T[]> =>
  api.get(url, { params }).then((r) => r.data.data as T[]);

const post = <T>(url: string, body?: unknown): Promise<T> =>
  api.post(url, body ?? {}).then((r) => r.data.data as T);

const put = <T>(url: string, body: unknown): Promise<T> =>
  api.put(url, body).then((r) => r.data.data as T);

const patch = <T>(url: string, body: unknown): Promise<T> =>
  api.patch(url, body).then((r) => r.data.data as T);

const del = (url: string): Promise<void> => api.delete(url).then(() => undefined);

/** Config/lookup data changes rarely — don't refetch it on every mount. */
const CONFIG_STALE = 5 * 60_000;

// ── Framework queries ───────────────────────────────────────────────────────

export const useRiskFrameworks = (params: ListFrameworkParams = {}) =>
  useQuery<RiskFramework[]>({
    queryKey: riskKeys.frameworks(params),
    queryFn: () => getArray<RiskFramework>('/risk/frameworks', params),
    staleTime: CONFIG_STALE,
  });

export const useRiskFramework = (id: string | undefined) =>
  useQuery<RiskFramework>({
    queryKey: riskKeys.framework(id ?? ''),
    queryFn: () => getOne<RiskFramework>(`/risk/frameworks/${id}`),
    enabled: !!id,
    staleTime: CONFIG_STALE,
  });

export const useRiskCategories = (params: ListCategoryParams = {}) =>
  useQuery<RiskCategory[]>({
    queryKey: riskKeys.categories(params),
    queryFn: () => getArray<RiskCategory>('/risk/categories', params),
    staleTime: CONFIG_STALE,
  });

// ── Register queries ────────────────────────────────────────────────────────

export const useRiskRegisters = (params: ListRegisterParams = {}) =>
  useQuery<Paginated<RiskRegister>>({
    queryKey: riskKeys.registers(params),
    queryFn: () => getList<RiskRegister>('/risk/registers', params),
  });

export const useRiskRegister = (id: string | undefined) =>
  useQuery<RiskRegister>({
    queryKey: riskKeys.register(id ?? ''),
    queryFn: () => getOne<RiskRegister>(`/risk/registers/${id}`),
    enabled: !!id,
  });

// ── Risk queries ────────────────────────────────────────────────────────────

export const useRisks = (params: ListRiskParams = {}) =>
  useQuery<Paginated<Risk>>({
    queryKey: riskKeys.risks(params),
    queryFn: () => getList<Risk>('/risk/risks', params),
  });

export const useRisk = (id: string | undefined) =>
  useQuery<Risk>({
    queryKey: riskKeys.risk(id ?? ''),
    queryFn: () => getOne<Risk>(`/risk/risks/${id}`),
    enabled: !!id,
  });

export const useRiskHistory = (id: string | undefined) =>
  useQuery<RiskScoreSnapshot[]>({
    queryKey: riskKeys.history(id ?? ''),
    queryFn: () => getArray<RiskScoreSnapshot>(`/risk/risks/${id}/history`),
    enabled: !!id,
  });

export const useRiskAcceptances = (id: string | undefined) =>
  useQuery<RiskAcceptanceRecord[]>({
    queryKey: ['risk', 'acceptances', id ?? ''],
    queryFn: () => getArray<RiskAcceptanceRecord>(`/risk/risks/${id}/acceptances`),
    enabled: !!id,
  });

// ── Assessment queries ──────────────────────────────────────────────────────

export const useRiskAssessments = (params: ListAssessmentParams = {}) =>
  useQuery<Paginated<RiskAssessment>>({
    queryKey: riskKeys.assessments(params),
    queryFn: () => getList<RiskAssessment>('/risk/assessments', params),
  });

export const useRiskAssessment = (id: string | undefined) =>
  useQuery<RiskAssessment>({
    queryKey: riskKeys.assessment(id ?? ''),
    queryFn: () => getOne<RiskAssessment>(`/risk/assessments/${id}`),
    enabled: !!id,
  });

// ── Control / review / library queries ──────────────────────────────────────

export const useRiskControls = (params: ListControlParams = {}) =>
  useQuery<Paginated<RiskControl>>({
    queryKey: riskKeys.controls(params),
    queryFn: () => getList<RiskControl>('/risk/controls', params),
  });

/**
 * Cross-page control counts, one per status, under a shared set of filters.
 *
 * The controls list is paginated, so counting statuses in the loaded rows only
 * ever describes the current page. These are count-only calls (`pageSize: 1`,
 * read `total`) against the real filter set, so a breakdown built from them holds
 * for the whole result — not just the fifteen rows on screen. There is no
 * group-by endpoint for controls; when one exists this collapses to a single
 * request.
 */
export const useRiskControlStatusCounts = (
  statuses: readonly ControlStatus[],
  base: Omit<ListControlParams, 'status' | 'page' | 'pageSize'> = {},
) =>
  useQueries({
    queries: statuses.map((status) => {
      const params = { ...base, status, page: 1, pageSize: 1 };
      return {
        queryKey: riskKeys.controls(params),
        queryFn: () => getList<RiskControl>('/risk/controls', params),
      };
    }),
    combine: (results) => ({
      isLoading: results.some((r) => r.isLoading),
      counts: Object.fromEntries(
        statuses.map((s, i) => [s, results[i]?.data?.total ?? 0]),
      ) as Record<ControlStatus, number>,
    }),
  });

export const useRiskReviews = (params: ListReviewParams = {}) =>
  useQuery<Paginated<RiskReview>>({
    queryKey: riskKeys.reviews(params),
    queryFn: () => getList<RiskReview>('/risk/reviews', params),
  });

export const useHazardLibrary = (params: ListLibraryParams = {}) =>
  useQuery<Paginated<HazardLibraryItem>>({
    queryKey: riskKeys.library({ kind: 'HAZARD', ...params }),
    queryFn: () => getList<HazardLibraryItem>('/risk/hazard-library', params),
    staleTime: CONFIG_STALE,
  });

export const useControlLibrary = (params: ListLibraryParams = {}) =>
  useQuery<Paginated<ControlLibraryItem>>({
    queryKey: riskKeys.library({ kind: 'CONTROL', ...params }),
    queryFn: () => getList<ControlLibraryItem>('/risk/control-library', params),
    staleTime: CONFIG_STALE,
  });

// ── Analytics queries ───────────────────────────────────────────────────────

export const useRiskHeatmap = (params: HeatmapParams = {}) =>
  useQuery<RiskHeatmap>({
    queryKey: riskKeys.heatmap(params),
    queryFn: () => getOne<RiskHeatmap>('/risk/analytics/heatmap', params),
  });

export const useRiskSummary = (params: SummaryParams = {}) =>
  useQuery<RiskSummary>({
    queryKey: riskKeys.summary(params),
    queryFn: () => getOne<RiskSummary>('/risk/analytics/summary', params),
  });

// ── Framework mutations ─────────────────────────────────────────────────────

export const useCreateFramework = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RiskFrameworkUpsert) => post<RiskFramework>('/risk/frameworks', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: riskKeys.all }),
  });
};

export const useUpdateFramework = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RiskFrameworkUpsert) => put<RiskFramework>(`/risk/frameworks/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: riskKeys.all });
      qc.invalidateQueries({ queryKey: riskKeys.framework(id) });
    },
  });
};

export const useCloneFramework = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => post<RiskFramework>(`/risk/frameworks/${id}/clone`),
    onSuccess: () => qc.invalidateQueries({ queryKey: riskKeys.all }),
  });
};

export const useDeleteFramework = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`/risk/frameworks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: riskKeys.all }),
  });
};

// ── Category mutations ──────────────────────────────────────────────────────

export const useCreateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RiskCategoryUpsert) => post<RiskCategory>('/risk/categories', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: riskKeys.all }),
  });
};

export const useUpdateCategory = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RiskCategoryUpsert) => put<RiskCategory>(`/risk/categories/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: riskKeys.all }),
  });
};

export const useDeleteCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`/risk/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: riskKeys.all }),
  });
};

// ── Register mutations ──────────────────────────────────────────────────────

export const useCreateRegister = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RiskRegisterUpsert) => post<RiskRegister>('/risk/registers', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: riskKeys.all }),
  });
};

export const useUpdateRegister = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RiskRegisterUpsert) => put<RiskRegister>(`/risk/registers/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: riskKeys.all });
      qc.invalidateQueries({ queryKey: riskKeys.register(id) });
    },
  });
};

export const useDeleteRegister = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`/risk/registers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: riskKeys.all }),
  });
};

// ── Risk mutations ──────────────────────────────────────────────────────────

export const useCreateRisk = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RiskCreateBody) => post<Risk>('/risk/risks', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: riskKeys.all });
      qc.invalidateQueries({ queryKey: riskKeys.heatmap() });
    },
  });
};

export const useUpdateRisk = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RiskUpdateBody) => put<Risk>(`/risk/risks/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: riskKeys.all });
      qc.invalidateQueries({ queryKey: riskKeys.risk(id) });
    },
  });
};

// Scoring rewrites the level bands the heat map and the score history are built
// from, so both are invalidated alongside the risk itself.
export const useScoreRisk = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ScoreRiskBody) => post<Risk>(`/risk/risks/${id}/score`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: riskKeys.all });
      qc.invalidateQueries({ queryKey: riskKeys.risk(id) });
      qc.invalidateQueries({ queryKey: riskKeys.history(id) });
      qc.invalidateQueries({ queryKey: riskKeys.heatmap() });
      qc.invalidateQueries({ queryKey: riskKeys.summary() });
    },
  });
};

export const useUpdateRiskStatus = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateRiskStatusBody) => patch<Risk>(`/risk/risks/${id}/status`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: riskKeys.all });
      qc.invalidateQueries({ queryKey: riskKeys.risk(id) });
      qc.invalidateQueries({ queryKey: riskKeys.summary() });
    },
  });
};

export const useDeleteRisk = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`/risk/risks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: riskKeys.all });
      qc.invalidateQueries({ queryKey: riskKeys.heatmap() });
    },
  });
};

export const useAddRiskLink = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RiskLinkUpsert) => post<RiskLink>(`/risk/risks/${id}/links`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: riskKeys.all });
      qc.invalidateQueries({ queryKey: riskKeys.risk(id) });
    },
  });
};

export const useRemoveRiskLink = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) => del(`/risk/links/${linkId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: riskKeys.all }),
  });
};

// ── Link resolution (entity registry) ───────────────────────────────────────

/** The linkable record types, straight from the backend registry. Never
 *  hardcode this list on the client — adding a type is a backend-only change. */
export const useLinkableTypes = () =>
  useQuery<LinkableType[]>({
    queryKey: riskKeys.linkableTypes(),
    queryFn: () => getArray<LinkableType>('/risk/links/types'),
    staleTime: CONFIG_STALE,
  });

/** Typeahead over one record type. Disabled below 2 characters — the backend
 *  would happily scan, but a 1-char query is never a real search. */
export const useLinkableSearch = (type: string | undefined, q: string) =>
  useQuery<LinkableHit[]>({
    queryKey: riskKeys.linkableSearch(type ?? '', q),
    queryFn: () => getArray<LinkableHit>('/risk/links/search', { type, q }),
    enabled: !!type && q.trim().length >= 2,
    staleTime: 30_000,
  });

/**
 * Reverse lookup — the risks linked to some other record. This is the hook every
 * other module's risk panel uses; it is what makes a link bidirectional.
 */
export const useRisksLinkedTo = (entityType: string | undefined, entityId: string | undefined) =>
  useQuery<LinkedRisk[]>({
    queryKey: riskKeys.linkedRisks(entityType ?? '', entityId ?? ''),
    queryFn: () => getArray<LinkedRisk>('/risk/links', { entityType, entityId }),
    enabled: !!entityType && !!entityId,
  });

// ── Risk profile (cross-module read model) ──────────────────────────────────

/** One record's risk profile. Any module's detail page can call this. */
export const useRiskProfile = (entityType: string | undefined, entityId: string | undefined) =>
  useQuery<RiskProfile>({
    queryKey: riskKeys.profile(entityType ?? '', entityId ?? ''),
    queryFn: () => getOne<RiskProfile>('/risk/profile', { entityType, entityId }),
    enabled: !!entityType && !!entityId,
    staleTime: 60_000,
  });

/**
 * Batch profiles for a list view — one request for the whole page instead of
 * one per row. Returns a Map so callers index by id without a find() per cell.
 */
export const useRiskProfiles = (entityType: string | undefined, ids: string[]) => {
  const query = useQuery<RiskProfile[]>({
    queryKey: riskKeys.profiles(entityType ?? '', ids),
    queryFn: () => getArray<RiskProfile>('/risk/profile', { entityType, ids: ids.join(',') }),
    enabled: !!entityType && ids.length > 0,
    staleTime: 60_000,
  });
  const byId = new Map((query.data ?? []).map((p) => [p.entity_id, p]));
  return { ...query, byId };
};

/** The riskiest N records of a type — "top risk suppliers" style panels. */
export const useRiskiestEntities = (entityType: string | undefined, take = 10) =>
  useQuery<RiskProfile[]>({
    queryKey: riskKeys.profileRanked(entityType ?? '', take),
    queryFn: () => getArray<RiskProfile>('/risk/profile/ranked', { entityType, take }),
    enabled: !!entityType,
    staleTime: 60_000,
  });

// Formal residual-risk acceptance: e-signed, and it moves the risk to ACCEPTED.
export const useAcceptRisk = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AcceptRiskBody) =>
      post<RiskAcceptanceRecord>(`/risk/risks/${id}/accept`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: riskKeys.all });
      qc.invalidateQueries({ queryKey: riskKeys.risk(id) });
      qc.invalidateQueries({ queryKey: ['risk', 'acceptances', id] });
      qc.invalidateQueries({ queryKey: riskKeys.summary() });
    },
  });
};

// ── Assessment mutations ────────────────────────────────────────────────────

export const useCreateAssessment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RiskAssessmentCreateBody) =>
      post<RiskAssessment>('/risk/assessments', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: riskKeys.all }),
  });
};

export const useUpdateAssessment = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RiskAssessmentUpdateBody) =>
      put<RiskAssessment>(`/risk/assessments/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: riskKeys.all });
      qc.invalidateQueries({ queryKey: riskKeys.assessment(id) });
    },
  });
};

export const useDeleteAssessment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`/risk/assessments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: riskKeys.all }),
  });
};

export const useUpdateAssessmentStatus = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateAssessmentStatusBody) =>
      patch<RiskAssessment>(`/risk/assessments/${id}/status`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: riskKeys.all });
      qc.invalidateQueries({ queryKey: riskKeys.assessment(id) });
    },
  });
};

export const useApproveAssessment = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ApproveAssessmentBody) =>
      post<RiskAssessment>(`/risk/assessments/${id}/approve`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: riskKeys.all });
      qc.invalidateQueries({ queryKey: riskKeys.assessment(id) });
    },
  });
};

export const useRejectAssessment = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RejectAssessmentBody) =>
      post<RiskAssessment>(`/risk/assessments/${id}/reject`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: riskKeys.all });
      qc.invalidateQueries({ queryKey: riskKeys.assessment(id) });
    },
  });
};

// Revising supersedes the source and returns a fresh version, so the whole
// assessment surface — not just this id — has to be refetched.
export const useReviseAssessment = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ReviseAssessmentBody) =>
      post<RiskAssessment>(`/risk/assessments/${id}/revise`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: riskKeys.all });
      qc.invalidateQueries({ queryKey: riskKeys.assessment(id) });
    },
  });
};

/** Bulk worksheet save. Returns the assessment's lines as they now stand. */
export const useSaveAssessmentLines = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BulkLinesBody) =>
      post<RiskAssessmentLine[]>(`/risk/assessments/${id}/lines/bulk`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: riskKeys.all });
      qc.invalidateQueries({ queryKey: riskKeys.assessment(id) });
    },
  });
};

export const useCreateLine = (assessmentId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RiskAssessmentLineUpsert) =>
      post<RiskAssessmentLine>(`/risk/assessments/${assessmentId}/lines`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: riskKeys.all });
      qc.invalidateQueries({ queryKey: riskKeys.assessment(assessmentId) });
    },
  });
};

export const useUpdateLine = (lineId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RiskAssessmentLineUpsert) =>
      put<RiskAssessmentLine>(`/risk/lines/${lineId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: riskKeys.all }),
  });
};

export const useDeleteLine = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lineId: string) => del(`/risk/lines/${lineId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: riskKeys.all }),
  });
};

// Promotion writes a new record into the risk register, so the risk lists and
// the heat map move as well as the worksheet.
export const usePromoteLine = (lineId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PromoteLineBody) =>
      post<PromoteLineResult>(`/risk/lines/${lineId}/promote`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: riskKeys.all });
      qc.invalidateQueries({ queryKey: riskKeys.heatmap() });
      qc.invalidateQueries({ queryKey: riskKeys.summary() });
    },
  });
};

// ── Control mutations ───────────────────────────────────────────────────────

export const useCreateControl = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { risk_id: string; body: RiskControlUpsert }) =>
      post<RiskControl>(`/risk/risks/${vars.risk_id}/controls`, vars.body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: riskKeys.all });
      qc.invalidateQueries({ queryKey: riskKeys.risk(vars.risk_id) });
    },
  });
};

export const useUpdateControl = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<RiskControlUpsert>) =>
      put<RiskControl>(`/risk/controls/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: riskKeys.all }),
  });
};

/** Status-only transition (PATCH) — separate from the full-body PUT above. */
export const useUpdateControlStatus = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ControlStatusBody) => patch<RiskControl>(`/risk/controls/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: riskKeys.all }),
  });
};

// Verifying a control can flip the owning risk's treatment posture, so the risk
// detail and the dashboard summary are refreshed too.
export const useVerifyControl = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: VerifyControlBody) =>
      post<RiskControl>(`/risk/controls/${id}/verify`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: riskKeys.all });
      qc.invalidateQueries({ queryKey: riskKeys.summary() });
    },
  });
};

export const useDeleteControl = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`/risk/controls/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: riskKeys.all }),
  });
};

// ── Review mutations ────────────────────────────────────────────────────────

export const useCreateReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { risk_id: string; body: RiskReviewUpsert }) =>
      post<RiskReview>(`/risk/risks/${vars.risk_id}/reviews`, vars.body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: riskKeys.all });
      qc.invalidateQueries({ queryKey: riskKeys.risk(vars.risk_id) });
    },
  });
};

export const useUpdateReview = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RiskReviewUpsert) => put<RiskReview>(`/risk/reviews/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: riskKeys.all }),
  });
};

// Completing a review can rescore the risk and reschedule the next one, which
// moves the heat map and the overdue counters.
export const useCompleteReview = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CompleteReviewBody) =>
      post<RiskReview>(`/risk/reviews/${id}/complete`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: riskKeys.all });
      qc.invalidateQueries({ queryKey: riskKeys.heatmap() });
      qc.invalidateQueries({ queryKey: riskKeys.summary() });
    },
  });
};

// ── Library mutations ───────────────────────────────────────────────────────
//
// The hazard and control libraries are two endpoints with one UI, so the hooks
// take the library `kind` as a mutation variable rather than duplicating six
// near-identical hooks.

const libraryPath = (kind: LibraryKind) =>
  kind === 'HAZARD' ? '/risk/hazard-library' : '/risk/control-library';

export type LibraryItem = HazardLibraryItem | ControlLibraryItem;
export type LibraryUpsert = HazardLibraryUpsert | ControlLibraryUpsert;

export const useCreateLibraryItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { kind: LibraryKind; body: LibraryUpsert }) =>
      post<LibraryItem>(libraryPath(vars.kind), vars.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: riskKeys.all }),
  });
};

export const useUpdateLibraryItem = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { kind: LibraryKind; body: LibraryUpsert }) =>
      put<LibraryItem>(`${libraryPath(vars.kind)}/${id}`, vars.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: riskKeys.all }),
  });
};

export const useDeleteLibraryItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { kind: LibraryKind; id: string }) =>
      del(`${libraryPath(vars.kind)}/${vars.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: riskKeys.all }),
  });
};

// ── Labels & badge variants ─────────────────────────────────────────────────
//
// Badge maps resolve to the shared BadgeVariant union used by <Badge> and
// <StatusBadge> everywhere else in the app, so risk records read as the same
// visual family as audits, CAPAs and OOS investigations.

export const RISK_STATUS_LABELS: Record<RiskStatus, string> = {
  IDENTIFIED: 'Identified',
  UNDER_ASSESSMENT: 'Under Assessment',
  TREATMENT_PLANNED: 'Treatment Planned',
  TREATMENT_IN_PROGRESS: 'Treatment In Progress',
  RESIDUAL_ASSESSED: 'Residual Assessed',
  ACCEPTED: 'Accepted',
  MONITORED: 'Monitored',
  CLOSED: 'Closed',
  REOPENED: 'Reopened',
  ESCALATED: 'Escalated',
};

export const RISK_STATUS_BADGE: Record<RiskStatus, BadgeVariant> = {
  IDENTIFIED: 'default',
  UNDER_ASSESSMENT: 'info',
  TREATMENT_PLANNED: 'warning',
  TREATMENT_IN_PROGRESS: 'info',
  RESIDUAL_ASSESSED: 'purple',
  ACCEPTED: 'success',
  MONITORED: 'info',
  CLOSED: 'outline',
  REOPENED: 'warning',
  ESCALATED: 'danger',
};

export const ACCEPTANCE_LABELS: Record<RiskAcceptance, string> = {
  ACCEPTABLE: 'Acceptable',
  ALARP: 'ALARP',
  UNACCEPTABLE: 'Unacceptable',
};

export const ACCEPTANCE_BADGE: Record<RiskAcceptance, BadgeVariant> = {
  ACCEPTABLE: 'success',
  ALARP: 'warning',
  UNACCEPTABLE: 'danger',
};

export const ASSESSMENT_STATUS_BADGE: Record<RiskAssessmentStatus, BadgeVariant> = {
  DRAFT: 'default',
  IN_ASSESSMENT: 'info',
  PENDING_REVIEW: 'warning',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  PERIODIC_REVIEW: 'purple',
  SUPERSEDED: 'outline',
  CLOSED: 'outline',
  CANCELLED: 'outline',
};

export const ASSESSMENT_STATUS_LABELS: Record<RiskAssessmentStatus, string> = {
  DRAFT: 'Draft',
  IN_ASSESSMENT: 'In Assessment',
  PENDING_REVIEW: 'Pending Review',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  PERIODIC_REVIEW: 'Periodic Review',
  SUPERSEDED: 'Superseded',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

export const CONTROL_STATUS_BADGE: Record<ControlStatus, BadgeVariant> = {
  PLANNED: 'default',
  IN_PROGRESS: 'info',
  IMPLEMENTED: 'purple',
  VERIFIED: 'success',
  INEFFECTIVE: 'danger',
  CANCELLED: 'outline',
};

export const CONTROL_STATUS_LABELS: Record<ControlStatus, string> = {
  PLANNED: 'Planned',
  IN_PROGRESS: 'In Progress',
  IMPLEMENTED: 'Implemented',
  VERIFIED: 'Verified',
  INEFFECTIVE: 'Ineffective',
  CANCELLED: 'Cancelled',
};

export const CONTROL_TYPE_LABELS: Record<ControlType, string> = {
  PREVENTIVE: 'Preventive',
  DETECTIVE: 'Detective',
  MITIGATING: 'Mitigating',
  CORRECTIVE: 'Corrective',
};

export const CONTROL_HIERARCHY_LABELS: Record<ControlHierarchy, string> = {
  ELIMINATION: 'Elimination',
  SUBSTITUTION: 'Substitution',
  ENGINEERING: 'Engineering Control',
  ADMINISTRATIVE: 'Administrative Control',
  PPE: 'PPE',
  INHERENT_SAFETY: 'Inherent Safety by Design',
  PROTECTIVE_MEASURE: 'Protective Measure',
  INFORMATION_FOR_SAFETY: 'Information for Safety',
};

export const REVIEW_OUTCOME_LABELS: Record<ReviewOutcome, string> = {
  NO_CHANGE: 'No Change',
  RESCORED: 'Rescored',
  CONTROLS_ADDED: 'Controls Added',
  ESCALATED: 'Escalated',
  CLOSED: 'Closed',
};

export const METHODOLOGY_LABELS: Record<RiskMethodology, string> = {
  MATRIX: 'Risk Matrix',
  FMEA: 'FMEA',
  FMECA: 'FMECA',
  HACCP: 'HACCP',
  HAZOP: 'HAZOP',
  PHA: 'Preliminary Hazard Analysis',
  FTA: 'Fault Tree Analysis',
  BOWTIE: 'Bow-Tie',
  CUSTOM: 'Custom',
};

export const FORMULA_LABELS: Record<RiskFormula, string> = {
  PRODUCT: 'Product of factors',
  SUM: 'Sum of factors',
  WEIGHTED_PRODUCT: 'Weighted product',
  MATRIX_LOOKUP: 'Matrix lookup',
  ACTION_PRIORITY: 'Action Priority (AIAG-VDA)',
};

export const TREATMENT_LABELS: Record<RiskTreatment, string> = {
  AVOID: 'Avoid',
  REDUCE: 'Reduce',
  TRANSFER: 'Transfer',
  ACCEPT: 'Accept',
};

export const REGISTER_SCOPE_LABELS: Record<RegisterScope, string> = {
  SITE: 'Site',
  PRODUCT: 'Product',
  PROCESS: 'Process',
  PROJECT: 'Project',
  SUPPLIER: 'Supplier',
  EQUIPMENT: 'Equipment',
  SYSTEM: 'System',
  ENTERPRISE: 'Enterprise',
};

export const HAZARD_TYPE_LABELS: Record<HazardType, string> = {
  HAZARD: 'Hazard',
  CAUSE: 'Cause',
  CONSEQUENCE: 'Consequence',
  FAILURE_MODE: 'Failure Mode',
  THREAT: 'Threat',
};

// ── Triggers: raise risk work from another module's record ──────────────────

export interface TriggerResult {
  created: boolean;
  reused?: boolean;
  mode: 'RISK' | 'ASSESSMENT';
  id: string;
  number: string;
}

export interface TriggerBody {
  triggerType: string;
  triggerId: string;
  mode?: 'RISK' | 'ASSESSMENT';
  relation?: string;
  attributes?: Record<string, unknown>;
  seed: {
    title: string;
    description?: string | null;
    hazard?: string | null;
    cause?: string | null;
    consequence?: string | null;
    ownerId?: string | null;
    departmentId?: string | null;
    siteId?: string | null;
  };
}

export interface TriggerRule {
  id: string;
  name: string;
  trigger_type: string;
  condition: Record<string, unknown> | null;
  mode: 'RISK' | 'ASSESSMENT';
  register_id: string | null;
  framework_id: string | null;
  category_id: string | null;
  auto_create: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TriggerRuleUpsert {
  name: string;
  triggerType: string;
  condition?: Record<string, unknown> | null;
  mode: 'RISK' | 'ASSESSMENT';
  registerId?: string | null;
  frameworkId?: string | null;
  categoryId?: string | null;
  autoCreate: boolean;
  isActive: boolean;
}

/** Raise a risk (or assessment) from another module's record. */
export const useRunTrigger = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TriggerBody) => post<TriggerResult>('/risk/triggers', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: riskKeys.all }),
  });
};

export const useTriggerRules = (params: { triggerType?: string; isActive?: boolean } = {}) =>
  useQuery<TriggerRule[]>({
    queryKey: ['risk', 'trigger-rules', params],
    queryFn: () => getArray<TriggerRule>('/risk/trigger-rules', params),
    staleTime: CONFIG_STALE,
  });

export const useCreateTriggerRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TriggerRuleUpsert) => post<TriggerRule>('/risk/trigger-rules', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['risk', 'trigger-rules'] }),
  });
};

export const useUpdateTriggerRule = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TriggerRuleUpsert) => put<TriggerRule>(`/risk/trigger-rules/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['risk', 'trigger-rules'] }),
  });
};

export const useDeleteTriggerRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`/risk/trigger-rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['risk', 'trigger-rules'] }),
  });
};

// ── Second-person approval (requiresApproval) ───────────────────────────────

export interface RiskApproval {
  id: string;
  risk_id: string;
  level_code: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requested_by_id: string | null;
  requested_at: string;
  decided_by_id: string | null;
  decided_at: string | null;
  decision: string | null;
  comment: string | null;
  e_signature_id: string | null;
}

export const useRiskApprovals = (riskId: string | undefined) =>
  useQuery<RiskApproval[]>({
    queryKey: ['risk', 'approvals', riskId ?? ''],
    queryFn: () => getArray<RiskApproval>(`/risk/risks/${riskId}/approvals`),
    enabled: !!riskId,
  });

export const useRequestRiskApproval = (riskId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { comment?: string | null }) =>
      post<RiskApproval>(`/risk/risks/${riskId}/approvals`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['risk', 'approvals', riskId] });
      qc.invalidateQueries({ queryKey: riskKeys.risk(riskId) });
    },
  });
};

export const useDecideRiskApproval = (riskId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ approvalId, ...body }: {
      approvalId: string;
      decision: 'APPROVED' | 'REJECTED';
      comment?: string | null;
      credential: string;
      meaning?: string;
    }) => post<RiskApproval>(`/risk/approvals/${approvalId}/decide`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['risk', 'approvals', riskId] });
      qc.invalidateQueries({ queryKey: riskKeys.risk(riskId) });
    },
  });
};

// ── Risk appetite ───────────────────────────────────────────────────────────

export interface RiskAppetite {
  id: string;
  name: string;
  organization_id: string | null;
  site_id: string | null;
  category_id: string | null;
  tolerance_rank: number;
  statement: string | null;
  requires_board_review: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppetiteUpsert {
  name: string;
  organizationId?: string | null;
  siteId?: string | null;
  categoryId?: string | null;
  toleranceRank: number;
  statement?: string | null;
  requiresBoardReview: boolean;
  isActive: boolean;
}

export const useRiskAppetites = () =>
  useQuery<RiskAppetite[]>({
    queryKey: ['risk', 'appetite'],
    queryFn: () => getArray<RiskAppetite>('/risk/appetite'),
    staleTime: CONFIG_STALE,
  });

export const useCreateAppetite = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AppetiteUpsert) => post<RiskAppetite>('/risk/appetite', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['risk', 'appetite'] }),
  });
};

export const useUpdateAppetite = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AppetiteUpsert) => put<RiskAppetite>(`/risk/appetite/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['risk', 'appetite'] }),
  });
};

export const useDeleteAppetite = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`/risk/appetite/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['risk', 'appetite'] }),
  });
};
