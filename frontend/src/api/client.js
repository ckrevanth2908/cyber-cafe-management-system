import axios from 'axios';

// Live production Render backend URL
const DEFAULT_API_URL = 'https://cyber-cafe-management-system-1-tv7h.onrender.com/api/v1';

let rawBase = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_URL;

if (rawBase && !rawBase.endsWith('/api/v1')) {
  rawBase = rawBase.replace(/\/+$/, '') + '/api/v1';
}

const apiClient = axios.create({
  baseURL: rawBase,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 20000
});

// Response interceptor: ensure data is parsed JSON and log cleanly
apiClient.interceptors.response.use(
  (response) => {
    // Sanity check: if server returned HTML index page instead of JSON, treat as error
    if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
      return Promise.reject(new Error('Received HTML instead of JSON API response.'));
    }
    return response;
  },
  (error) => {
    if (error.response) {
      console.warn(`[API] ${error.config?.method?.toUpperCase()} ${error.config?.url} -> ${error.response.status}`);
    } else {
      console.warn(`[API Error] ${error.message}`);
    }
    return Promise.reject(error);
  }
);

export default apiClient;
