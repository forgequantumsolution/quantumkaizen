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
    // Only redirect to login on actual 401 responses from the API
    // Do NOT redirect on network errors (backend not running)
    if (error.response?.status === 401) {
      localStorage.removeItem('qk_token');
      localStorage.removeItem('qk_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
