/**
 * LIMS Master Data API client — Units of Measure. Backend: /api/lims-master/units.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface UnitOfMeasure {
  id: string;
  code: string;
  name: string;
  symbol: string | null;
  kind: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UnitUpsert {
  name: string;
  symbol?: string | null;
  kind?: string | null;
  is_active?: boolean;
}

const unitKeys = { all: ['lims-master', 'units'] as const, list: (p: object) => ['lims-master', 'units', p] as const };

export const useUnits = (params: { search?: string } = {}) =>
  useQuery<{ data: UnitOfMeasure[]; total: number }>({
    queryKey: unitKeys.list(params),
    queryFn: () => api.get('/lims-master/units', { params: { ...params, page_size: 200 } }).then((r) => r.data),
  });
export const useCreateUnit = () => {
  const qc = useQueryClient();
  return useMutation<UnitOfMeasure, unknown, UnitUpsert>({ mutationFn: (b) => api.post('/lims-master/units', b).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: unitKeys.all }) });
};
export const useUpdateUnit = (id: string) => {
  const qc = useQueryClient();
  return useMutation<UnitOfMeasure, unknown, UnitUpsert>({ mutationFn: (b) => api.put(`/lims-master/units/${id}`, b).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: unitKeys.all }) });
};
export const useDeleteUnit = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({ mutationFn: (id) => api.delete(`/lims-master/units/${id}`).then(() => undefined), onSuccess: () => qc.invalidateQueries({ queryKey: unitKeys.all }) });
};
