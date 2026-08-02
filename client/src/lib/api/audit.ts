/**
 * Audit module API client — covers the AuditMaster → AuditRegister → AuditProgram
 * → AuditFinding → NonConformance flow. Backend routes are mounted under /api/audit/*.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ── Enums (mirror the Prisma enums in backend/prisma/schema.prisma) ──
export type AuditType =
  | 'INTERNAL'
  | 'EXTERNAL'
  | 'SUPPLIER'
  | 'PROCESS'
  | 'PRODUCT'
  | 'SYSTEM'
  | 'COMPLIANCE';

export type AuditFrequency =
  | 'ONE_TIME'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'HALF_YEARLY'
  | 'ANNUAL';

export type AuditStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CLOSED'
  | 'CANCELLED';

export type ProgramStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type FindingSeverity = 'OBSERVATION' | 'MINOR' | 'MAJOR' | 'CRITICAL';
export type FindingStatus = 'OPEN' | 'IN_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'CLOSED';
export type NonConformanceStatus =
  | 'OPEN'
  | 'CAPA_RAISED'
  | 'IN_PROGRESS'
  | 'VERIFICATION'
  | 'CLOSED'
  | 'CANCELLED';

export interface NamedRef {
  id: string | number;
  name: string;
}

interface IdName {
  id: string;
  name: string;
}

// ── Audit Master ──
export interface ChecklistRef {
  id: string;
  title: string;
}

export interface AuditMaster {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  audit_type: AuditType;
  frequency: AuditFrequency;
  default_iso_standard: IdName | null;
  default_checklist_form: { id: string; title: string } | null;
  checklist_forms: ChecklistRef[];
  scoring_rules: unknown;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditMasterUpsert {
  name: string;
  description?: string | null;
  audit_type: AuditType;
  frequency: AuditFrequency;
  default_iso_standard_id?: string | null;
  checklist_forms?: ChecklistRef[];
  scoring_rules?: unknown;
  is_active?: boolean;
}

// ── Focus Area / Audit Type (simple lookup masters) ──
export interface LookupMaster {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LookupMasterUpsert {
  name: string;
  description?: string | null;
  is_active?: boolean;
}

// ── Audit Register ──
export interface ChecklistAssignment {
  checklist_form_id: string;
  checklist_title: string;
  members: NamedRef[];
}

export interface AuditRegister {
  id: string;
  register_number: string;
  title: string;
  status: AuditStatus;
  audit_master: { id: string; code: string; name: string } | null;
  /** Free-form, sourced from the configured Audit Type master. */
  audit_type: string;
  plant: string | null;
  description: string | null;
  planned_date: string;
  previous_audit_date: string | null;
  financial_year: string | null;
  audit_method: string | null;
  iso_standard: IdName | null;
  locations: NamedRef[];
  main_processes: NamedRef[];
  sub_processes: NamedRef[];
  criteria: NamedRef[];
  departments: NamedRef[];
  focus_areas: NamedRef[];
  team_members: NamedRef[];
  checklist_assignments: ChecklistAssignment[];
  checklist_form: { id: string; title: string; kind?: string } | null;
  workflow_id: string | null;
  workflow_ticket_id: string | null;
  workflow_ticket_unique_id: string | null;
  auditor: IdName | null;
  approver: IdName | null;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: IdName | null;
  rejection_reason: string | null;
  program: { id: string; programNumber: string; status: ProgramStatus } | null;
  created_by: IdName | null;
  created_at: string;
  updated_at: string;
}

export interface AuditRegisterUpsert {
  title: string;
  audit_master_id?: string | null;
  audit_type: string;
  plant?: string | null;
  description?: string | null;
  planned_date: string;
  previous_audit_date?: string | null;
  financial_year?: string | null;
  audit_method?: string | null;
  iso_standard_id?: string | null;
  locations?: NamedRef[];
  main_processes?: NamedRef[];
  sub_processes?: NamedRef[];
  criteria?: NamedRef[];
  departments?: NamedRef[];
  focus_areas?: NamedRef[];
  team_members?: NamedRef[];
  checklist_assignments?: ChecklistAssignment[];
  checklist_form_id?: string | null;
  auditor_id?: string | null;
  approver_id?: string | null;
  workflow_id?: string | null;
}

