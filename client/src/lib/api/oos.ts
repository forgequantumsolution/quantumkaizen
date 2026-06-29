/**
 * LIMS 2.0 — OOS/OOT Investigations API client. Backend: /api/oos.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type OosPhase = 'PHASE_1A' | 'PHASE_1B' | 'PHASE_2' | 'CLOSED';
export type OosStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
export type OosClassification = 'LAB_ERROR' | 'NON_LAB_ERROR' | 'CONFIRMED_OOS' | 'INVALIDATED';

export interface Investigation {
  id: string;
  code: string;
  title: string;
  sample_id: string | null;
  sample_test_id: string | null;
  result_id: string | null;
  phase: OosPhase;
  status: OosStatus;
  classification: string | null;
  hypothesis: string | null;
  investigation_summary: string | null;
  retest_required: boolean;
  resample_required: boolean;
  conclusion: string | null;
  capa_id: string | null;
  capa?: { id: string; capa_number: string; status: string } | null;
  capa_ticket?: { id: string; unique_id: string | null } | null;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CapaInitField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  options: { label: string; value: string }[];
}
export interface CapaInitForm {
  form_id: string;
  title: string;
  sections: { name: string; fields: CapaInitField[] }[];
}

export interface CreateCapaFromOosBody {
  title?: string;
  description?: string | null;
  type?: 'CORRECTIVE' | 'PREVENTIVE' | 'BOTH';
  owner_id?: string | null;
  due_date?: string | null;
  init_form_id?: string | null;
  // { sectionName: { fieldName: value } }
  init_responses?: Record<string, Record<string, unknown>>;
}
export interface CreateCapaFromOosResponse {
  investigation: Investigation;
  capa: { id: string; capa_number: string };
  capa_ticket: { id: string; unique_id: string | null } | null;
}

export interface OpenInvestigationBody {
  title: string;
  sample_id?: string | null;
  sample_test_id?: string | null;
  result_id?: string | null;
}
export interface UpdateInvestigationBody {
  title?: string;
  hypothesis?: string | null;
  investigation_summary?: string | null;
  retest_required?: boolean;
  resample_required?: boolean;
  classification?: string | null;
}
export interface AdvancePhaseBody {
  phase: 'PHASE_1B' | 'PHASE_2' | 'CLOSED';
  investigation_summary?: string | null;
  remarks?: string | null;
}
export interface CloseInvestigationBody {
  classification: OosClassification;
  conclusion?: string | null;
  capa_id?: string | null;
  credential?: string | null;
}

const keys = {
  all: ['oos'] as const,
  list: (p: object) => ['oos', 'list', p] as const,
  detail: (id: string) => ['oos', id] as const,
};

export const useInvestigations = (
  params: { status?: OosStatus; phase?: OosPhase; sample_id?: string; search?: string } = {},
) =>
  useQuery<{ data: Investigation[] }>({
    queryKey: keys.list(params),
    queryFn: () => api.get('/oos', { params }).then((r) => r.data),
  });

export const useInvestigation = (id: string | undefined) =>
  useQuery<Investigation>({
    queryKey: keys.detail(id ?? ''),
    queryFn: () => api.get(`/oos/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useOpenInvestigation = () => {
  const qc = useQueryClient();
  return useMutation<Investigation, unknown, OpenInvestigationBody>({
    mutationFn: (b) => api.post('/oos', b).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useUpdateInvestigation = (id: string) => {
  const qc = useQueryClient();
  return useMutation<Investigation, unknown, UpdateInvestigationBody>({
    mutationFn: (b) => api.put(`/oos/${id}`, b).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useAdvancePhase = (id: string) => {
  const qc = useQueryClient();
  return useMutation<Investigation, unknown, AdvancePhaseBody>({
    mutationFn: (b) => api.post(`/oos/${id}/advance`, b).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useCloseInvestigation = (id: string) => {
  const qc = useQueryClient();
  return useMutation<Investigation, unknown, CloseInvestigationBody>({
    mutationFn: (b) => api.post(`/oos/${id}/close`, b).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

// The CAPA workflow's initiation-stage form schema (for the Raise-CAPA modal).
export const useCapaInitForm = (enabled: boolean) =>
  useQuery<{ form: CapaInitForm | null }>({
    queryKey: ['oos', 'capa-init-form'],
    queryFn: () => api.get('/oos/capa-init-form').then((r) => r.data),
    enabled,
    staleTime: 5 * 60_000,
  });

// LIMS → QMS bridge: raise a CAPA from this OOS investigation and link it.
export const useCreateCapaFromOos = (id: string) => {
  const qc = useQueryClient();
  return useMutation<CreateCapaFromOosResponse, unknown, CreateCapaFromOosBody>({
    mutationFn: (b) => api.post(`/oos/${id}/capa`, b).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all });
      qc.invalidateQueries({ queryKey: ['audit', 'capas'] });
    },
  });
};

export const PHASE_LABELS: Record<OosPhase, string> = {
  PHASE_1A: 'Phase 1A — Lab',
  PHASE_1B: 'Phase 1B',
  PHASE_2: 'Phase 2',
  CLOSED: 'Closed',
};

export const STATUS_BADGE: Record<OosStatus, string> = {
  OPEN: 'bg-blue-50 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  CLOSED: 'bg-gray-100 text-gray-500 border-gray-200',
};

export const CLASSIFICATION_LABELS: Record<OosClassification, string> = {
  LAB_ERROR: 'Lab Error',
  NON_LAB_ERROR: 'Non-Lab Error',
  CONFIRMED_OOS: 'Confirmed OOS',
  INVALIDATED: 'Invalidated',
};
