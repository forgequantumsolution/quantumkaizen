/**
 * LIMS Master Data API client — Products. Backend: /api/lims-master/products.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Product {
  id: string;
  code: string;
  name: string;
  grade: string | null;
  dosage_form: string | null;
  strength: string | null;
  category: string | null;
  markets: string | null;
  default_panel_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductUpsert {
  name: string;
  grade?: string | null;
  dosage_form?: string | null;
  strength?: string | null;
  category?: string | null;
  markets?: string | null;
  default_panel_id?: string | null;
  is_active?: boolean;
}

export interface ListProductsResponse {
  data: Product[];
  total: number;
  page: number;
  page_size: number;
}

const keys = { all: ['lims-master', 'products'] as const, list: (p: object) => ['lims-master', 'products', p] as const };

export const useProducts = (params: { search?: string } = {}) =>
  useQuery<ListProductsResponse>({
    queryKey: keys.list(params),
    queryFn: () => api.get('/lims-master/products', { params: { ...params, page_size: 200 } }).then((r) => r.data),
  });
export const useCreateProduct = () => {
  const qc = useQueryClient();
  return useMutation<Product, unknown, ProductUpsert>({ mutationFn: (b) => api.post('/lims-master/products', b).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }) });
};
export const useUpdateProduct = (id: string) => {
  const qc = useQueryClient();
  return useMutation<Product, unknown, ProductUpsert>({ mutationFn: (b) => api.put(`/lims-master/products/${id}`, b).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }) });
};
export const useDeleteProduct = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({ mutationFn: (id) => api.delete(`/lims-master/products/${id}`).then(() => undefined), onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }) });
};
