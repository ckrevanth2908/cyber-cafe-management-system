import axios from 'axios';

let rawBase = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api/v1' : 'http://localhost:5000/api/v1');
if (rawBase && !rawBase.endsWith('/api/v1')) {
  rawBase = rawBase.replace(/\/+$/, '') + '/api/v1';
}

const apiClient = axios.create({
  baseURL: rawBase,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('cyber_cafe_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const url = error.config?.url || '';
      const isAuthRoute = url.includes('/auth/login') || url.includes('/auth/me');
      const onLoginPage = window.location.pathname === '/login';
      // Only force-logout on 401 from real data endpoints, not auth-check routes
      if (!isAuthRoute && !onLoginPage) {
        localStorage.removeItem('cyber_cafe_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
