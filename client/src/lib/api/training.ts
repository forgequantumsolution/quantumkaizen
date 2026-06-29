/**
 * Training & Competency API client. Backend: /api/training.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type TrainingStatus = 'ASSIGNED' | 'COMPLETED';

export interface TrainingAssignment {
  id: string;
  user_id: string;
  user_name: string | null;
  status: TrainingStatus;
  due_date: string | null;
  assigned_at: string;
  completed_at: string | null;
}

export interface TrainingItemSummary {
  id: string;
  code: string;
  title: string;
  description: string | null;
  document_id: string | null;
  role_id: string | null;
  is_active: boolean;
  assigned_count: number;
  completed_count: number;
  created_at: string;
  updated_at: string;
}

export interface TrainingItemDetail extends TrainingItemSummary {
  assignments: TrainingAssignment[];
}

export interface ListItemsResponse {
  data: TrainingItemSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface MyTrainingResponse {
  pending: number;
  items: {
    assignment_id: string;
    training_item_id: string;
    code: string;
    title: string;
    document_id: string | null;
    status: TrainingStatus;
    due_date: string | null;
    completed_at: string | null;
  }[];
}

export interface CreateItemBody {
  title: string;
  description?: string | null;
  document_id?: string | null;
  role_id?: string | null;
  is_active?: boolean;
}

const keys = {
  all: ['training'] as const,
  items: (p: { search?: string }) => ['training', 'items', p] as const,
  item: (id: string) => ['training', 'item', id] as const,
  my: ['training', 'my'] as const,
};

export const useTrainingItems = (params: { search?: string } = {}) =>
  useQuery<ListItemsResponse>({
    queryKey: keys.items(params),
    queryFn: () => api.get('/training/items', { params: { ...params, page_size: 200 } }).then((r) => r.data),
  });

export const useTrainingItem = (id: string | undefined) =>
  useQuery<TrainingItemDetail>({
    queryKey: keys.item(id ?? ''),
    queryFn: () => api.get(`/training/items/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useMyTraining = () =>
  useQuery<MyTrainingResponse>({
    queryKey: keys.my,
    queryFn: () => api.get('/training/my').then((r) => r.data),
  });

export const useCreateTrainingItem = () => {
  const qc = useQueryClient();
  return useMutation<TrainingItemDetail, unknown, CreateItemBody>({
    mutationFn: (body) => api.post('/training/items', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useDeleteTrainingItem = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => api.delete(`/training/items/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useAssignTraining = (id: string) => {
  const qc = useQueryClient();
  return useMutation<TrainingItemDetail, unknown, { user_ids?: string[]; role_id?: string; due_date?: string | null }>({
    mutationFn: (body) => api.post(`/training/items/${id}/assign`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useCompleteTraining = (id: string) => {
  const qc = useQueryClient();
  return useMutation<TrainingItemDetail, unknown, void>({
    mutationFn: () => api.post(`/training/items/${id}/complete`, {}).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};
