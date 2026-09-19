import apiClient from './client';

export const authApi = {
  login: async (username, password) => {
    const response = await apiClient.post('/auth/login', { username, password });
    return response.data;
  },
  getMe: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  }
};

export const customersApi = {
  list: async (search = '') => {
    const response = await apiClient.get('/customers', { params: { search } });
    return response.data;
  },
  get: async (id) => {
    const response = await apiClient.get(`/customers/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await apiClient.post('/customers', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await apiClient.put(`/customers/${id}`, data);
    return response.data;
  }
};

export const terminalsApi = {
  list: async () => {
    const response = await apiClient.get('/terminals');
    return response.data;
  },
  types: async () => {
    const response = await apiClient.get('/terminals/types');
    return response.data;
  },
  statusSummary: async () => {
    const response = await apiClient.get('/terminals/status-summary');
    return response.data;
  },
  create: async (data) => {
    const response = await apiClient.post('/terminals', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await apiClient.put(`/terminals/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await apiClient.delete(`/terminals/${id}`);
    return response.data;
  },
  updateStatus: async (id, status) => {
    const response = await apiClient.patch(`/terminals/${id}/status`, { status });
    return response.data;
  },
  freeTerminal: async (id) => {
    const response = await apiClient.post(`/terminals/${id}/free`);
    return response.data;
  }
};

export const ratesApi = {
  list: async () => {
    const response = await apiClient.get('/rates');
    return response.data;
  },
  update: async (id, data) => {
    const response = await apiClient.put(`/rates/${id}`, data);
    return response.data;
  },
  bulkUpdate: async (data) => {
    const response = await apiClient.put('/rates/bulk', data);
    return response.data;
  }
};

export const printersApi = {
  list: async () => {
    const response = await apiClient.get('/printers');
    return response.data;
  },
  create: async (data) => {
    const response = await apiClient.post('/printers', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await apiClient.put(`/printers/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await apiClient.delete(`/printers/${id}`);
    return response.data;
  }
};

export const allocationsApi = {
  allocate: async (data) => {
    const response = await apiClient.post('/allocations', data);
    return response.data;
  },
  listActive: async () => {
    const response = await apiClient.get('/allocations/active');
    return response.data;
  },
  release: async (id) => {
    const response = await apiClient.post(`/allocations/${id}/release`);
    return response.data;
  }
};

export const sessionsApi = {
  list: async (params = {}) => {
    const response = await apiClient.get('/sessions', { params });
    return response.data;
  },
  get: async (id) => {
    const response = await apiClient.get(`/sessions/${id}`);
    return response.data;
  },
  endSession: async (id) => {
    const response = await apiClient.post(`/sessions/${id}/end`);
    return response.data;
  },
  historySummary: async () => {
    const response = await apiClient.get('/sessions/history-summary');
    return response.data;
  }
};

export const queueApi = {
  list: async () => {
    const response = await apiClient.get('/queue');
    return response.data;
  },
  add: async (data) => {
    const response = await apiClient.post('/queue', data);
    return response.data;
  },
  cancel: async (id) => {
    const response = await apiClient.post(`/queue/${id}/cancel`);
    return response.data;
  }
};

export const printingApi = {
  list: async (params = {}) => {
    const response = await apiClient.get('/printing', { params });
    return response.data;
  },
  get: async (id) => {
    const response = await apiClient.get(`/printing/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await apiClient.post('/printing', data);
    return response.data;
  }
};

export const billingApi = {
  preview: async (sessionId) => {
    const response = await apiClient.get(`/billing/preview/${sessionId}`);
    return response.data;
  },
  finalize: async (sessionId, paymentMethod) => {
    const response = await apiClient.post(`/billing/finalize/${sessionId}`, { method: paymentMethod });
    return response.data;
  },
  receipts: async () => {
    const response = await apiClient.get('/billing/receipts');
    return response.data;
  }
};

export const revenueApi = {
  daily: async (date) => {
    const response = await apiClient.get('/revenue/daily', { params: { date } });
    return response.data;
  },
  summary: async (from, to) => {
    const response = await apiClient.get('/revenue/summary', { params: { from, to } });
    return response.data;
  },
  sessionsToday: async () => {
    const response = await apiClient.get('/revenue/sessions-today');
    return response.data;
  }
};

export const adminApi = {
  getConfig: async () => {
    const response = await apiClient.get('/admin/config');
    return response.data;
  },
  updateConfig: async (data) => {
    const response = await apiClient.put('/admin/config', data);
    return response.data;
  },
  getStats: async () => {
    const response = await apiClient.get('/admin/stats');
    return response.data;
  }
};
