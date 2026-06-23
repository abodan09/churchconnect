// Data client — drop-in replacement for base44.entities.*
// Usage: import { entities, uploadFile, sendEmail } from '@/api/client'

// In Electron local mode, use the embedded Express server. Otherwise use relative paths (Vercel).
function getApiBase() {
  if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
    return window.electronAPI.apiBase || 'http://localhost:14747';
  }
  return '';
}

let __token = null;
let __getToken = null;
export function setAuthToken(t) { __token = t; }
export function setTokenGetter(fn) { __getToken = fn; }

// Works in both Electron (localStorage) and cloud (Clerk) — safe to call anywhere
export async function getToken() {
  if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
    return localStorage.getItem('churchconnect_local_token') || null;
  }
  try { if (__getToken) { const t = await __getToken(); if (t) return t; } } catch {}
  return __token || null;
}

async function getAuthHeader() {
  // Electron local mode: use token from localStorage
  if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
    const t = localStorage.getItem('churchconnect_local_token');
    if (t) return { Authorization: `Bearer ${t}` };
    return {};
  }
  // Cloud mode: use injected Clerk getToken hook (most reliable)
  try {
    if (__getToken) {
      const t = await __getToken();
      if (t) return { Authorization: `Bearer ${t}` };
    }
  } catch {}
  // Fallback: cached token set by ClerkAuthContext
  return __token ? { Authorization: `Bearer ${__token}` } : {};
}

async function request(method, path, body) {
  const url = path.startsWith('http') ? path : `${getApiBase()}${path}`;
  const res = await fetch(url, {
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
  Member:           makeEntity('members'),
  Department:       makeEntity('departments'),
  Event:            makeEntity('events'),
  Giving:           makeEntity('givings'),
  Expenditure:      makeEntity('expenditures'),
  Attendance:       makeEntity('attendances'),
  Sermon:           makeEntity('sermons'),
  Property:         makeEntity('properties'),
  ChurchSettings:   makeEntity('churchsettings'),
  UserProfile:      makeEntity('userprofiles'),
  AccessRequest:    makeEntity('accessrequests'),
  SmallGroup:       makeEntity('smallgroups'),
  SmallGroupMember: makeEntity('smallgroupmembers'),
  PastoralCare:     makeEntity('pastoralcares'),
  Volunteer:        makeEntity('volunteers'),
  Announcement:     makeEntity('announcements'),
};

// Dedicated settings save — uses church_id-based upsert, bypasses entities handler
export async function updateSettings(data) {
  return request('PUT', '/api/settings/update', data);
}

// File upload — replaces base44.integrations.Core.UploadFile
export async function uploadFile(file) {
  const headers = {
    'Content-Type': file.type,
    'X-Filename': file.name,
    ...(await getAuthHeader()),
  };
  const res = await fetch(`${getApiBase()}/api/upload`, { method: 'POST', headers, body: file });
  if (!res.ok) throw new Error('Upload failed');
  return res.json(); // { file_url }
}

// Email — replaces base44.integrations.Core.SendEmail
export async function sendEmail({ to, subject, body, from_name }) {
  return request('POST', '/api/send-email', { to, subject, body, from_name });
}
