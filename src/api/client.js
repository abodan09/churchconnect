// Data client — drop-in replacement for base44.entities.*
// Usage: import { entities, uploadFile, sendEmail } from '@/api/client'

let __token = null;
export function setAuthToken(t) { __token = t; }

async function getAuthHeader() {
  // Prefer a fresh Clerk session token; fall back to the cached one
  try {
    const t = await window.Clerk?.session?.getToken();
    if (t) return { Authorization: `Bearer ${t}` };
  } catch {}
  return __token ? { Authorization: `Bearer ${__token}` } : {};
}

async function request(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

function makeEntity(resource) {
  const base = `/api/entities/${resource}`;
  return {
    list: (sort, limit) => {
      const params = new URLSearchParams();
      if (sort) params.set('sort', sort);
      if (limit) params.set('limit', String(limit));
      const qs = params.toString();
      return request('GET', qs ? `${base}?${qs}` : base);
    },
    filter: (criteria) => {
      const params = new URLSearchParams(criteria || {});
      return request('GET', `${base}?${params}`);
    },
    get: (id) => request('GET', `${base}/${id}`),
    create: (data) => request('POST', base, data),
    update: (id, data) => request('PUT', `${base}/${id}`, data),
    delete: (id) => request('DELETE', `${base}/${id}`),
  };
}

export const entities = {
  Member:         makeEntity('members'),
  Department:     makeEntity('departments'),
  Event:          makeEntity('events'),
  Giving:         makeEntity('givings'),
  Expenditure:    makeEntity('expenditures'),
  Attendance:     makeEntity('attendances'),
  Sermon:         makeEntity('sermons'),
  Property:       makeEntity('properties'),
  ChurchSettings: makeEntity('churchsettings'),
  UserProfile:    makeEntity('userprofiles'),
  AccessRequest:  makeEntity('accessrequests'),
};

// File upload — replaces base44.integrations.Core.UploadFile
export async function uploadFile(file) {
  const headers = {
    'Content-Type': file.type,
    'X-Filename': file.name,
    ...(await getAuthHeader()),
  };
  const res = await fetch('/api/upload', { method: 'POST', headers, body: file });
  if (!res.ok) throw new Error('Upload failed');
  return res.json(); // { file_url }
}

// Email — replaces base44.integrations.Core.SendEmail
export async function sendEmail({ to, subject, body, from_name }) {
  return request('POST', '/api/send-email', { to, subject, body, from_name });
}
