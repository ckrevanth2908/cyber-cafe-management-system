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

export default apiClient;