// ── Audit Program ──
export interface AuditFinding {
  id: string;
  finding_number: string;
  severity: FindingSeverity;
  status: FindingStatus;
  clause_ref: string | null;
  description: string;
  evidence: unknown;
  recommendation: string | null;
  iso_sub_clause: { id: string; subClauseNumber: string; subClauseTitle: string } | null;
  non_conformance: { id: string; ncNumber: string; status: NonConformanceStatus } | null;
  program?: { id: string; programNumber: string } | null;
  created_at: string;
}

export interface AuditProgram {
  id: string;
  program_number: string;
  status: ProgramStatus;
  started_at: string | null;
  completed_at: string | null;
  summary: string | null;
  score: number | null;
  checklist_submission_id: string | null;
  register: {
    id: string;
    register_number: string;
    title: string;
    planned_date: string;
    financial_year: string | null;
    audit_type: AuditType;
    plant: string | null;
    auditor: IdName | null;
    checklist_form: { id: string; title: string; kind?: string } | null;
    iso_standard: IdName | null;
  };
  findings?: AuditFinding[];
  findings_count: number;
  created_at: string;
  updated_at: string;
}

// ── Finding upsert ──
export interface FindingUpsert {
  program_id: string;
  severity: FindingSeverity;
  status?: FindingStatus;
  clause_ref?: string | null;
  iso_sub_clause_id?: string | null;
  description: string;
  evidence?: unknown;
  recommendation?: string | null;
}

// ── Non-conformance ──
export interface NonConformance {
  id: string;
  nc_number: string;
  status: NonConformanceStatus;
  severity: FindingSeverity;
  track: string | null;
  due_date: string | null;
  closed_at: string | null;
  finding: {
    id: string;
    findingNumber: string;
    description?: string;
    severity?: FindingSeverity;
    program?: {
      id: string;
      programNumber: string;
      register?: { id: string; title: string; registerNumber: string } | null;
    } | null;
  };
  department: { id: string; name: string; code?: string } | null;
  capa_ticket: { id: string; uniqueId: string; title: string } | null;
  capa: { id: string; capaNumber: string; status: NonConformanceStatus | string } | null;
  created_at: string;
  updated_at: string;
}

// ── Query keys ──
export const auditKeys = {
  masters: (q: ListMasterQuery = {}) => ['audit', 'masters', q] as const,
  focusAreas: (q: ListLookupQuery = {}) => ['audit', 'focus-areas', q] as const,
  auditTypes: (q: ListLookupQuery = {}) => ['audit', 'audit-types', q] as const,
  registers: (q: ListRegisterQuery = {}) => ['audit', 'registers', q] as const,
  register: (id: string) => ['audit', 'registers', id] as const,
  programs: (q: ListProgramQuery = {}) => ['audit', 'programs', q] as const,
  program: (id: string) => ['audit', 'programs', id] as const,
  findings: (q: ListFindingQuery = {}) => ['audit', 'findings', q] as const,
  ncs: (q: ListNcQuery = {}) => ['audit', 'non-conformances', q] as const,
  complianceResults: (q: Record<string, string> = {}) =>
    ['audit', 'compliance-results', q] as const,
  capas: (q: ListCapaQuery = {}) => ['audit', 'capas', q] as const,
  capa: (id: string) => ['audit', 'capas', id] as const,
  actionItems: (q: ListActionItemQuery = {}) => ['audit', 'action-items', q] as const,
};

// ── Query interfaces ──
export interface ListMasterQuery {
  page?: number;
  page_size?: number;
  audit_type?: AuditType;
  is_active?: boolean;
  search?: string;
}
export interface ListLookupQuery {
  page?: number;
  page_size?: number;
  is_active?: boolean;
  search?: string;
}
export interface ListRegisterQuery {
  page?: number;
  page_size?: number;
  status?: AuditStatus;
  audit_type?: string;
  financial_year?: string;
  search?: string;
}
export interface ListProgramQuery {
  page?: number;
  page_size?: number;
  status?: ProgramStatus;
  financial_year?: string;
  search?: string;
}
export interface ListFindingQuery {
  program_id?: string;
  status?: FindingStatus;
  severity?: FindingSeverity;
}
export interface ListNcQuery {
  status?: NonConformanceStatus;
  track?: string;
  department_id?: string;
  severity?: FindingSeverity;
}

