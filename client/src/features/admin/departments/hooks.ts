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

export interface DepartmentFilters {
  search?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface DepartmentListResponse {
  items: Department[];
  total: number;
  page: number;
  pageSize: number;
}

export function useDepartments(filters: DepartmentFilters = {}) {
  return useQuery({
    queryKey: ['departments', filters],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters.search) params.search = filters.search;
      if (filters.isActive !== undefined) params.isActive = String(filters.isActive);
      if (filters.page) params.page = String(filters.page);
      if (filters.pageSize) params.pageSize = String(filters.pageSize);
      const { data } = await api.get('/departments', { params });
      const safe = data && typeof data === 'object' && !Array.isArray(data)
        ? (data as DepartmentListResponse)
        : null;
      return (
        safe ?? {
          items: [] as Department[],
          total: 0,
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 20,
        }
      );
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
