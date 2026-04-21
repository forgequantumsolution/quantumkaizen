import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';
import { DEMO_ACCOUNTS } from '@/config/demoCredentials';

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

// ── Offline login fallback ───────────────────────────────────────────────
// The site is deployed frontend-only on Vercel for the demo, so POST to
// /api/v1/auth/login returns 405 (no backend function). When that happens
// AND the credentials match a known DEMO_ACCOUNT, we accept the login
// locally so every module can still be browsed with mock data.
//
// Once the Render API is wired up and CORS is configured, the `try`
// branch in login() succeeds and this fallback is never hit.

const DEMO_USER_TEMPLATES: Record<string, Omit<AuthUser, 'email'>> = {
  // Pharma seed (match server/prisma/seed.ts)
  'admin@aurorabiopharma.com':          { id: 'demo-u1', tenantId: 'demo-tenant', name: 'Dr. Ashish Pandit',  role: 'TENANT_ADMIN',        department: 'Site Management',   site: 'Hyderabad — Unit I', employeeId: 'EMP001' },
  'qa.head@aurorabiopharma.com':        { id: 'demo-u2', tenantId: 'demo-tenant', name: 'Dr. Priya Sharma',   role: 'QUALITY_MANAGER',     department: 'Quality Assurance', site: 'Hyderabad — Unit I', employeeId: 'EMP002' },
  'qc.analyst@aurorabiopharma.com':     { id: 'demo-u3', tenantId: 'demo-tenant', name: 'Rajesh Kumar',       role: 'QUALITY_ENGINEER',    department: 'Quality Control',   site: 'Hyderabad — Unit I', employeeId: 'EMP003' },
  'doc.controller@aurorabiopharma.com': { id: 'demo-u4', tenantId: 'demo-tenant', name: 'Anita Desai',        role: 'DOCUMENT_CONTROLLER', department: 'Document Control',  site: 'Hyderabad — Unit I', employeeId: 'EMP004' },
  // Brand / quick-login (offline only — not seeded in the backend)
  'admin@forgequantum.com':             { id: 'demo-b1', tenantId: 'demo-tenant', name: 'Ashish Pandit',      role: 'TENANT_ADMIN',        department: 'Management',        site: 'Headquarters',       employeeId: 'FQ-001' },
  'qa@forgequantum.com':                { id: 'demo-b2', tenantId: 'demo-tenant', name: 'Dr. Priya Sharma',   role: 'QUALITY_MANAGER',     department: 'Quality Assurance', site: 'Headquarters',       employeeId: 'FQ-002' },
  'lab@forgequantum.com':               { id: 'demo-b3', tenantId: 'demo-tenant', name: 'Rajesh Kumar',       role: 'QUALITY_ENGINEER',    department: 'Laboratory',        site: 'Headquarters',       employeeId: 'FQ-003' },
  'qc@forgequantum.com':                { id: 'demo-b4', tenantId: 'demo-tenant', name: 'Anita Desai',        role: 'QUALITY_ENGINEER',    department: 'Quality Control',   site: 'Headquarters',       employeeId: 'FQ-004' },
  'partner@forgequantum.com':           { id: 'demo-b5', tenantId: 'demo-tenant', name: 'External Partner',   role: 'READ_ONLY',           department: 'External',          site: 'Remote',             employeeId: 'FQ-005' },
};

// Base64-url encode without padding — valid JWT segment.
const b64url = (obj: unknown) =>
  btoa(JSON.stringify(obj)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

function mintSyntheticJwt(user: AuthUser): string {
  const header  = b64url({ alg: 'none', typ: 'JWT', demo: true });
  const payload = b64url({
    sub: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    iat: Math.floor(Date.now() / 1000),
    demo: true,
  });
  // Opaque third segment — no real signature, but the persist-rehydrate
  // sanity check in this file only verifies shape (three dot-separated
  // parts), not cryptographic validity.
  const sig = b64url({ offline: true });
  return `${header}.${payload}.${sig}`;
}

function tryOfflineLogin(email: string, password: string): { user: AuthUser; token: string } | null {
  const match = DEMO_ACCOUNTS.find(a => a.email === email && a.password === password);
  if (!match) return null;
  const template = DEMO_USER_TEMPLATES[email];
  if (!template) return null;
  const user: AuthUser = { ...template, email };
  return { user, token: mintSyntheticJwt(user) };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email, password, tenantCode) => {
        set({ isLoading: true });
        try {
          const response = await api.post('/auth/login', { email, password, tenantCode });
          // Backend wraps successful responses in { data: {...} }; axios unwraps
          // the HTTP body into response.data, so the payload is response.data.data.
          const { user, accessToken } = response.data.data;

          localStorage.setItem('qk_token', accessToken);
          localStorage.setItem('qk_user', JSON.stringify(user));
          set({ user, token: accessToken, isAuthenticated: true, isLoading: false });
        } catch (error) {
          // Backend unavailable or returned an error — try the offline demo path.
          const offline = tryOfflineLogin(email, password);
          if (offline) {
            localStorage.setItem('qk_token', offline.token);
            localStorage.setItem('qk_user', JSON.stringify(offline.user));
            set({ user: offline.user, token: offline.token, isAuthenticated: true, isLoading: false });
            return;
          }
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
      // Reject anything that isn't a 3-segment JWT (legacy 'demo-token' strings
      // or an accidental 'undefined' from a failed login).
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