interface PaginatedResp<T> {
  data: T[];
  pagination?: { total_items: number; page: number; page_size: number };
}

// ─────────────────────────────── ISO Standards (lookup) ────────────────────

export interface IsoSubClauseDto {
  id?: string;
  sub_clause_number: string;
  sub_clause_title: string;
  requirement_text?: string | null;
  position?: number;
}
export interface IsoClauseDto {
  id?: string;
  clause_number: string;
  clause_title: string;
  position?: number;
  sub_clauses: IsoSubClauseDto[];
}

export interface IsoStandardSummary {
  id: string;
  name: string;
  remarks: string | null;
  is_active: boolean;
  clauses_count: number;
  clauses: IsoClauseDto[];
}

export interface IsoStandardUpsert {
  name: string;
  remarks?: string | null;
  is_active?: boolean;
  clauses: IsoClauseDto[];
}

export const useIsoStandards = () =>
  useQuery<{ data: IsoStandardSummary[] }>({
    queryKey: ['iso-standards', 'list'],
    queryFn: () =>
      api
        .get('/get_complete_iso_standards', { params: { page: 1, page_size: 200 } })
        .then((r) => r.data),
  });

export const useCreateIsoStandard = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: IsoStandardUpsert) =>
      api.post('/add_iso_standard', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['iso-standards'] }),
  });
};

export const useUpdateIsoStandard = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: IsoStandardUpsert) =>
      api.put(`/update_iso_standard/${id}/`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['iso-standards'] }),
  });
};

export const useDeleteIsoStandard = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/delete_iso_standard/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['iso-standards'] }),
  });
};

// ─────────────────────────────── Audit Master ───────────────────────────────

export const useAuditMasters = (q: ListMasterQuery = {}) =>
  useQuery<PaginatedResp<AuditMaster>>({
    queryKey: auditKeys.masters(q),
    queryFn: () => api.get('/audit/masters', { params: q }).then((r) => r.data),
  });

export const useCreateAuditMaster = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AuditMasterUpsert) =>
      api.post('/audit/masters', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit', 'masters'] }),
  });
};

export const useUpdateAuditMaster = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AuditMasterUpsert) =>
      api.put(`/audit/masters/${id}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit', 'masters'] }),
  });
};

export const useDeleteAuditMaster = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/audit/masters/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit', 'masters'] }),
  });
};

// ─────────────────────────────── Focus Area ─────────────────────────────────

export const useFocusAreas = (q: ListLookupQuery = {}) =>
  useQuery<PaginatedResp<LookupMaster>>({
    queryKey: auditKeys.focusAreas(q),
    queryFn: () => api.get('/audit/focus-areas', { params: q }).then((r) => r.data),
  });

export const useCreateFocusArea = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LookupMasterUpsert) =>
      api.post('/audit/focus-areas', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit', 'focus-areas'] }),
  });
};

export const useUpdateFocusArea = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LookupMasterUpsert) =>
      api.put(`/audit/focus-areas/${id}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit', 'focus-areas'] }),
  });
};

export const useDeleteFocusArea = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/audit/focus-areas/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit', 'focus-areas'] }),
  });
};

// ─────────────────────────────── Audit Type ─────────────────────────────────

export const useAuditTypes = (q: ListLookupQuery = {}) =>
  useQuery<PaginatedResp<LookupMaster>>({
    queryKey: auditKeys.auditTypes(q),
    queryFn: () => api.get('/audit/audit-types', { params: q }).then((r) => r.data),
  });

export const useCreateAuditType = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LookupMasterUpsert) =>
      api.post('/audit/audit-types', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit', 'audit-types'] }),
  });
};

