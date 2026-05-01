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

export function useRoles(search?: string) {
  return useQuery({
    queryKey: ['roles', search],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      const { data } = await api.get('/roles', { params });
      return Array.isArray(data) ? (data as Role[]) : [];
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
