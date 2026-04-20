import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';

interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
  department?: string;
  site?: string;
  employeeId: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, tenantCode: string) => Promise<void>;
  logout: () => void;
  setUser: (user: AuthUser) => void;
  /** @deprecated persist middleware handles rehydration automatically */
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string, tenantCode: string) => {
        set({ isLoading: true });
        try {
          const response = await api.post('/auth/login', { email, password, tenantCode });
          // Backend wraps all successful responses in { data: {...} }; axios already
          // unwraps the HTTP body into response.data, so the payload is response.data.data.
          const { user, accessToken } = response.data.data;

          localStorage.setItem('qk_token', accessToken);
          localStorage.setItem('qk_user', JSON.stringify(user));

          set({ user, token: accessToken, isAuthenticated: true, isLoading: false });
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

      setUser: (user: AuthUser) => set({ user }),

      loadFromStorage: () => {
        // kept for backward compat — persist middleware handles this automatically
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
      name: 'qk-auth',           // localStorage key for persisted state
      partialize: (state) => ({  // only persist these fields
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      // Drop tokens that are clearly not real JWTs (legacy demo fallback,
      // failed login that stored `undefined`, etc.) so the user is bounced
      // to /login instead of silently 401-ing on every API call.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const t = state.token;
        const looksLikeJwt = typeof t === 'string' && t.split('.').length === 3;
        if (!looksLikeJwt) {
          state.token = null;
          state.user = null;
          state.isAuthenticated = false;
          localStorage.removeItem('qk_token');
          localStorage.removeItem('qk_user');
        }
      },
    },
  ),
);
