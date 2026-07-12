import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';

export interface SiteRef {
  id: string;
  code: string;
  name: string;
}

interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
  roleName: string | null;
  department?: string;
  /** The user's assigned site (used to default the navbar selector). */
  site?: SiteRef | null;
  /** Sites the user may see/switch in the navbar (their own, or all if viewAll). */
  allowedSites: SiteRef[];
  employeeId: string;
  permissions: string[];
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, tenantCode?: string) => Promise<void>;
  logout: () => void;
  setUser: (user: AuthUser) => void;
  /** Re-fetch the current user from /auth/me and refresh permissions in place.
   * Used after an access-control change so the sidebar/gates update without a
   * re-login. No-ops (and stays silent) when not authenticated. */
  refreshUser: () => Promise<void>;
  hasPermission: (key: string) => boolean;
  /** @deprecated persist middleware handles rehydration automatically */
  loadFromStorage: () => void;
}

interface BackendUser {
  id: string;
  email: string;
  name: string;
  employeeId: string | null;
  isActive: boolean;
  departmentId: string | null;
  roleId: string | null;
  role: { id: string; name: string } | null;
  department?: { id: string; code: string; name: string } | null;
  site?: SiteRef | null;
  allowedSites?: SiteRef[];
  permissions: string[];
}

function mapBackendUser(u: BackendUser): AuthUser {
  return {
    id: u.id,
    tenantId: 'default',
    email: u.email,
    name: u.name,
    role: u.role?.name ?? 'NONE',
    roleName: u.role?.name ?? null,
    department: u.department?.name ?? undefined,
    site: u.site ?? null,
    allowedSites: Array.isArray(u.allowedSites) ? u.allowedSites : [],
    employeeId: u.employeeId ?? u.id,
    permissions: Array.isArray(u.permissions) ? u.permissions : [],
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email, password, tenantCode) => {
        set({ isLoading: true });
        try {
          const response = await api.post('/auth/login', { email, password, tenantCode });
          // Backend returns the body as { user, token } (see backend/src/modules/auth/auth.controller.ts).
          // role/department arrive as objects — map them to the flat AuthUser shape.
          const { user: backendUser, token } = response.data;
          const user = mapBackendUser(backendUser);

          localStorage.setItem('qk_token', token);
          localStorage.setItem('qk_user', JSON.stringify(user));
          set({ user, token, isAuthenticated: true, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        localStorage.removeItem('qk_token');
        localStorage.removeItem('qk_user');
        set({ user: null, token: null, isAuthenticated: false });
      },

      setUser: (user) => set({ user }),

      refreshUser: async () => {
        if (!get().token) return;
        try {
          const response = await api.get('/auth/me');
          const user = mapBackendUser(response.data.user);
          localStorage.setItem('qk_user', JSON.stringify(user));
          set({ user });
        } catch {
          // Leave the existing user in place on a transient failure — the next
          // login/refresh will reconcile. A 401 is handled by the api layer.
        }
      },

      hasPermission: (key) => {
        const u = get().user;
        return !!u && u.permissions.includes(key);
      },

      loadFromStorage: () => {
        const token = localStorage.getItem('qk_token');
        const userStr = localStorage.getItem('qk_user');
        if (token && userStr) {
          try {
            const user = JSON.parse(userStr);
            set({ user, token, isAuthenticated: true });
          } catch {
            localStorage.removeItem('qk_token');
            localStorage.removeItem('qk_user');
          }
        }
      },
    }),
    {
      name: 'qk-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const t = state.token;
        const looksLikeJwt = typeof t === 'string' && t.split('.').length === 3;
        // Reject persisted users from older builds where `role` was still the
        // raw backend object — Sidebar etc. assume role is a string.
        const hasFlatUserShape =
          !!state.user && typeof (state.user as { role?: unknown }).role === 'string';
        if (!looksLikeJwt || !hasFlatUserShape) {
          state.token = null;
          state.user = null;
          state.isAuthenticated = false;
          localStorage.removeItem('qk_token');
          localStorage.removeItem('qk_user');
          localStorage.removeItem('qk-auth');
        }
      },
    },
  ),
);

export const useHasPermission = (key: string): boolean =>
  useAuthStore((s) => s.user?.permissions.includes(key) ?? false);

/**
 * True if ANY held permission key matches `predicate`. Used where a single
 * exact key can't express "any workflow type" — e.g. whether to show the
 * "Raise Ticket" button at all, aggregating across every `wf_type.<id>.create`
 * a user might hold, since there's no longer a single master key for that.
 */
export const useHasAnyPermissionMatching = (predicate: (key: string) => boolean): boolean =>
  useAuthStore((s) => (s.user?.permissions ?? []).some(predicate));
