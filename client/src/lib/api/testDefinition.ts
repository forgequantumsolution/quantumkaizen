/**
 * LIMS 2.0 (L1) — Test Definitions & Test Panels API client.
 * Backend: /api/test-definitions (+ /panels/all, /panels/:id, /panels).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export { useAnalytes } from '@/lib/api/analyte';
export { useMethods } from '@/lib/api/lims';

export type TestStatus = 'DRAFT' | 'APPROVED' | 'RETIRED';
export type TestAnalyteDataType = 'NUMERIC' | 'TEXT' | 'BOOLEAN' | 'TITRATION';

export interface TestAnalyte {
  id?: string;
  analyte_id: string | null;
  name: string;
  unit: string | null;
  data_type: TestAnalyteDataType;
  decimals: number | null;
  calculation: string | null;
  sequence: number;
}

export interface TestDefinitionSummary {
  id: string;
  code: string;
  name: string;
  technique: string | null;
  method_id: string | null;
  method_name?: string | null;
  version: number;
  status: TestStatus;
  description: string | null;
  analyte_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TestDefinition extends TestDefinitionSummary {
  analytes: TestAnalyte[];
}

export interface TestDefinitionUpsert {
  name: string;
  technique?: string | null;
  method_id?: string | null;
  description?: string | null;
  analytes: Array<Omit<TestAnalyte, 'id'>>;
}

export interface TestPanelItem {
  id?: string;
  test_definition_id: string;
  test_definition_code?: string | null;
  test_definition_name?: string | null;
  sequence: number;
}

export interface TestPanelSummary {
  id: string;
  code: string;
  name: string;
  description: string | null;
  item_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TestPanel extends TestPanelSummary {
  items: TestPanelItem[];
}

export interface TestPanelUpsert {
  name: string;
  description?: string | null;
  items: Array<{ test_definition_id: string; sequence?: number }>;
}

// ── Test Definitions ──

const defKeys = {
  all: ['test-definitions'] as const,
  list: (p: object) => ['test-definitions', 'list', p] as const,
  detail: (id: string) => ['test-definitions', id] as const,
};

export const useTestDefinitions = (params: { search?: string; status?: TestStatus } = {}) =>
  useQuery<{ data: TestDefinitionSummary[]; total: number }>({
    queryKey: defKeys.list(params),
    queryFn: () => api.get('/test-definitions', { params: { ...params, page_size: 200 } }).then((r) => r.data),
  });

export const useTestDefinition = (id: string | undefined) =>
  useQuery<TestDefinition>({
    queryKey: defKeys.detail(id ?? ''),
    queryFn: () => api.get(`/test-definitions/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useCreateTestDefinition = () => {
  const qc = useQueryClient();
  return useMutation<TestDefinition, unknown, TestDefinitionUpsert>({
    mutationFn: (b) => api.post('/test-definitions', b).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: defKeys.all }),
  });
};

export const useUpdateTestDefinition = (id: string) => {
  const qc = useQueryClient();
  return useMutation<TestDefinition, unknown, TestDefinitionUpsert>({
    mutationFn: (b) => api.put(`/test-definitions/${id}`, b).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: defKeys.all }),
  });
};

export const useApproveTestDefinition = (id: string) => {
  const qc = useQueryClient();
  return useMutation<TestDefinition, unknown, void>({
    mutationFn: () => api.post(`/test-definitions/${id}/approve`, {}).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: defKeys.all }),
  });
};

export const useDeleteTestDefinition = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => api.delete(`/test-definitions/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: defKeys.all }),
  });
};

// ── Test Panels ──

const panelKeys = {
  all: ['test-panels'] as const,
  list: (p: object) => ['test-panels', 'list', p] as const,
  detail: (id: string) => ['test-panels', id] as const,
};

export const useTestPanels = (params: { search?: string } = {}) =>
  useQuery<{ data: TestPanelSummary[]; total: number }>({
    queryKey: panelKeys.list(params),
    queryFn: () => api.get('/test-definitions/panels/all', { params: { ...params, page_size: 200 } }).then((r) => r.data),
  });

export const useTestPanel = (id: string | undefined) =>
  useQuery<TestPanel>({
    queryKey: panelKeys.detail(id ?? ''),
    queryFn: () => api.get(`/test-definitions/panels/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useCreateTestPanel = () => {
  const qc = useQueryClient();
  return useMutation<TestPanel, unknown, TestPanelUpsert>({
    mutationFn: (b) => api.post('/test-definitions/panels', b).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: panelKeys.all }),
  });
};

export const useUpdateTestPanel = (id: string) => {
  const qc = useQueryClient();
  return useMutation<TestPanel, unknown, TestPanelUpsert>({
    mutationFn: (b) => api.put(`/test-definitions/panels/${id}`, b).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: panelKeys.all }),
  });
};

export const useDeleteTestPanel = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => api.delete(`/test-definitions/panels/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: panelKeys.all }),
  });
};

export const TEST_STATUS_BADGE: Record<TestStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  RETIRED: 'bg-red-50 text-red-700 border-red-200',
};

export const TEST_DATA_TYPE_OPTIONS: { value: TestAnalyteDataType; label: string }[] = [
  { value: 'NUMERIC', label: 'Numeric' },
  { value: 'TEXT', label: 'Text' },
  { value: 'BOOLEAN', label: 'Boolean' },
  { value: 'TITRATION', label: 'Titration' },
];
