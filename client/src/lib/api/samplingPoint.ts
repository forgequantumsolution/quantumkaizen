/**
 * LIMS Master API client — Sampling Points. Backend: /api/lims-master/sampling-points.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface SamplingPoint {
  id: string;
  code: string;
  name: string;
  area: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SamplingPointUpsert {
  name: string;
  area?: string | null;
  description?: string | null;
  is_active?: boolean;
}

const keys = {
  all: ['lims-master', 'sampling-points'] as const,
  list: (p: object) => ['lims-master', 'sampling-points', 'list', p] as const,
};

export const useSamplingPoints = (params: { search?: string } = {}) =>
  useQuery<{ data: SamplingPoint[]; total: number }>({
    queryKey: keys.list(params),
    queryFn: () => api.get('/lims-master/sampling-points', { params: { ...params, page_size: 200 } }).then((r) => r.data),
  });

export const useCreateSamplingPoint = () => {
  const qc = useQueryClient();
  return useMutation<SamplingPoint, unknown, SamplingPointUpsert>({
    mutationFn: (b) => api.post('/lims-master/sampling-points', b).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useUpdateSamplingPoint = (id: string) => {
  const qc = useQueryClient();
  return useMutation<SamplingPoint, unknown, SamplingPointUpsert>({
    mutationFn: (b) => api.put(`/lims-master/sampling-points/${id}`, b).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useDeleteSamplingPoint = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => api.delete(`/lims-master/sampling-points/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};