export const useUpdateAuditType = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LookupMasterUpsert) =>
      api.put(`/audit/audit-types/${id}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit', 'audit-types'] }),
  });
};

export const useDeleteAuditType = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/audit/audit-types/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit', 'audit-types'] }),
  });
};

// ─────────────────────────────── Audit Register ─────────────────────────────

export const useAuditRegisters = (q: ListRegisterQuery = {}) =>
  useQuery<PaginatedResp<AuditRegister>>({
    queryKey: auditKeys.registers(q),
    queryFn: () => api.get('/audit/registers', { params: q }).then((r) => r.data),
  });

export const useAuditRegister = (id: string | undefined) =>
  useQuery<{ data: AuditRegister }>({
    queryKey: auditKeys.register(id ?? ''),
    queryFn: () => api.get(`/audit/registers/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useCreateAuditRegister = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AuditRegisterUpsert) =>
      api.post('/audit/registers', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit', 'registers'] }),
  });
};

export const useUpdateAuditRegister = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AuditRegisterUpsert) =>
      api.put(`/audit/registers/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit', 'registers'] });
    },
  });
};

export const useSubmitAuditRegister = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post(`/audit/registers/${id}/submit`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit', 'registers'] }),
  });
};

export const useApproveAuditRegister = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post(`/audit/registers/${id}/approve`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit', 'registers'] });
      qc.invalidateQueries({ queryKey: ['audit', 'programs'] });
    },
  });
};

export const useRejectAuditRegister = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/audit/registers/${id}/reject`, { reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit', 'registers'] }),
  });
};

export const useDeleteAuditRegister = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/audit/registers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit', 'registers'] }),
  });
};

// ─────────────────────────────── Audit Program ──────────────────────────────

export const useAuditPrograms = (q: ListProgramQuery = {}) =>
  useQuery<PaginatedResp<AuditProgram> & { counts?: Record<string, number> }>({
    queryKey: auditKeys.programs(q),
    queryFn: () => api.get('/audit/programs', { params: q }).then((r) => r.data),
  });

export const useAuditProgram = (id: string | undefined) =>
  useQuery<{ data: AuditProgram }>({
    queryKey: auditKeys.program(id ?? ''),
    queryFn: () => api.get(`/audit/programs/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useStartAuditProgram = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post(`/audit/programs/${id}/start`, {}).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit', 'programs'] });
      qc.invalidateQueries({ queryKey: ['audit', 'registers'] });
    },
  });
};

export const useCompleteAuditProgram = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      summary,
      score,
      checklist_submission_id,
    }: {
      id: string;
      summary?: string | null;
      score?: number | null;
      checklist_submission_id?: string | null;
    }) =>
      api
        .post(`/audit/programs/${id}/complete`, {
          summary,
          score,
          checklist_submission_id,
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit', 'programs'] });
      qc.invalidateQueries({ queryKey: ['audit', 'registers'] });
    },
  });
};

// ─────────────────────────────── Findings ───────────────────────────────────

export const useFindings = (q: ListFindingQuery = {}) =>
  useQuery<{ data: AuditFinding[] }>({
    queryKey: auditKeys.findings(q),
    queryFn: () => api.get('/audit/findings', { params: q }).then((r) => r.data),
  });

export const useCreateFinding = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FindingUpsert) =>
      api.post('/audit/findings', body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit', 'findings'] });
      qc.invalidateQueries({ queryKey: ['audit', 'programs'] });
    },
  });
};

export const useUpdateFinding = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FindingUpsert) =>
      api.put(`/audit/findings/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit', 'findings'] });
      qc.invalidateQueries({ queryKey: ['audit', 'programs'] });
    },
  });
};

export const useDeleteFinding = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/audit/findings/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit', 'findings'] });
      qc.invalidateQueries({ queryKey: ['audit', 'programs'] });
    },
  });
};

// ─────────────────────────────── Non-Conformance ────────────────────────────

export const useNonConformances = (q: ListNcQuery = {}) =>
  useQuery<{ data: NonConformance[] }>({
    queryKey: auditKeys.ncs(q),
    queryFn: () =>
      api.get('/audit/non-conformances', { params: q }).then((r) => r.data),
  });

// Every checklist compliance disposition from closed audit tickets — powers the
// read-only "All Results" view on the Non-Conformance tab.
export type ComplianceResult =
  | 'COMPLIANT'
  | 'NON_CONFORMANCE'
  | 'OBSERVATION'
  | 'NOT_APPLICABLE';

