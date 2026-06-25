/**
 * LIMS Master API client — Customers. Backend: /api/lims-master/customers.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Customer {
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

export interface CustomerUpsert {
  name: string;
  contact_name?: string | null;
  email?: string | null;
  country?: string | null;
  is_active?: boolean;
}

const keys = { all: ['lims-master', 'customers'] as const, list: (p: object) => ['lims-master', 'customers', p] as const };

export const useCustomers = (params: { search?: string } = {}) =>
  useQuery<{ data: Customer[]; total: number }>({
    queryKey: keys.list(params),
    queryFn: () => api.get('/lims-master/customers', { params: { ...params, page_size: 200 } }).then((r) => r.data),
  });
export const useCreateCustomer = () => {
  const qc = useQueryClient();
  return useMutation<Customer, unknown, CustomerUpsert>({ mutationFn: (b) => api.post('/lims-master/customers', b).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }) });
};
export const useUpdateCustomer = (id: string) => {
  const qc = useQueryClient();
  return useMutation<Customer, unknown, CustomerUpsert>({ mutationFn: (b) => api.put(`/lims-master/customers/${id}`, b).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }) });
};
export const useDeleteCustomer = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({ mutationFn: (id) => api.delete(`/lims-master/customers/${id}`).then(() => undefined), onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }) });
};
