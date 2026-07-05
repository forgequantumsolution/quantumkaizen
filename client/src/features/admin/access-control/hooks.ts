import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

/* ── Department permissions ───────────────────────────────────────────────
 * Backed by:
 *   GET  /api/departments/:id         → includes `permissions: {id,key,module,action}[]`
 *   PUT  /api/departments/:id/permissions  body { permissionIds: string[] }
 */

export interface DepartmentPermission {
  id: string;
  key: string;
  module: string;
  action: string;
}

export interface DepartmentWithPermissions {
  id: string;
  code: string;
  name: string;
  permissions: DepartmentPermission[];
}

export function useDepartmentPermissions(departmentId: string | null | undefined) {
  return useQuery({
    queryKey: ['department-permissions', departmentId],
    enabled: !!departmentId,
    queryFn: async () => {
      const { data } = await api.get(`/departments/${departmentId}`);
      const perms = (data as { permissions?: DepartmentPermission[] })?.permissions;
      return Array.isArray(perms) ? perms : [];
    },
  });
}

export function useSetDepartmentPermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, permissionIds }: { id: string; permissionIds: string[] }) => {
      const { data } = await api.put(`/departments/${id}/permissions`, { permissionIds });
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['department-permissions', vars.id] });
      qc.invalidateQueries({ queryKey: ['departments'] });
    },
  });
}

/* ── User permissions (effective + sources + overrides) ───────────────────
 * Backed by:
 *   GET  /api/users/:id/permissions →
 *     { effective: string[], sources: { role, department, grants, denies }: string[] }
 *   PUT  /api/users/:id/permissions body
 *     { overrides: { permissionId, effect: 'GRANT'|'DENY', reason? }[] }
 */

export type PermissionEffect = 'GRANT' | 'DENY';

export interface UserPermissionSources {
  role: string[];
  department: string[];
  grants: string[];
  denies: string[];
}

export interface UserPermissionsResponse {
  effective: string[];
  sources: UserPermissionSources;
}

export interface UserOverrideInput {
  permissionId: string;
  effect: PermissionEffect;
  reason?: string;
}

const EMPTY_USER_PERMS: UserPermissionsResponse = {
  effective: [],
  sources: { role: [], department: [], grants: [], denies: [] },
};

export function useUserPermissions(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['user-permissions', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await api.get(`/users/${userId}/permissions`);
      const d = data as Partial<UserPermissionsResponse> | null;
      if (!d || typeof d !== 'object') return EMPTY_USER_PERMS;
      return {
        effective: Array.isArray(d.effective) ? d.effective : [],
        sources: {
          role: d.sources?.role ?? [],
          department: d.sources?.department ?? [],
          grants: d.sources?.grants ?? [],
          denies: d.sources?.denies ?? [],
        },
      } as UserPermissionsResponse;
    },
  });
}

export function useSetUserPermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, overrides }: { id: string; overrides: UserOverrideInput[] }) => {
      const { data } = await api.put(`/users/${id}/permissions`, { overrides });
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['user-permissions', vars.id] });
    },
  });
}

/* ── "Who can do X" reverse lookup ────────────────────────────────────────
 *   GET /api/access/who-can/:permissionKey →
 *     { roles:[{id,name}], departments:[{id,name}], users:[{id,name,email}] }
 */

export interface WhoCanResponse {
  roles: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  users: { id: string; name: string; email: string }[];
}

const EMPTY_WHO_CAN: WhoCanResponse = { roles: [], departments: [], users: [] };

export function useWhoCan(permissionKey: string | null | undefined) {
  return useQuery({
    queryKey: ['who-can', permissionKey],
    enabled: !!permissionKey,
    queryFn: async () => {
      const { data } = await api.get(`/access/who-can/${encodeURIComponent(permissionKey!)}`);
      const d = data as Partial<WhoCanResponse> | null;
      if (!d || typeof d !== 'object') return EMPTY_WHO_CAN;
      return {
        roles: Array.isArray(d.roles) ? d.roles : [],
        departments: Array.isArray(d.departments) ? d.departments : [],
        users: Array.isArray(d.users) ? d.users : [],
      } as WhoCanResponse;
    },
  });
}