export interface ComplianceResultRow {
  id: string;
  result: ComplianceResult;
  label: string;
  section: string;
  ticket_id: string;
  audit: { register_id: string; program_id: string; title: string; register_number: string };
  auditor: { id: string; name: string } | null;
  nc: { id: string; nc_number: string; status: NonConformanceStatus } | null;
}

export const useComplianceResults = (q: Record<string, string> = {}) =>
  useQuery<{ data: ComplianceResultRow[] }>({
    queryKey: auditKeys.complianceResults(q),
    queryFn: () =>
      api.get('/audit/compliance-results', { params: q }).then((r) => r.data),
  });

// Every CAPA raised from a non-conformance of this audit register — the
// audit ticket's child corrective actions.
export const useRegisterCapas = (registerId: string | undefined) =>
  useQuery<{ data: Capa[] }>({
    queryKey: ['audit', 'register-capas', registerId] as const,
    enabled: !!registerId,
    queryFn: () =>
      api.get(`/audit/registers/${registerId}/capas`).then((r) => r.data),
  });

export const usePromoteFindingToNc = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      findingId,
      track,
      department_id,
      due_date,
    }: {
      findingId: string;
      track?: string | null;
      department_id?: string | null;
      due_date?: string | null;
    }) =>
      api
        .post(`/audit/findings/${findingId}/promote-nc`, {
          track,
          department_id,
          due_date,
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit', 'findings'] });
      qc.invalidateQueries({ queryKey: ['audit', 'non-conformances'] });
    },
  });
};

export const useRaiseCapa = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, capa_ticket_id }: { id: string; capa_ticket_id: string }) =>
      api
        .post(`/audit/non-conformances/${id}/raise-capa`, { capa_ticket_id })
        .then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['audit', 'non-conformances'] }),
  });
};

export const useUpdateNcStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      closed_at,
    }: {
      id: string;
      status: NonConformanceStatus;
      closed_at?: string | null;
    }) =>
      api
        .patch(`/audit/non-conformances/${id}/status`, { status, closed_at })
        .then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['audit', 'non-conformances'] }),
  });
};

// ─────────────────────────────── Audit report ───────────────────────────────

export interface AuditReport {
  generated_at: string;
  register: {
    register_number: string;
    title: string;
    status: AuditStatus;
    audit_type: string;
    plant: string | null;
    planned_date: string;
    financial_year: string | null;
    audit_method: string | null;
    iso_standard: string | null;
    audit_master: string | null;
    auditor: string | null;
    approver: string | null;
    approved_by: string | null;
    approved_at: string | null;
    created_by: string | null;
    description: string | null;
  };
  program: {
    program_number: string;
    status: ProgramStatus;
    started_at: string | null;
    completed_at: string | null;
    summary: string | null;
    score: number | null;
  } | null;
  summary: { total_findings: number; by_severity: Record<string, number> };
  findings: Array<{
    finding_number: string;
    severity: FindingSeverity;
    status: FindingStatus;
    clause_ref: string | null;
    description: string;
    recommendation: string | null;
    non_conformance: {
      nc_number: string;
      status: NonConformanceStatus;
      department: string | null;
      capa: {
        capa_number: string;
        status: CapaStatus;
        type: CapaType;
        root_cause: string | null;
        corrective_action: string | null;
        preventive_action: string | null;
        owner: string | null;
      } | null;
    } | null;
  }>;
  signatures: Array<{ meaning: string; user_name: string; signed_at: string }>;
}

export const useAuditReport = (registerId: string | undefined) =>
  useQuery<{ data: AuditReport }>({
    queryKey: ['audit', 'report', registerId ?? ''],
    queryFn: () => api.get(`/audit/registers/${registerId}/report`).then((r) => r.data),
    enabled: !!registerId,
  });

// ─────────────────────────────── Compliance: trail + e-signatures ───────────

export interface TrailEntry {
  id: string;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  user_name: string;
  created_at: string;
}

export interface SignatureEntry {
  id: string;
  meaning: string;
  user_name: string;
  signed_at: string;
}

