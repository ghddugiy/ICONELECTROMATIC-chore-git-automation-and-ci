const BUILD_API_BASE_URL = import.meta?.env?.VITE_API_BASE_URL || '';

export function resolveApiBaseUrl(
  runtimeBase = typeof window !== 'undefined' ? window.__ICON_API_BASE__ : '',
  buildBase = BUILD_API_BASE_URL
) {
  return (runtimeBase || buildBase || '/api').replace(/\/+$/, '');
}

const API_BASE_URL = resolveApiBaseUrl();

let csrfToken = null;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const requestHeaders = { ...headers };
  const options = {
    method,
    credentials: 'include',
    headers: requestHeaders,
  };

  if (body !== undefined) {
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      options.body = body;
    } else {
      requestHeaders['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) && csrfToken) {
    requestHeaders['X-CSRF-Token'] = csrfToken;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, options);
  } catch (error) {
    throw new ApiError(`Could not reach the catalog API: ${error.message}`, 0);
  }

  let payload = null;
  if (response.status !== 204) {
    try {
      payload = await response.json();
    } catch {
      throw new ApiError(`The catalog API returned an unreadable response (${response.status}).`, response.status);
    }
  }

  if (!response.ok || (payload && payload.success !== true)) {
    if (response.status === 401) csrfToken = null;
    throw new ApiError(payload?.message || `Catalog API request failed (${response.status}).`, response.status);
  }

  return payload?.data !== undefined ? payload.data : payload;
}

export const ApiService = {
  getBaseUrl() {
    return API_BASE_URL;
  },

  getCsrfToken() {
    return csrfToken;
  },

  setCsrfToken(token) {
    csrfToken = token;
  },

  async login(email, password) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    csrfToken = data.csrfToken;
    return data.admin;
  },

  async getSession() {
    try {
      const data = await request('/auth/session');
      csrfToken = data.csrfToken;
      return data.admin;
    } catch (error) {
      if (error?.status === 401) {
        csrfToken = null;
        return null;
      }
      throw error;
    }
  },

  async logout() {
    const data = await request('/auth/logout', { method: 'POST' });
    csrfToken = null;
    return data;
  },

  get(path) {
    return request(path);
  },

  post(path, body) {
    return request(path, { method: 'POST', body });
  },

  put(path, body) {
    return request(path, { method: 'PUT', body });
  },

  patch(path, body) {
    return request(path, { method: 'PATCH', body });
  },

  delete(path) {
    return request(path, { method: 'DELETE' });
  },

  async uploadMedia(file, folder = 'products') {
    const formData = new FormData();
    formData.append('image', file);
    if (folder) {
      formData.append('folder', folder);
    }
    return request('/media/upload', {
      method: 'POST',
      body: formData,
    });
  },

  async getMedia(id) {
    return request(`/media/${encodeURIComponent(id)}`);
  },

  // ─── Admin Enquiry Management API ──────────────────────────────────────────
  async getAdminEnquiries(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    });
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/admin/enquiries${query}`);
  },

  async getAdminEnquiryStats() {
    return request('/admin/enquiries/stats');
  },

  async getAdminStaff() {
    return request('/admin/enquiries/staff');
  },

  async getAdminEnquiryDetail(id) {
    return request(`/admin/enquiries/${encodeURIComponent(id)}`);
  },

  async updateEnquiryStatus(id, workflowStatus, note, expectedUpdatedAt) {
    return request(`/admin/enquiries/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: { workflowStatus, note, expectedUpdatedAt },
    });
  },

  async assignEnquiry(id, assignedToId, note, expectedUpdatedAt) {
    return request(`/admin/enquiries/${encodeURIComponent(id)}/assign`, {
      method: 'PATCH',
      body: { assignedToId, note, expectedUpdatedAt },
    });
  },

  async logEnquiryCommunication(id, { type, subject, body, metadata }) {
    return request(`/admin/enquiries/${encodeURIComponent(id)}/communications`, {
      method: 'POST',
      body: { type, subject, body, metadata },
    });
  },

  getAdminEnquiriesExportUrl(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    });
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return `${API_BASE_URL}/admin/enquiries/export${query}`;
  },

  getAdminCommunicationsExportUrl(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    });
    qs.set('type', 'communications');
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return `${API_BASE_URL}/admin/enquiries/export${query}`;
  },
};
