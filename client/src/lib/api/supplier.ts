/**
 * LIMS Master Data API client — Suppliers. Backend: /api/lims-master/suppliers.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  country: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierUpsert {
  name: string;
  contact_name?: string | null;
  email?: string | null;
  country?: string | null;
  is_active?: boolean;
}

const keys = { all: ['lims-master', 'suppliers'] as const, list: (p: object) => ['lims-master', 'suppliers', p] as const };

export const useSuppliers = (params: { search?: string } = {}) =>
  useQuery<{ data: Supplier[]; total: number }>({
    queryKey: keys.list(params),
    queryFn: () => api.get('/lims-master/suppliers', { params: { ...params, page_size: 200 } }).then((r) => r.data),
  });
export const useCreateSupplier = () => {
  const qc = useQueryClient();
  return useMutation<Supplier, unknown, SupplierUpsert>({ mutationFn: (b) => api.post('/lims-master/suppliers', b).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }) });
};
export const useUpdateSupplier = (id: string) => {
  const qc = useQueryClient();
  return useMutation<Supplier, unknown, SupplierUpsert>({ mutationFn: (b) => api.put(`/lims-master/suppliers/${id}`, b).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }) });
};
export const useDeleteSupplier = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({ mutationFn: (id) => api.delete(`/lims-master/suppliers/${id}`).then(() => undefined), onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }) });
};
