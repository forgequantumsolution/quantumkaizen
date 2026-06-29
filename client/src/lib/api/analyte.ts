/**
 * LIMS Master Data — Analytes API client. Backend: /api/lims-master/analytes.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type AnalyteDataType = 'NUMERIC' | 'TEXT' | 'BOOLEAN';

export interface Analyte {
  id: string;
  code: string;
  name: string;
  default_unit: string | null;
  data_type: AnalyteDataType;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AnalyteUpsert {
  name: string;
  default_unit?: string | null;
  data_type?: AnalyteDataType;
  category?: string | null;
  is_active?: boolean;
}

const analyteKeys = { all: ['lims-master', 'analytes'] as const, list: (p: object) => ['lims-master', 'analytes', p] as const };

export const useAnalytes = (params: { search?: string } = {}) =>
  useQuery<{ data: Analyte[]; total: number }>({
    queryKey: analyteKeys.list(params),
    queryFn: () => api.get('/lims-master/analytes', { params: { ...params, page_size: 200 } }).then((r) => r.data),
  });
export const useCreateAnalyte = () => {
  const qc = useQueryClient();
  return useMutation<Analyte, unknown, AnalyteUpsert>({ mutationFn: (b) => api.post('/lims-master/analytes', b).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: analyteKeys.all }) });
};
export const useUpdateAnalyte = (id: string) => {
  const qc = useQueryClient();
  return useMutation<Analyte, unknown, AnalyteUpsert>({ mutationFn: (b) => api.put(`/lims-master/analytes/${id}`, b).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: analyteKeys.all }) });
};
export const useDeleteAnalyte = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({ mutationFn: (id) => api.delete(`/lims-master/analytes/${id}`).then(() => undefined), onSuccess: () => qc.invalidateQueries({ queryKey: analyteKeys.all }) });
};

export const ANALYTE_DATA_TYPE_LABELS: Record<AnalyteDataType, string> = {
  NUMERIC: 'Numeric',
  TEXT: 'Text',
  BOOLEAN: 'Boolean',
};
