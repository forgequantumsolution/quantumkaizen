import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  employeeId: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  designation: string | null;
  isActive: boolean;
  joinDate: string | null;
  lastLoginAt: string | null;
  avatarUrl: string | null;
  locale: string;
  timezone: string;
  departmentId: string | null;
  roleId: string | null;
  siteId: string | null;
  managerId: string | null;
  createdAt: string;
  updatedAt: string;
  department: { id: string; code: string; name: string } | null;
  role: { id: string; name: string } | null;
  site: { id: string; code: string; name: string } | null;
  manager: { id: string; name: string; email: string } | null;
}

export interface UserListResponse {
  items: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateUserInput {
  email: string;
  password: string;
  employeeId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  designation?: string | null;
  departmentId?: string | null;
  roleId?: string | null;
  siteId?: string | null;
  managerId?: string | null;
  joinDate?: string | null;
  isActive?: boolean;
}

export type UpdateUserInput = Omit<Partial<CreateUserInput>, 'password'>;

export interface UserFilters {
  search?: string;
  departmentId?: string;
  roleId?: string;
  siteId?: string;
  isActive?: boolean;
}

export function useAdminUsers(filters: UserFilters = {}) {
  return useQuery({
    queryKey: ['admin-users', filters],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters.search) params.search = filters.search;
      if (filters.departmentId) params.departmentId = filters.departmentId;
      if (filters.roleId) params.roleId = filters.roleId;
      if (filters.siteId) params.siteId = filters.siteId;
      if (filters.isActive !== undefined) params.isActive = String(filters.isActive);
      const { data } = await api.get('/users', { params });
      const safe = data && typeof data === 'object' ? (data as UserListResponse) : null;
      return (
        safe ?? { items: [] as AdminUser[], total: 0, page: 1, pageSize: 50 }
      );
    },
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateUserInput) => {
      const { data } = await api.post('/users', body);
      return data as AdminUser;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateUserInput & { id: string }) => {
      const { data } = await api.patch(`/users/${id}`, body);
      return data as AdminUser;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      await api.post(`/users/${id}/reset-password`, { password });
    },
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/users/${id}`);
      return data as AdminUser;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}

export function useReactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/users/${id}`, { isActive: true });
      return data as AdminUser;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}
