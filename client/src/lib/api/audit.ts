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
  useQuery<{ data: AuditProgram[] }>({
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
