import axios from 'axios';

// In local Docker the nginx sidecar proxies /api/* to the backend, so '/api/v1'
// is correct. In deploys where the frontend and backend live on different
// origins (e.g. Vercel + Render), set VITE_API_BASE_URL at build time to an
// absolute URL like 'https://quantumkaizen-api.onrender.com/api/v1'.
const baseURL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || '/api/v1';

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('qk_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Redirect to /login only on a genuine 401 from a live backend.
    //
    // In the frontend-only demo deployment there is no backend, so every
    // request gets 405 Method Not Allowed (POST) or 404 (GET) from the
    // static host. We MUST NOT redirect in those cases — the hooks'
    // catch{} blocks fall back to mock data and the app stays usable.
    const status = error.response?.status;
    const isDemoToken =
      typeof localStorage !== 'undefined' &&
      (() => {
        try { return JSON.parse(atob(localStorage.getItem('qk_token')?.split('.')[0] ?? '')).demo === true; }
        catch { return false; }
      })();
    if (status === 401 && !isDemoToken) {
      localStorage.removeItem('qk_token');
      localStorage.removeItem('qk_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
