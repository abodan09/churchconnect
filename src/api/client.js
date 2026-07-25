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
  Member:            makeEntity('members'),
  MemberRelationship:makeEntity('memberrelationships'),
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
// Cloud + large file (> 4 MB): upload straight to Vercel Blob (the serverless
// function caps request bodies at 4.5 MB). Small files, and ALL Electron uploads
// (which hit the local Express server / disk, no size limit), stream to /api/upload.
export async function uploadFile(file, churchId) {
  const isEl = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
  if (!isEl && file.size > 4 * 1024 * 1024) {
    if (!churchId) throw new Error('This file is large — a church context is required to upload it.');
    const { upload } = await import('@vercel/blob/client');
    const ext = (file.name.match(/\.[a-z0-9]+$/i) || [''])[0].toLowerCase();
    const pathname = `churches/${churchId}/${crypto.randomUUID()}${ext}`;
    const token = await getToken();
    const blob = await upload(pathname, file, {
      access: 'public',
      contentType: file.type,
      handleUploadUrl: `${getApiBase()}/api/blob-upload-token`,
      clientPayload: token || '',
    });
    return { file_url: blob.url };
  }
  const headers = {
    'Content-Type': file.type,
    'X-Filename': file.name,
    ...(await getAuthHeader()),
  };
  const res = await fetch(`${getApiBase()}/api/upload`, { method: 'POST', headers, body: file });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Upload failed');
  }
  return res.json(); // { file_url }
}

// Email — replaces base44.integrations.Core.SendEmail
export async function sendEmail({ to, subject, body, from_name }) {
  return request('POST', '/api/send-email', { to, subject, body, from_name });
}

// ── Admin user management (roles, invites, direct-create) ─────────────────────
// One surface over two backends: the cloud church-users endpoint (Clerk-backed,
// supports email invites) and the offline embedded server (local users, create-only).
const IS_EL = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
const CU_BASE = IS_EL ? '/api/auth/users' : '/api/church-users';

export const churchUsers = {
  supportsInvite: !IS_EL,
  async list() {
    const rows = await request('GET', CU_BASE);
    return (rows || []).map(r => IS_EL
      ? { key: r.id, name: r.full_name || r.email || '—', email: r.email || null, role: r.role, departmentId: r.department_id || null, isSelf: !!r.isSelf }
      : { key: r.clerkId, name: r.name || '—', email: r.email || null, role: r.role, departmentId: r.departmentId || null, isSelf: !!r.isSelf, imageUrl: r.imageUrl || null });
  },
  add({ mode, email, first_name, last_name, role, department_id, member_id }) {
    const full_name = [first_name, last_name].filter(Boolean).join(' ').trim() || undefined;
    return request('POST', CU_BASE, { mode: mode || (IS_EL ? 'create' : 'invite'), email, first_name, last_name, full_name, role, department_id, member_id });
  },
  setRole({ target, role, department_id }) {
    // send every target-key alias; each backend reads the one it uses
    return request('PATCH', CU_BASE, { target, target_clerk_id: target, target_id: target, role, department_id });
  },
};
