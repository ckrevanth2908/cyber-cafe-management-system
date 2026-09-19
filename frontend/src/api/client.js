import axios from 'axios';

let rawBase = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api/v1' : 'http://localhost:5000/api/v1');
if (rawBase && !rawBase.endsWith('/api/v1')) {
  rawBase = rawBase.replace(/\/+$/, '') + '/api/v1';
}

const apiClient = axios.create({
  baseURL: rawBase,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 15000 // 15 seconds timeout
});

// Clean response interceptor: return data directly, log errors cleanly without redirect loops
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log network/backend status in console for debugging
    if (error.response) {
      console.warn(`[API] ${error.config?.method?.toUpperCase()} ${error.config?.url} returned ${error.response.status}`);
    } else {
      console.warn(`[API Network Error] ${error.message}`);
    }
    return Promise.reject(error);
  }
);

export default apiClient;
