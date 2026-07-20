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
  avatarUrl?: string | null;
  departmentId?: string | null;
  roleId?: string | null;
  siteId?: string | null;
  managerId?: string | null;
  joinDate?: string | null;
  isActive?: boolean;
}

export type UpdateUserInput = Omit<Partial<CreateUserInput>, 'password'>;

/** One entry in the people directory (assignment pickers). Site-scoped server-side. */
export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  designation: string | null;
  employeeId: string | null;
  roleId: string | null;
  departmentId: string | null;
  siteId: string | null;
  role: { id: string; name: string } | null;
  department: { id: string; code: string; name: string } | null;
  site: { id: string; code: string; name: string } | null;
}

/**
 * People directory for assignment pickers (Lead Auditor, Approver, CAPA owner,
 * team members, …). Readable by any authenticated user — unlike `useAdminUsers`
 * (which needs `user.read` and would 403 → empty for operational roles like
 * auditors). Use this anywhere you only need "pick a person", not user admin.
 *
 * Site-scoped server-side to the caller's own site(s). Pass an optional `siteId`
 * to target a specific site (e.g. the workflow builder scoping to the WORKFLOW's
 * site — docs/workflow-site-ownership-plan.md). The server bounds it to the
 * caller's scope, so a scoped user can never widen past their own site.
 */
export function useUserDirectory(siteId?: string) {
  return useQuery({
    queryKey: ['user-directory', siteId ?? null],
    queryFn: async () => {
      const { data } = await api.get('/users/directory', {
        params: siteId ? { siteId } : {},
      });
      const items = data && Array.isArray(data.items) ? (data.items as DirectoryUser[]) : [];
      return { items };
    },
  });
}

export interface UserFilters {
  search?: string;
  departmentId?: string;
  roleId?: string;
  siteId?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
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
      if (filters.page) params.page = String(filters.page);
      if (filters.pageSize) params.pageSize = String(filters.pageSize);
      const { data } = await api.get('/users', { params });
      const safe = data && typeof data === 'object' ? (data as UserListResponse) : null;
      return (
        safe ?? {
          items: [] as AdminUser[],
          total: 0,
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 20,
        }
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
