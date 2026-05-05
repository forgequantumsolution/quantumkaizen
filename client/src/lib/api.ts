import axios from 'axios';

// Backend mounts routes at /api/* (see backend/src/app.ts). For cross-origin
// deploys (e.g. Vercel + Render), set VITE_API_BASE_URL at build time to an
// absolute URL like 'https://quantumkaizen-api.onrender.com/api'.
const baseURL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || '/api';

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  // Force JSON — if the response isn't JSON-parseable, axios treats it as a
  // network error which trips every hook's catch{} mock fallback.
  responseType: 'json',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('qk_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Always advertise that we want JSON — some static hosts honour this and
  // return a proper error instead of rewriting to index.html.
  config.headers.Accept = 'application/json';
  return config;
});

// ── Detect SPA-fallback responses ────────────────────────────────────────
//
// Vercel (and similar static hosts) rewrites every unknown path — including
// /api/* — to /index.html with status 200. Axios happily returns that
// HTML as `response.data`, which means the hook's `try` branch succeeds with
// nonsense, the `catch` block never runs, and the list page shows nothing.
//
// This interceptor inspects the response and throws when it smells like the
// static host's SPA fallback, so every hook falls through to its mock data.
function looksLikeHtmlFallback(response: unknown): boolean {
  if (!response || typeof response !== 'object') return false;
  const r = response as { headers?: Record<string, unknown>; data?: unknown };
  const ct = (r.headers?.['content-type'] ?? r.headers?.['Content-Type'] ?? '') as string;
  if (typeof ct === 'string' && ct.toLowerCase().includes('text/html')) return true;
  if (typeof r.data === 'string') {
    const trimmed = r.data.trim().slice(0, 32).toLowerCase();
    if (trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html')) return true;
  }
  return false;
}

api.interceptors.response.use(
  (response) => {
    if (looksLikeHtmlFallback(response)) {
      return Promise.reject(new Error('API_UNAVAILABLE_HTML_FALLBACK'));
    }
    return response;
  },
  async (error) => {
    // Redirect to /login only on a genuine 401 from a live backend.
    //
    // In the frontend-only demo deployment there is no backend, so every
    // request fails — we MUST NOT redirect in those cases — the hooks'
    // catch{} blocks fall back to mock data and the app stays usable.
    const status = error.response?.status;
    // The login endpoint itself returns 401 on bad credentials — that's a
    // form-validation failure, not a session expiry. Don't redirect or the
    // page reloads and the user loses the error message.
    const requestUrl = (error.config?.url ?? '') as string;
    const isLoginRequest = requestUrl.includes('/auth/login');
    const isDemoToken =
      typeof localStorage !== 'undefined' &&
      (() => {
        try { return JSON.parse(atob(localStorage.getItem('qk_token')?.split('.')[0] ?? '')).demo === true; }
        catch { return false; }
      })();
    if (status === 401 && !isDemoToken && !isLoginRequest) {
      localStorage.removeItem('qk_token');
      localStorage.removeItem('qk_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
