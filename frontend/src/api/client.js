import axios from 'axios';

let rawBase = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api/v1' : 'http://localhost:5000/api/v1');
if (rawBase && !rawBase.endsWith('/api/v1')) {
  rawBase = rawBase.replace(/\/+$/, '') + '/api/v1';
}

const apiClient = axios.create({
  baseURL: rawBase,
  headers: { 'Content-Type': 'application/json' },
});

// ── Token Management ──────────────────────────────────────────────────────────
// Attach stored token to every request (if present)
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('cyber_cafe_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auto-Login on 401 ─────────────────────────────────────────────────────────
// If the backend returns 401 (old Render deploy still requires auth),
// silently login with default credentials, store the token, and retry once.
// When the new backend (no-auth) is deployed, 401s won't happen and this
// interceptor is never triggered.

let _isRefreshing = false;
let _retryQueue = [];

const processQueue = (token) => {
  _retryQueue.forEach(({ resolve, reject, config }) => {
    config.headers.Authorization = `Bearer ${token}`;
    resolve(apiClient(config));
  });
  _retryQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only auto-login on 401 errors that aren't from the login endpoint itself
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      if (_isRefreshing) {
        // Queue this request until token is refreshed
        return new Promise((resolve, reject) => {
          _retryQueue.push({ resolve, reject, config: originalRequest });
        });
      }

      originalRequest._retry = true;
      _isRefreshing = true;

      try {
        // Silently login with default admin credentials
        const loginRes = await axios.post(`${rawBase}/auth/login`, {
          username: 'admin',
          password: 'admin123',
        });
        const token = loginRes.data.token || loginRes.data.access_token;
        localStorage.setItem('cyber_cafe_token', token);
        apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
        originalRequest.headers.Authorization = `Bearer ${token}`;
        processQueue(token);
        _isRefreshing = false;
        return apiClient(originalRequest); // retry original request with new token
      } catch (loginErr) {
        _isRefreshing = false;
        _retryQueue = [];
        console.error('Auto-login failed:', loginErr?.response?.data || loginErr.message);
        return Promise.reject(error); // give up, let caller handle
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
