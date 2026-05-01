import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface Department {
  id: string;
  code: string;
  name: string;
  description: string | null;
  parentId: string | null;
  headUserId: string | null;
  costCenter: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  head: { id: string; name: string; email: string } | null;
  parent: { id: string; code: string; name: string } | null;
  _count: { users: number; children: number };
}

export type DepartmentTreeNode = Department & { children: DepartmentTreeNode[] };

export interface CreateDepartmentInput {
  code: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  headUserId?: string | null;
  costCenter?: string | null;
  isActive?: boolean;
}

export type UpdateDepartmentInput = Partial<CreateDepartmentInput>;

export function useDepartments(filters?: { search?: string; isActive?: boolean }) {
  return useQuery({
    queryKey: ['departments', filters],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters?.search) params.search = filters.search;
      if (filters?.isActive !== undefined) params.isActive = String(filters.isActive);
      const { data } = await api.get('/departments', { params });
      return Array.isArray(data) ? (data as Department[]) : [];
    },
  });
}

export function useDepartmentTree() {
  return useQuery({
    queryKey: ['departments', 'tree'],
    queryFn: async () => {
      const { data } = await api.get('/departments/tree');
      return Array.isArray(data) ? (data as DepartmentTreeNode[]) : [];
    },
  });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateDepartmentInput) => {
      const { data } = await api.post('/departments', body);
      return data as Department;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
  });
}

export function useUpdateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateDepartmentInput & { id: string }) => {
      const { data } = await api.patch(`/departments/${id}`, body);
      return data as Department;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
  });
}

export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/departments/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
  });
}
