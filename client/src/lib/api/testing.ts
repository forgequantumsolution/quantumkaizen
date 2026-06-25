/**
 * LIMS 2.0 — Testing & Results API client. Backend: /api/testing.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type Evaluation = 'PENDING' | 'PASS' | 'OOS' | 'OOT' | 'NA';
export type SampleTestStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REVIEWED' | 'CANCELLED';
export type OverallResult = 'PASS' | 'OOS' | 'FAIL';
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type WorklistStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
export type Disposition = 'RELEASED' | 'REJECTED';

export interface Result {
  id: string;
  analyte_name: string;
  unit: string | null;
  numeric_value: number | null;
  text_value: string | null;
  evaluation: Evaluation;
  is_out_of_spec: boolean;
  min_value: number | null;
  max_value: number | null;
  decimals: number | null;
  calculation: string | null;
  entered_at: string;
}

export interface SampleTest {
  id: string;
  sample_id: string;
  test_definition_id: string;
  test_name: string;
  spec_version_id: string | null;
  worklist_id: string | null;
  status: SampleTestStatus;
  overall_result: OverallResult | null;
  analyst_name: string | null;
  instrument_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  review_status: ReviewStatus;
  reviewed_by_id: string | null;
  reviewed_at: string | null;
  results: Result[];
  created_at: string;
  sample_number?: string;
  product_name?: string;
}

export interface Worklist {
  id: string;
  code: string;
  name: string;
  status: WorklistStatus;
  analyst_name: string | null;
  instrument_id: string | null;
  system_suitability: string | null;
  notes: string | null;
  test_count: number;
  created_at: string;
  updated_at: string;
  tests?: SampleTest[];
}

export interface AssignTestsBody {
  from_product?: boolean;
  panel_id?: string;
  test_definition_ids?: string[];
}
export interface AssignTestsResponse {
  assigned: number;
  spec_version: { id: string; code: string; name: string } | null;
}

export interface EnterResultsBody {
  analyst_name?: string;
  instrument_id?: string;
  results: { result_id: string; numeric_value?: number | null; text_value?: string | null }[];
}

export interface ReviewTestBody {
  decision: 'APPROVED' | 'REJECTED';
  remarks?: string;
  credential?: string;
}

export interface DisposeSampleBody {
  disposition: Disposition;
  reason?: string;
  credential?: string;
}
export interface DisposeSampleResponse {
  id: string;
  sample_number: string;
  status: string;
  disposition: string;
}

export interface WorklistUpsert {
  name: string;
  analyst_name?: string;
  instrument_id?: string;
  notes?: string;
  system_suitability?: string;
  sample_test_ids?: string[];
  status?: WorklistStatus;
}

const keys = {
  all: ['testing'] as const,
  testsForSample: (sampleId: string) => ['testing', 'samples', sampleId, 'tests'] as const,
  test: (id: string) => ['testing', 'tests', id] as const,
  worklists: (p: object) => ['testing', 'worklists', 'list', p] as const,
  worklist: (id: string) => ['testing', 'worklists', id] as const,
};

// ── Sample Tests ──
export const useSampleTestsForSample = (sampleId: string | undefined) =>
  useQuery<{ data: SampleTest[] }>({
    queryKey: keys.testsForSample(sampleId ?? ''),
    queryFn: () => api.get(`/testing/samples/${sampleId}/tests`).then((r) => r.data),
    enabled: !!sampleId,
  });

export const useSampleTest = (id: string | undefined) =>
  useQuery<SampleTest>({
    queryKey: keys.test(id ?? ''),
    queryFn: () => api.get(`/testing/tests/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useAssignTests = (sampleId: string) => {
  const qc = useQueryClient();
  return useMutation<AssignTestsResponse, unknown, AssignTestsBody>({
    mutationFn: (b) => api.post(`/testing/samples/${sampleId}/assign`, b).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.testsForSample(sampleId) });
      qc.invalidateQueries({ queryKey: keys.all });
    },
  });
};

export const useEnterResults = (testId: string) => {
  const qc = useQueryClient();
  return useMutation<SampleTest, unknown, EnterResultsBody>({
    mutationFn: (b) => api.post(`/testing/tests/${testId}/results`, b).then((r) => r.data),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: keys.test(testId) });
      qc.invalidateQueries({ queryKey: keys.testsForSample(t.sample_id) });
      qc.invalidateQueries({ queryKey: keys.all });
    },
  });
};

export const useReviewTest = (testId: string) => {
  const qc = useQueryClient();
  return useMutation<SampleTest, unknown, ReviewTestBody>({
    mutationFn: (b) => api.post(`/testing/tests/${testId}/review`, b).then((r) => r.data),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: keys.test(testId) });
      qc.invalidateQueries({ queryKey: keys.testsForSample(t.sample_id) });
      qc.invalidateQueries({ queryKey: keys.all });
    },
  });
};

export const useDisposeSample = (sampleId: string) => {
  const qc = useQueryClient();
  return useMutation<DisposeSampleResponse, unknown, DisposeSampleBody>({
    mutationFn: (b) => api.post(`/testing/samples/${sampleId}/dispose`, b).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.testsForSample(sampleId) });
      qc.invalidateQueries({ queryKey: ['samples'] });
      qc.invalidateQueries({ queryKey: keys.all });
    },
  });
};

// ── Worklists ──
export const useWorklists = (params: { status?: WorklistStatus; search?: string } = {}) =>
  useQuery<{ data: Worklist[] }>({
    queryKey: keys.worklists(params),
    queryFn: () => api.get('/testing/worklists', { params }).then((r) => r.data),
  });

export const useWorklist = (id: string | undefined) =>
  useQuery<Worklist>({
    queryKey: keys.worklist(id ?? ''),
    queryFn: () => api.get(`/testing/worklists/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useCreateWorklist = () => {
  const qc = useQueryClient();
  return useMutation<Worklist, unknown, WorklistUpsert>({
    mutationFn: (b) => api.post('/testing/worklists', b).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useUpdateWorklist = (id: string) => {
  const qc = useQueryClient();
  return useMutation<Worklist, unknown, WorklistUpsert>({
    mutationFn: (b) => api.put(`/testing/worklists/${id}`, b).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.worklist(id) });
      qc.invalidateQueries({ queryKey: keys.all });
    },
  });
};

export const useCloseWorklist = (id: string) => {
  const qc = useQueryClient();
  return useMutation<Worklist, unknown, void>({
    mutationFn: () => api.post(`/testing/worklists/${id}/close`, {}).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.worklist(id) });
      qc.invalidateQueries({ queryKey: keys.all });
    },
  });
};

export const useRemoveTestFromWorklist = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (testId) => api.delete(`/testing/tests/${testId}/worklist`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

// ── Badge / label maps ──
export const SAMPLE_TEST_STATUS_BADGE: Record<SampleTestStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-700 border-gray-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
  COMPLETED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  REVIEWED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
};
export const SAMPLE_TEST_STATUS_LABELS: Record<SampleTestStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  REVIEWED: 'Reviewed',
  CANCELLED: 'Cancelled',
};

export const EVALUATION_BADGE: Record<Evaluation, string> = {
  PASS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  OOS: 'bg-red-50 text-red-700 border-red-200',
  FAIL: 'bg-red-50 text-red-700 border-red-200',
  OOT: 'bg-amber-50 text-amber-700 border-amber-200',
  PENDING: 'bg-gray-100 text-gray-700 border-gray-200',
  NA: 'bg-gray-100 text-gray-500 border-gray-200',
} as Record<Evaluation, string>;
export const EVALUATION_LABELS: Record<Evaluation, string> = {
  PASS: 'Pass',
  OOS: 'OOS',
  OOT: 'OOT',
  PENDING: 'Pending',
  NA: 'N/A',
};

export const WORKLIST_STATUS_BADGE: Record<WorklistStatus, string> = {
  OPEN: 'bg-blue-50 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  CLOSED: 'bg-slate-100 text-slate-500 border-slate-200',
};
export const WORKLIST_STATUS_LABELS: Record<WorklistStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  CLOSED: 'Closed',
};

export function specLimitLabel(r: Pick<Result, 'min_value' | 'max_value'>): string {
  if (r.min_value != null && r.max_value != null) return `${r.min_value}..${r.max_value}`;
  if (r.max_value != null) return `≤ ${r.max_value}`;
  if (r.min_value != null) return `≥ ${r.min_value}`;
  return '—';
}

export const OVERALL_RESULT_BADGE: Record<OverallResult, string> = {
  PASS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  OOS: 'bg-red-50 text-red-700 border-red-200',
  FAIL: 'bg-red-50 text-red-700 border-red-200',
};
