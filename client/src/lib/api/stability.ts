/**
 * LIMS 2.0 — Stability (ICH Q1A) API client. Backend: /api/stability.
 * Stability studies, storage conditions and the timepoint pull schedule.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type StudyStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type PullStatus = 'SCHEDULED' | 'DUE' | 'PULLED' | 'TESTED' | 'SKIPPED';

export interface Condition {
  id: string;
  name: string;
  temp_zone: string | null;
  storage_location_id: string | null;
  orientation: string | null;
}

export interface Pull {
  id: string;
  condition_id: string | null;
  condition_name: string | null;
  timepoint_label: string;
  timepoint_months: number;
  scheduled_date: string;
  status: PullStatus;
  sample_id: string | null;
  pulled_at: string | null;
  tested_at: string | null;
}

export interface StudySummary {
  id: string;
  code: string;
  title: string;
  product_name: string;
  batch_no: string | null;
  status: StudyStatus;
  start_date: string | null;
  timepoints_months: string;
  pull_count: number;
  created_at: string;
}

export interface Study extends StudySummary {
  product_id: string | null;
  spec_version_id: string | null;
  packaging: string | null;
  conditions: Condition[];
  pulls: Pull[];
}

export interface ConditionInput {
  name: string;
  temp_zone?: string | null;
  storage_location_id?: string | null;
  orientation?: string | null;
}

export interface StudyUpsert {
  product_name: string;
  product_id?: string | null;
  batch_no?: string | null;
  title: string;
  spec_version_id?: string | null;
  packaging?: string | null;
  timepoints_months?: string;
  conditions?: ConditionInput[];
}

export interface ListStudiesParams {
  status?: StudyStatus;
  search?: string;
}

const keys = {
  all: ['stability'] as const,
  list: (p: ListStudiesParams) => ['stability', 'list', p] as const,
  detail: (id: string) => ['stability', id] as const,
};

export const useStabilityStudies = (params: ListStudiesParams = {}) =>
  useQuery<{ data: StudySummary[] }>({
    queryKey: keys.list(params),
    queryFn: () => api.get('/stability', { params }).then((r) => r.data),
  });

export const useStabilityStudy = (id: string | undefined) =>
  useQuery<Study>({
    queryKey: keys.detail(id ?? ''),
    queryFn: () => api.get(`/stability/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useCreateStudy = () => {
  const qc = useQueryClient();
  return useMutation<Study, unknown, StudyUpsert>({
    mutationFn: (b) => api.post('/stability', b).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useAddCondition = (id: string) => {
  const qc = useQueryClient();
  return useMutation<Study, unknown, ConditionInput>({
    mutationFn: (b) => api.post(`/stability/${id}/conditions`, b).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useActivateStudy = (id: string) => {
  const qc = useQueryClient();
  return useMutation<Study, unknown, { start_date?: string | null }>({
    mutationFn: (b) => api.post(`/stability/${id}/activate`, b).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useCompleteStudy = (id: string) => {
  const qc = useQueryClient();
  return useMutation<Study, unknown, void>({
    mutationFn: () => api.post(`/stability/${id}/complete`, {}).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const usePullTimepoint = () => {
  const qc = useQueryClient();
  return useMutation<{ pull_id: string; sample_id: string; sample_number: string }, unknown, string>({
    mutationFn: (pullId) => api.post(`/stability/pulls/${pullId}/pull`, {}).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const STUDY_STATUS_BADGE: Record<StudyStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
  ACTIVE: 'bg-blue-50 text-blue-700 border-blue-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
};

export const PULL_STATUS_BADGE: Record<PullStatus, string> = {
  SCHEDULED: 'bg-gray-100 text-gray-700 border-gray-200',
  DUE: 'bg-amber-50 text-amber-700 border-amber-200',
  PULLED: 'bg-blue-50 text-blue-700 border-blue-200',
  TESTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SKIPPED: 'bg-slate-100 text-slate-500 border-slate-200',
};
