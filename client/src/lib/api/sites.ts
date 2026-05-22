import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Site {
  id: string;
  code: string;
  name: string;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { users: number; tickets: number };
}

export interface SiteListResponse {
  items: Site[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListSitesQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: 'true' | 'false';
}

export interface CreateSiteInput {
  code: string;
  name: string;
  address?: string | null;
  isActive?: boolean;
}

export type UpdateSiteInput = Partial<CreateSiteInput>;

// ─── Query keys ───────────────────────────────────────────────────────────────

export const siteKeys = {
  all: ['sites'] as const,
  list: (filters: ListSitesQuery) => ['sites', 'list', filters] as const,
  detail: (id: string) => ['sites', 'detail', id] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const useSites = (filters: ListSitesQuery = {}) =>
  useQuery<SiteListResponse>({
    queryKey: siteKeys.list(filters),
    queryFn: () => api.get('/sites', { params: filters }).then((r) => r.data),
  });

export const useCreateSite = () => {
  const qc = useQueryClient();
  return useMutation<Site, unknown, CreateSiteInput>({
    mutationFn: (input) => api.post('/sites', input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: siteKeys.all }),
  });
};

export const useUpdateSite = () => {
  const qc = useQueryClient();
  return useMutation<Site, unknown, { id: string } & UpdateSiteInput>({
    mutationFn: ({ id, ...rest }) =>
      api.patch(`/sites/${id}`, rest).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: siteKeys.all }),
  });
};

export const useDeleteSite = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => api.delete(`/sites/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: siteKeys.all }),
  });
};
