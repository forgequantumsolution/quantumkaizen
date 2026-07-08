import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface Permission {
  id: string;
  key: string;
  module: string;
  action: string;
  description: string;
}

export interface PermissionGroup {
  module: string;
  permissions: Pick<Permission, 'id' | 'key' | 'action' | 'description'>[];
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: Permission[];
  _count: { users: number };
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoleInput {
  name: string;
  description?: string | null;
  permissionIds?: string[];
}

export interface UpdateRoleInput {
  description?: string | null;
  permissionIds?: string[];
}

export interface RoleFilters {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface RoleListResponse {
  items: Role[];
  total: number;
  page: number;
  pageSize: number;
}

/** One entry in the lightweight role directory (assignment/target pickers). */
export interface RoleDirectoryEntry {
  id: string;
  name: string;
  isSystem: boolean;
  _count: { users: number };
}

/**
 * Role directory for pickers — readable by any authenticated user, unlike
 * `useRoles` (needs `role.read`, so its picker 403s → empty for operational
 * roles). Returns name + user count; no permission keys.
 */
export function useRoleDirectory() {
  return useQuery({
    queryKey: ['role-directory'],
    queryFn: async () => {
      const { data } = await api.get('/roles/directory');
      const items = data && Array.isArray(data.items) ? (data.items as RoleDirectoryEntry[]) : [];
      return { items };
    },
  });
}

export function useRoles(filters: RoleFilters = {}) {
  return useQuery({
    queryKey: ['roles', filters],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters.search) params.search = filters.search;
      if (filters.page) params.page = String(filters.page);
      if (filters.pageSize) params.pageSize = String(filters.pageSize);
      const { data } = await api.get('/roles', { params });
      const safe = data && typeof data === 'object' && !Array.isArray(data)
        ? (data as RoleListResponse)
        : null;
      return (
        safe ?? {
          items: [] as Role[],
          total: 0,
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 20,
        }
      );
    },
  });
}

export function usePermissionsGrouped() {
  return useQuery({
    queryKey: ['permissions', 'grouped'],
    queryFn: async () => {
      const { data } = await api.get('/permissions', { params: { grouped: 'true' } });
      return Array.isArray(data) ? (data as PermissionGroup[]) : [];
    },
    staleTime: 5 * 60_000,
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateRoleInput) => {
      const { data } = await api.post('/roles', body);
      return data as Role;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateRoleInput & { id: string }) => {
      const { data } = await api.patch(`/roles/${id}`, body);
      return data as Role;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useSetRolePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, permissionIds }: { id: string; permissionIds: string[] }) => {
      const { data } = await api.put(`/roles/${id}/permissions`, { permissionIds });
      return data as Role;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/roles/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}