export const useAuditTrail = (entityType: string, entityId: string | undefined) =>
  useQuery<{ data: TrailEntry[] }>({
    queryKey: ['audit', 'trail', entityType, entityId ?? ''],
    queryFn: () => api.get(`/audit/trail/${entityType}/${entityId}`).then((r) => r.data),
    enabled: !!entityId,
  });

export const useSignatures = (entityType: string, entityId: string | undefined) =>
  useQuery<{ data: SignatureEntry[] }>({
    queryKey: ['audit', 'signatures', entityType, entityId ?? ''],
    queryFn: () => api.get(`/audit/signatures/${entityType}/${entityId}`).then((r) => r.data),
    enabled: !!entityId,
  });

export const useSignEntity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      entity_type: string;
      entity_id: string;
      meaning: string;
      credential: string;
    }) => api.post('/audit/signatures', body).then((r) => r.data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['audit', 'signatures', vars.entity_type, vars.entity_id] });
      qc.invalidateQueries({ queryKey: ['audit', 'trail', vars.entity_type, vars.entity_id] });
    },
  });
};

// ─────────────────────────────── Schedule rules + calendar ──────────────────

export interface AuditScheduleRule {
  id: string;
  name: string;
  audit_master: { id: string; name: string; code: string | null; auditType: string } | null;
  frequency: AuditFrequency;
  anchor_date: string;
  lead_time_days: number;
  plant: string | null;
  default_auditor_id: string | null;
  workflow_id: string | null;
  checklist_form_id: string | null;
  is_active: boolean;
  last_spawned_at: string | null;
  next_run_at: string;
  created_at: string;
  updated_at: string;
}

export interface AuditScheduleRuleUpsert {
  name: string;
  audit_master_id: string;
  frequency: AuditFrequency;
  anchor_date: string;
  lead_time_days?: number;
  plant?: string | null;
  default_auditor_id?: string | null;
  workflow_id?: string | null;
  checklist_form_id?: string | null;
  is_active?: boolean;
}

export interface CalendarAudit {
  id: string;
  register_number: string;
  title: string;
  status: AuditStatus;
  audit_type: string;
  planned_date: string;
}

export const useScheduleRules = () =>
  useQuery<{ data: AuditScheduleRule[] }>({
    queryKey: ['audit', 'schedule-rules'],
    queryFn: () => api.get('/audit/schedule-rules').then((r) => r.data),
  });

export const useCreateScheduleRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AuditScheduleRuleUpsert) =>
      api.post('/audit/schedule-rules', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit', 'schedule-rules'] }),
  });
};

