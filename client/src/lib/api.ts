import axios from 'axios';

export const api = axios.create({
  baseURL: '/api/v1',
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
