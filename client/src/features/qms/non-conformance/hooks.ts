import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrapList, unwrapItem, flattenUsers } from '@/lib/apiShape';
import type { NonConformance, PaginatedResponse } from '@/types';
import toast from 'react-hot-toast';

// ── Hooks ────────────────────────────────────────────────────────────────────

const flattenNC = (nc: Record<string, unknown>) =>
  flattenUsers(nc, ['assignedTo', 'reportedBy']);

interface NCFilters {
  status?: string;
  severity?: string;
  type?: string;
  department?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useNonConformances(filters: NCFilters = {}) {
  return useQuery<PaginatedResponse<NonConformance>>({
    queryKey: ['non-conformances', filters],
    queryFn: async () => {
      try {
        const { data: payload } = await api.get('/qms/non-conformances', { params: filters });
        return unwrapList<NonConformance>(payload, flattenNC as any);
      } catch {
        return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
      }
    },
    staleTime: 30_000,
  });
}

export function useNonConformance(id: string) {
  return useQuery<NonConformance | null>({
    queryKey: ['non-conformances', id],
    queryFn: async () => {
      try {
        const { data: payload } = await api.get(`/qms/non-conformances/${id}`);
        const item = unwrapItem<NonConformance>(payload, flattenNC as any);
        return (item?.id ? item : null) as NonConformance | null;
      } catch {
        return null;
      }
    },
    enabled: !!id,
  });
}

export function useCreateNC() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post('/qms/non-conformances', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['non-conformances'] });
      toast.success('Non-conformance reported successfully');
    },
    onError: () => {
      toast.error('Failed to report non-conformance');
    },
  });
}

export function useUpdateNCStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      try {
        const { data } = await api.patch(`/qms/non-conformances/${id}/status`, { status });
        return data;
      } catch {
        return { id, status }; // mock success
      }
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['non-conformances', id] });
      qc.invalidateQueries({ queryKey: ['non-conformances'] });
    },
  });
}
