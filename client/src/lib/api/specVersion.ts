/**
 * LIMS 2.0 — L1 Spec Versions API client. Backend: /api/spec-versions.
 * Versioned, multi-stage specifications — the limit authority for result eval.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type SpecStage = 'RELEASE' | 'STABILITY' | 'IN_PROCESS' | 'RAW_MATERIAL';
export type SpecVersionStatus = 'DRAFT' | 'APPROVED' | 'SUPERSEDED' | 'RETIRED';

export interface SpecLine {
  id?: string;
  analyte_id: string | null;
  test_definition_id: string | null;
  name: string;
  unit: string | null;
  min_value: number | null;
  max_value: number | null;
  target_value: number | null;
  text_criteria: string | null;
  decimals: number | null;
  sig_figs: number | null;
  mandatory: boolean;
  sequence: number;
}

export interface SpecVersionSummary {
  id: string;
  code: string;
  specification_id: string | null;
  specification_label: string | null;
  product_id: string | null;
  product_name: string | null;
  name: string;
  stage: SpecStage;
  grade: string | null;
  market: string | null;
  version: number;
  status: SpecVersionStatus;
  pharmacopoeia: string | null;
  effective_date: string | null;
  approved_at: string | null;
  approved_by_id: string | null;
  line_count: number;
  created_at: string;
  updated_at: string;
}

export interface SpecVersion extends SpecVersionSummary {
  lines: SpecLine[];
}

export interface SpecVersionUpsert {
  name: string;
  product_id?: string | null;
  specification_id?: string | null;
  stage?: SpecStage;
  grade?: string | null;
  market?: string | null;
  pharmacopoeia?: string | null;
  lines: Array<Omit<SpecLine, 'id'>>;
}

export interface ListSpecVersionsParams {
  search?: string;
  stage?: SpecStage;
  status?: SpecVersionStatus;
  product_id?: string;
}

const keys = {
  all: ['spec-versions'] as const,
  list: (p: ListSpecVersionsParams) => ['spec-versions', 'list', p] as const,
  detail: (id: string) => ['spec-versions', id] as const,
};

export const useSpecVersions = (params: ListSpecVersionsParams = {}) =>
  useQuery<{ data: SpecVersionSummary[]; total: number }>({
    queryKey: keys.list(params),
    queryFn: () => api.get('/spec-versions', { params: { ...params, page_size: 200 } }).then((r) => r.data),
  });

export const useSpecVersion = (id: string | undefined) =>
  useQuery<SpecVersion>({
    queryKey: keys.detail(id ?? ''),
    queryFn: () => api.get(`/spec-versions/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useCreateSpecVersion = () => {
  const qc = useQueryClient();
  return useMutation<SpecVersion, unknown, SpecVersionUpsert>({
    mutationFn: (b) => api.post('/spec-versions', b).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useUpdateSpecVersion = (id: string) => {
  const qc = useQueryClient();
  return useMutation<SpecVersion, unknown, SpecVersionUpsert>({
    mutationFn: (b) => api.put(`/spec-versions/${id}`, b).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useApproveSpecVersion = (id: string) => {
  const qc = useQueryClient();
  return useMutation<SpecVersion, unknown, void>({
    mutationFn: () => api.post(`/spec-versions/${id}/approve`, {}).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useReviseSpecVersion = (id: string) => {
  const qc = useQueryClient();
  return useMutation<SpecVersion, unknown, void>({
    mutationFn: () => api.post(`/spec-versions/${id}/revise`, {}).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useDeleteSpecVersion = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => api.delete(`/spec-versions/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const SPEC_STAGE_LABELS: Record<SpecStage, string> = {
  RELEASE: 'Release',
  STABILITY: 'Stability',
  IN_PROCESS: 'In-Process',
  RAW_MATERIAL: 'Raw-Material',
};

export const SPEC_VERSION_STATUS_BADGE: Record<SpecVersionStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SUPERSEDED: 'bg-slate-100 text-slate-600 border-slate-200',
  RETIRED: 'bg-red-50 text-red-700 border-red-200',
};
