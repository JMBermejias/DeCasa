const base = '/api';

async function request(path, options = {}) {
  const res = await fetch(base + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error en la petición');
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path) => request(path, { method: 'DELETE' }),

  summary: () => request('/dashboard/summary'),
  topProducts: () => request('/dashboard/top-products'),
  earnings: (period) => request('/dashboard/earnings?period=' + period),
  recentSales: () => request('/dashboard/recent-sales'),
  balance: () => request('/balance'),

  searchProducts: (query, category, store_id) =>
    request('/products/search', { method: 'POST', body: JSON.stringify({ query, category, store_id }) }),
  getProducts: (status) => request('/products' + (status ? '?status=' + status : '')),
  acceptProduct: (id, store_id) => request(`/products/${id}/accept`, { method: 'POST', body: JSON.stringify({ store_id }) }),
  rejectProduct: (id) => request(`/products/${id}/reject`, { method: 'POST', body: JSON.stringify({}) }),
  acceptBatch: (ids, store_id) => request('/products/batch/accept', { method: 'POST', body: JSON.stringify({ ids, store_id }) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),

  getStores: () => request('/stores'),
  createStore: (body) => request('/stores', { method: 'POST', body: JSON.stringify(body) }),
  updateStore: (id, body) => request(`/stores/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  uploadStore: (id) => request(`/stores/${id}/upload`, { method: 'POST', body: JSON.stringify({}) }),
  autoUpdateStore: (id) => request(`/stores/${id}/auto-update`, { method: 'POST', body: JSON.stringify({}) }),
  deleteStore: (id) => request(`/stores/${id}`, { method: 'DELETE' }),
  publicStore: (slug) => request(`/stores/${slug}/public`),

  getAffiliates: () => request('/affiliate-accounts'),
  createAffiliate: (body) => request('/affiliate-accounts', { method: 'POST', body: JSON.stringify(body) }),
  updateAffiliate: (id, body) => request(`/affiliate-accounts/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteAffiliate: (id) => request(`/affiliate-accounts/${id}`, { method: 'DELETE' }),

  getMethods: () => request('/payment-methods'),
  createMethod: (body) => request('/payment-methods', { method: 'POST', body: JSON.stringify(body) }),
  updateMethod: (id, body) => request(`/payment-methods/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteMethod: (id) => request(`/payment-methods/${id}`, { method: 'DELETE' }),

  getWithdrawals: () => request('/withdrawals'),
  requestWithdrawal: (body) => request('/withdrawals', { method: 'POST', body: JSON.stringify(body) }),
  setWithdrawalStatus: (id, status) => request(`/withdrawals/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  deleteWithdrawal: (id) => request(`/withdrawals/${id}`, { method: 'DELETE' }),

  addSale: (body) => request('/sales', { method: 'POST', body: JSON.stringify(body) }),
  addClicks: (body) => request('/clicks', { method: 'POST', body: JSON.stringify(body) }),

  getSettings: () => request('/settings'),
  saveSettings: (section, values) => request('/settings', { method: 'PUT', body: JSON.stringify({ section, ...values }) })
};

export const money = (v, currency = 'EUR') =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(v || 0);