export const useUpdateScheduleRule = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AuditScheduleRuleUpsert) =>
      api.put(`/audit/schedule-rules/${id}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit', 'schedule-rules'] }),
  });
};

export const useDeleteScheduleRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/audit/schedule-rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit', 'schedule-rules'] }),
  });
};

export const useRunScheduleSweep = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/audit/schedule-rules/run-now').then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit', 'schedule-rules'] });
      qc.invalidateQueries({ queryKey: ['audit', 'registers'] });
      qc.invalidateQueries({ queryKey: ['audit', 'calendar'] });
    },
  });
};

export const useAuditCalendar = (from?: string, to?: string) =>
  useQuery<{ data: CalendarAudit[] }>({
    queryKey: ['audit', 'calendar', from ?? '', to ?? ''],
    queryFn: () =>
      api.get('/audit/calendar', { params: { from, to } }).then((r) => r.data),
  });

// ─────────────────────────────── Dashboard ──────────────────────────────────

export interface AuditDashboard {
  kpis: {
    total_audits: number;
    completed_audits: number;
    completion_rate: number;
    in_progress_audits: number;
    open_findings: number;
    open_ncs: number;
    open_capas: number;
    overdue_capas: number;
    open_actions: number;
    overdue_actions: number;
    overdue_ncs: number;
  };
  registers_by_status: Record<string, number>;
  programs_by_status: Record<string, number>;
  findings_by_severity: Record<string, number>;
  findings_by_status: Record<string, number>;
  ncs_by_status: Record<string, number>;
  capas_by_status: Record<string, number>;
  capas_by_type: Record<string, number>;
  actions_by_status: Record<string, number>;
  ncs_by_department: Array<{ name: string; value: number }>;
  monthly_trend: Array<{ month: string; planned: number; completed: number }>;
  findings_trend: Array<{ month: string; findings: number }>;
  filter_options: {
    financial_years: string[];
    plants: string[];
    audit_types: string[];
    statuses: string[];
  };
  upcoming_audits: Array<{
    id: string;
    register_number: string;
    title: string;
    planned_date: string;
    status: AuditStatus;
  }>;
  recent_findings: Array<{
    id: string;
    finding_number: string;
    severity: FindingSeverity;
    status: FindingStatus;
    description: string;
    audit_title: string | null;
    program_id: string | null;
    created_at: string;
  }>;
}

export interface AuditDashboardFilters {
  financialYear?: string;
  plant?: string;
  auditType?: string;
  status?: string;
}

export const useAuditDashboard = (filters: AuditDashboardFilters = {}) =>
  useQuery<{ data: AuditDashboard }>({
    queryKey: ['audit', 'dashboard', filters],
    queryFn: () =>
      api
        .get('/audit/dashboard', {
          params: {
            ...(filters.financialYear ? { financial_year: filters.financialYear } : {}),
            ...(filters.plant ? { plant: filters.plant } : {}),
            ...(filters.auditType ? { audit_type: filters.auditType } : {}),
            ...(filters.status ? { status: filters.status } : {}),
          },
        })
        .then((r) => r.data),
  });

// ─────────────────────────────── CAPA (first-class) ─────────────────────────

export type CapaType = 'CORRECTIVE' | 'PREVENTIVE' | 'BOTH';
export type CapaStatus =
  | 'OPEN'
  | 'INVESTIGATION'
  | 'PLAN'
  | 'IMPLEMENTATION'
  | 'VERIFICATION'
  | 'CLOSED'
  | 'CANCELLED';

export type CapaSource = 'AUDIT' | 'FINDING' | 'RISK' | 'OOS' | 'CALIBRATION' | 'MANUAL';

/** Origin labels + badge classes, shared by the list and detail views. */
export const CAPA_SOURCE_BADGE: Record<CapaSource, { label: string; cls: string }> = {
  AUDIT: { label: 'Audit', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  FINDING: { label: 'Finding', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  RISK: { label: 'Risk', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  OOS: { label: 'OOS', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  CALIBRATION: { label: 'Calibration', cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  MANUAL: { label: 'Manual', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
};

export interface Capa {
  id: string;
  source: CapaSource;
  source_ref: string | null;
  capa_number: string;
  type: CapaType;
  status: CapaStatus;
  title: string;
  description: string | null;
  non_conformance: {
    id: string;
    ncNumber: string;
    status: NonConformanceStatus;
    severity: FindingSeverity;
    finding: { id: string; findingNumber: string; description: string } | null;
  } | null;
  root_cause: string | null;
  root_cause_data: unknown;
  corrective_action: string | null;
  preventive_action: string | null;
  owner: IdName | null;
  department: { id: string; name: string; code?: string } | null;
  due_date: string | null;
  implemented_at: string | null;
  verified_by: IdName | null;
  verified_at: string | null;
  effectiveness_check: string | null;
  effectiveness_due: string | null;
  effectiveness_data: unknown;
  closed_at: string | null;
  workflow_id: string | null;
  workflow_ticket_id: string | null;
  workflow_ticket_unique_id: string | null;
  action_item_count: number;
  created_by: IdName | null;
  created_at: string;
  updated_at: string;
}

export interface ListCapaQuery {
  page?: number;
  page_size?: number;
  /** Comma-separated origins. Omitted means every source. */
  source?: string;
  status?: CapaStatus;
  type?: CapaType;
  owner_id?: string;
  department_id?: string;
  search?: string;
}

export interface CapaCreate {
  title: string;
  description?: string | null;
  type?: CapaType;
  non_conformance_id?: string | null;
  owner_id?: string | null;
  department_id?: string | null;
  due_date?: string | null;
}

export interface CapaUpdate {
  title?: string;
  description?: string | null;
  type?: CapaType;
  root_cause?: string | null;
  root_cause_data?: unknown;
  corrective_action?: string | null;
  preventive_action?: string | null;
  owner_id?: string | null;
  department_id?: string | null;
  due_date?: string | null;
  effectiveness_check?: string | null;
  effectiveness_due?: string | null;
  effectiveness_data?: unknown;
}

export const useCapas = (q: ListCapaQuery = {}) =>
  useQuery<PaginatedResp<Capa>>({
    queryKey: auditKeys.capas(q),
    queryFn: () => api.get('/audit/capas', { params: q }).then((r) => r.data),
  });

// The detail endpoint returns the bare CAPA object (not a { data } envelope).
export const useCapa = (id: string | undefined) =>
  useQuery<Capa>({
    queryKey: auditKeys.capa(id ?? ''),
    queryFn: () => api.get(`/audit/capas/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useCreateCapa = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CapaCreate) => api.post('/audit/capas', body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit', 'capas'] });
      qc.invalidateQueries({ queryKey: ['audit', 'non-conformances'] });
    },
  });
};

