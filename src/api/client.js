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

// ── Cloudflare R2 uploads (sermons → public bucket, receipts → private bucket) ──
// Logos + member/property photos keep using uploadFile (Vercel Blob). These two
// route to R2 via a presigned PUT the cloud mints (bytes go straight to R2, never
// through the 4.5 MB function). On the desktop we stage to the local Express server
// first (works offline); the sync push later moves the bytes to R2.
const R2_EXT_CT = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif', '.pdf': 'application/pdf', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska' };
function fileType(file) {
  if (file?.type) return file.type;
  const m = String(file?.name || '').match(/\.[a-z0-9]+$/i);
  return (m && R2_EXT_CT[m[0].toLowerCase()]) || 'application/octet-stream';
}
async function stageLocal(file, nameOverride) {
  const res = await fetch(`${getApiBase()}/api/upload`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || fileType(file), 'X-Filename': nameOverride || file.name, ...(await getAuthHeader()) },
    body: file,
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Upload failed'); }
  return res.json(); // { file_url } — a local http://localhost/uploads/... URL
}
async function r2Put(kind, file) {
  const ct = fileType(file);
  const { uploadUrl, contentType, fileUrl, key } = await request('POST', '/api/r2-presign', { kind, filename: file.name, contentType: ct, size: file.size });
  const put = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': contentType || ct } });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);
  return { fileUrl, key };
}

// Sermon media → public R2. Returns { file_url } (contract preserved).
export async function uploadSermonMedia(file) {
  if (IS_EL) return { file_url: (await stageLocal(file)).file_url };
  const { fileUrl } = await r2Put('sermon', file);
  return { file_url: fileUrl };
}

// Receipt → private R2. Web returns { receipt_key }. Desktop stages locally under an
// UNGUESSABLE name (the /uploads dir is loopback-served without auth) and returns
// { receipt_staging_url }; the sync push moves the bytes to private R2 and mints the key.
export async function uploadReceipt(file) {
  if (IS_EL) {
    const ext = (String(file.name || '').match(/\.[a-z0-9]+$/i) || [''])[0].toLowerCase();
    return { receipt_staging_url: (await stageLocal(file, `receipt-${crypto.randomUUID()}${ext}`)).file_url };
  }
  const { key } = await r2Put('receipt', file);
  return { receipt_key: key };
}

// Resolve a viewable URL for a receipt row (finance-gated on the server).
//  - a local staging URL (offline, just uploaded) → return it directly
//  - an R2 key → web: a 90s single-use signed GET (navigated to directly — no
//    cross-origin blob fetch, so no CORS/leak); desktop: a per-user grant → /api/receipt
//  - a legacy free-text receipt_url → return it directly
export async function getReceiptUrl(row) {
  const stagingUrl = typeof row?.receipt_url === 'string' && /^https?:\/\/(?:localhost|127\.0\.0\.1):\d+\/uploads\//.test(row.receipt_url) ? row.receipt_url : null;
  if (IS_EL) {
    if (stagingUrl) return stagingUrl;
    if (row?.receipt_key) {
      const { url } = await request('POST', '/api/receipt-grant', { key: row.receipt_key });
      return `${getApiBase()}${url}`;
    }
    return row?.receipt_url || null; // legacy pasted link
  }
  if (row?.receipt_key) {
    const { url } = await request('POST', '/api/media/sign', { key: row.receipt_key });
    return url;
  }
  return row?.receipt_url || null; // legacy pasted link
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