export const useUpdateCapa = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CapaUpdate) => api.put(`/audit/capas/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit', 'capas'] });
    },
  });
};

export const useUpdateCapaStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: CapaStatus }) =>
      api.patch(`/audit/capas/${id}/status`, { status }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit', 'capas'] });
      qc.invalidateQueries({ queryKey: ['audit', 'non-conformances'] });
    },
  });
};

export const useDeleteCapa = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/audit/capas/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit', 'capas'] }),
  });
};

// Raise + link the CAPA workflow ticket for a CAPA that doesn't have one yet.
export const useAttachCapaWorkflow = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/audit/capas/${id}/workflow`).then((r) => r.data),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['audit', 'capas'] });
      qc.invalidateQueries({ queryKey: auditKeys.capa(id) });
    },
  });
};

// ─────────────────────────────── Action Items ───────────────────────────────

export type ActionItemStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'VERIFIED' | 'CANCELLED';
export type ActionItemPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ActionItem {
  id: string;
  action_number: string;
  title: string;
  description: string | null;
  status: ActionItemStatus;
  priority: ActionItemPriority;
  owner: IdName | null;
  due_date: string | null;
  completed_at: string | null;
  capa: { id: string; capaNumber: string; title: string } | null;
  non_conformance: { id: string; ncNumber: string } | null;
  finding: { id: string; findingNumber: string } | null;
  created_by: IdName | null;
  created_at: string;
  updated_at: string;
}

export interface ListActionItemQuery {
  page?: number;
  page_size?: number;
  status?: ActionItemStatus;
  priority?: ActionItemPriority;
  owner_id?: string;
  capa_id?: string;
  non_conformance_id?: string;
  finding_id?: string;
  search?: string;
}

export interface ActionItemUpsert {
  title: string;
  description?: string | null;
  status?: ActionItemStatus;
  priority?: ActionItemPriority;
  owner_id?: string | null;
  due_date?: string | null;
  capa_id?: string | null;
  non_conformance_id?: string | null;
  finding_id?: string | null;
}

export const useActionItems = (q: ListActionItemQuery = {}) =>
  useQuery<PaginatedResp<ActionItem>>({
    queryKey: auditKeys.actionItems(q),
    queryFn: () => api.get('/audit/action-items', { params: q }).then((r) => r.data),
  });

export const useCreateActionItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ActionItemUpsert) =>
      api.post('/audit/action-items', body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit', 'action-items'] });
      qc.invalidateQueries({ queryKey: ['audit', 'capas'] });
    },
  });
};

export const useUpdateActionItem = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ActionItemUpsert) =>
      api.put(`/audit/action-items/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit', 'action-items'] });
      qc.invalidateQueries({ queryKey: ['audit', 'capas'] });
    },
  });
};

export const useUpdateActionItemStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ActionItemStatus }) =>
      api.patch(`/audit/action-items/${id}/status`, { status }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit', 'action-items'] }),
  });
};

export const useDeleteActionItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/audit/action-items/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit', 'action-items'] }),
  });
};
