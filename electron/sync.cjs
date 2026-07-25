'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { safeStorage, app } = require('electron');
const db = require('./db.cjs');

// Background sync engine (main process). Bidirectional, last-write-wins,
// UPSERT-ONLY (never deletes). Push-before-pull; single-flight; keyset-paginated.
// Metadata lives in the sqlite `sync_meta` table (travels with the DB backup).
//
// PUSH  advances a LOCAL-clock watermark (push_cursor). Rows the cloud rejects
//       (e.g. a NOT-NULL violation) are reported back and parked in the
//       `sync_dead_letter` TABLE so they are re-pushed every cycle — the
//       watermark can advance without ever silently dropping a write. The set is
//       a table (never a capped blob) so it can't evict a still-failing row, and
//       the watermark advance + failure recording are one atomic transaction so a
//       crash can't advance the cursor past unrecorded failures.
// PULL  filters/paginates on the cloud's server-assigned arrival clock
//       (serverUpdatedAt), NOT the client business updatedAt, so a row pushed with
//       a backdated updatedAt is still delivered here. The watermark is the DB
//       clock minus a small overlap; re-pulled rows are idempotent no-ops (LWW).

const SYNC_ENTITIES = ['members', 'memberrelationships', 'departments', 'events', 'givings', 'expenditures', 'attendances', 'sermons', 'properties', 'smallgroups', 'smallgroupmembers', 'pastoralcares', 'volunteers', 'announcements', 'churchsettings'];
const MODEL_OF = { members: 'member', memberrelationships: 'memberRelationship', departments: 'department', events: 'event', givings: 'giving', expenditures: 'expenditure', attendances: 'attendance', sermons: 'sermon', properties: 'property', smallgroups: 'smallGroup', smallgroupmembers: 'smallGroupMember', pastoralcares: 'pastoralCare', volunteers: 'volunteer', announcements: 'announcement', churchsettings: 'churchSettings' };
// Per-church singleton tables merge into their single local row on pull.
const SINGLETON_MODELS = new Set(['churchSettings']);

const PUSH_LIMIT = 200;
const PULL_LIMIT = 300;
const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const PULL_OVERLAP_MS = 2 * 60 * 1000;   // re-scan the last 2 min each pull (idempotent) to close the concurrent-commit race
const FETCH_TIMEOUT_MS = 30 * 1000;      // never let one hung request wedge the single-flight guard

let _mainWindow = null;
let _cloudUrl = 'https://church.frozenbit.eu';
let _running = false;
let _timer = null;
let _state = 'idle';   // idle | syncing | offline | auth | error
let _online = true;

function init(mainWindow, opts = {}) {
  _mainWindow = mainWindow;
  if (opts.cloudUrl) _cloudUrl = opts.cloudUrl;
}

// Re-point at the live window if it was destroyed and recreated (macOS reopen),
// so status pushes keep reaching the renderer.
function setWindow(mainWindow) { _mainWindow = mainWindow; }

// ── token storage (encrypted via safeStorage when available) ────────────────────
function storeToken(token) {
  if (!token) { db.syncMeta.set('sync_token', null); db.syncMeta.set('sync_token_enc', '0'); return; }
  try {
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      db.syncMeta.set('sync_token', safeStorage.encryptString(token).toString('base64'));
      db.syncMeta.set('sync_token_enc', '1');
      return;
    }
  } catch { /* fall through to plaintext */ }
  db.syncMeta.set('sync_token', token);
  db.syncMeta.set('sync_token_enc', '0');
}
function loadToken() {
  const raw = db.syncMeta.get('sync_token');
  if (!raw) return null;
  if (db.syncMeta.get('sync_token_enc') === '1') {
    try { return safeStorage.decryptString(Buffer.from(raw, 'base64')); } catch { return null; }
  }
  return raw;
}

function deviceId() {
  let id = db.syncMeta.get('device_id');
  if (!id) { id = crypto.randomUUID(); db.syncMeta.set('device_id', id); }
  return id;
}

function isEnabled() { return db.syncMeta.get('enabled') === '1'; }

// One-time migration: drain the v1.5.0 JSON retry blob into the dead-letter table.
function drainLegacyRetrySet() {
  const legacy = db.syncMeta.get('push_retry');
  if (!legacy) return;
  try { const arr = JSON.parse(legacy); if (Array.isArray(arr)) db.deadLetter.addMany(arr); } catch { /* ignore */ }
  db.syncMeta.set('push_retry', null);
}

function getStatus() {
  const enabled = isEnabled();
  return {
    enabled,
    churchId: db.syncMeta.get('church_id') || null,
    lastSyncAt: db.syncMeta.get('last_sync_at') || null,
    lastError: db.syncMeta.get('last_error') || null,
    pending: db.deadLetter.count(),
    state: enabled ? _state : 'disabled',
    online: _online,
  };
}

function reportStatus(patch = {}) {
  if (patch.state !== undefined) _state = patch.state;
  if (patch.online !== undefined) _online = patch.online;
  try { _mainWindow?.webContents?.send('sync:status', getStatus()); } catch { /* window gone */ }
}

// Called by server.cjs when a device activates (fresh installs get sync for free).
// Persists the three identity keys: church_id + clerk_id (from the cloud) and the
// device_id (already stored). All three are also embedded in the signed sync_token.
function storeActivationCredentials({ church_id, sync_token, clerk_id }) {
  if (!church_id || !sync_token) return;
  db.syncMeta.set('church_id', church_id);
  if (clerk_id) db.syncMeta.set('clerk_id', clerk_id);
  storeToken(sync_token);
  db.syncMeta.set('enabled', '1');
  setTimeout(() => runSync({ reason: 'activation' }), 3000);
}

async function fetchJson(url, options, timeoutMs = FETCH_TIMEOUT_MS) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ctl.signal });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  } finally { clearTimeout(t); }
}

// Enable sync on an already-activated install: re-verify the cloud password once
// (its plaintext is gone, so we cannot reuse it) to mint a fresh device token.
async function enableSync({ email, password }) {
  try {
    const { status, json: data } = await fetchJson(`${_cloudUrl}/api/desktop/verify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, device_id: deviceId() }),
    });
    if (status !== 200 || !data.ok) return { ok: false, error: data.error || 'Invalid email or password' };
    if (!data.church_id || !data.sync_token) return { ok: false, error: 'Your account is not linked to a church yet. Finish setup on church.frozenbit.eu first.' };
    db.syncMeta.set('church_id', data.church_id);
    if (data.user?.clerk_id) db.syncMeta.set('clerk_id', data.user.clerk_id);
    storeToken(data.sync_token);
    db.syncMeta.set('enabled', '1');
    db.syncMeta.set('last_error', null);
    runSync({ reason: 'enable' });
    return { ok: true };
  } catch {
    return { ok: false, error: 'No internet connection. Connect to the internet and try again.' };
  }
}

function disableSync() {
  db.syncMeta.set('enabled', '0');
  reportStatus({ state: 'disabled' });
}

async function cloudPost(token, body) {
  return fetchJson(`${_cloudUrl}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

// Push one entity's rows (chunked). Returns the ids the cloud reported as failed.
async function pushEntityRows(token, entity, rows) {
  const failed = [];
  for (let i = 0; i < rows.length; i += PUSH_LIMIT) {
    const chunk = rows.slice(i, i + PUSH_LIMIT);
    const { status, json } = await cloudPost(token, { op: 'push', changes: { [entity]: chunk } });
    if (status === 401) throw Object.assign(new Error('auth'), { kind: 'auth' });
    if (!json.ok) throw new Error(json.error || 'push failed');
    if (json.failed && Array.isArray(json.failed[entity])) failed.push(...json.failed[entity].map(String));
  }
  return failed;
}

// ── File sync (media bytes) ─────────────────────────────────────────────────
const FILE_MAX_BUFFERED = 4 * 1024 * 1024;   // buffered cloud-upload limit (Vercel body cap)
const FILE_MAX_LARGE = 500 * 1024 * 1024;    // above this, a file stays device-local (matches R2 presign cap)
const PREFETCH_MAX = 25 * 1024 * 1024;       // auto-cache pulled files up to this size
const LOCAL_UPLOAD_RE = /^http:\/\/(?:localhost|127\.0\.0\.1):\d+\/uploads\/(.+)$/;
const BLOB_URL_RE = /\.blob\.vercel-storage\.com\//;
// Must cover every extension the cloud R2 allowlists accept (api/r2-presign.js
// SERMON_TYPES/RECEIPT_TYPES) or a supported file staged on the desktop guesses to
// octet-stream, gets 415'd at presign, and is silently orphaned (its localhost URL
// is NULLed on the metadata push). heic/heif = iPhone photo receipts; aac/mkv sermons.
const CT_BY_EXT = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.heic': 'image/heic', '.heif': 'image/heif', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska', '.pdf': 'application/pdf' };

function userData() { return app.getPath('userData'); }
function guessContentType(p) { return CT_BY_EXT[path.extname(p).toLowerCase()] || 'application/octet-stream'; }
function localPathFromUrl(url) {
  const m = LOCAL_UPLOAD_RE.exec(url || '');
  return m ? path.join(userData(), 'uploads', decodeURIComponent(m[1])) : null;
}
function cacheKey(url) { return crypto.createHash('sha256').update(url).digest('hex'); }

// Copy a just-uploaded local file into the media cache under its canonical key,
// so it keeps rendering offline the instant its field flips to the Blob URL.
function cacheLocalAs(canonicalUrl, srcPath) {
  const dest = path.join(userData(), 'media-cache', cacheKey(canonicalUrl));
  if (fs.existsSync(dest)) return;
  fs.copyFileSync(srcPath, dest);
  try { fs.writeFileSync(dest + '.meta', JSON.stringify({ contentType: guessContentType(srcPath), size: fs.statSync(srcPath).size, url: canonicalUrl })); } catch {}
}

// Upload one local file, routing by what it is:
//   sermon file_url      -> public R2 (presigned PUT), returns { url }
//   expenditure receipt  -> private R2 (presigned PUT), returns { key }
//   logos/photos/thumbs  -> Vercel Blob (unchanged),   returns { url }
// Return shapes: { url } | { key } (success) | { skip: true } (deterministic
// failure — don't retry this session) | null (transient — retry next cycle).
// Throws only on auth. The desktop holds no R2 creds, so R2 uploads go through the
// cloud presign endpoint authed by the device sync token.
async function uploadLocalFile(token, filePath, { churchId, model, field }) {
  if (model === 'sermon' && field === 'file_url') return uploadViaR2Presign(token, filePath, 'sermon');
  if (model === 'expenditure' && field === 'receipt_url') return uploadViaR2Presign(token, filePath, 'receipt');

  // Vercel Blob path (logos, member/property photos, sermon thumbnails).
  let size;
  try { size = fs.statSync(filePath).size; } catch { return null; }
  if (size <= 0 || size > FILE_MAX_LARGE) return null; // absurdly large -> stays local
  try {
    if (size <= FILE_MAX_BUFFERED) {
      const { status, json } = await fetchJson(`${_cloudUrl}/api/upload`, {
        method: 'POST',
        headers: { 'Content-Type': guessContentType(filePath), 'X-Filename': path.basename(filePath), Authorization: `Bearer ${token}` },
        body: fs.readFileSync(filePath),
      }, 120000);
      if (status === 401) throw Object.assign(new Error('auth'), { kind: 'auth' });
      if (status === 413) return { skip: true };
      return json?.file_url ? { url: json.file_url } : null;
    }
    // Large file: direct-to-blob via the client-upload token endpoint.
    if (!churchId) return null;
    const { upload } = await import('@vercel/blob/client');
    const pathname = `churches/${churchId}/${crypto.randomUUID()}${path.extname(filePath).toLowerCase()}`;
    const blob = await upload(pathname, fs.readFileSync(filePath), {
      access: 'public',
      contentType: guessContentType(filePath),
      handleUploadUrl: `${_cloudUrl}/api/blob-upload-token`,
      clientPayload: token,
    });
    return blob?.url ? { url: blob.url } : null;
  } catch (e) {
    if (e?.kind === 'auth') throw e;
    return null; // network/offline -> retry next cycle (field keeps its local URL)
  }
}

// Upload bytes to R2 via a cloud-minted presigned PUT (the size is pinned into the
// signature, so the PUT must carry exactly that many bytes).
async function uploadViaR2Presign(token, filePath, kind) {
  let size;
  try { size = fs.statSync(filePath).size; } catch { return null; }
  if (size <= 0) return { skip: true };
  const contentType = guessContentType(filePath);
  let presign;
  try {
    presign = await fetchJson(`${_cloudUrl}/api/r2-presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ kind, filename: path.basename(filePath), contentType, size }),
    }, 60000);
  } catch { return null; } // offline -> retry
  const { status, json } = presign;
  if (status === 401) throw Object.assign(new Error('auth'), { kind: 'auth' });
  if (status === 400 || status === 413 || status === 415) return { skip: true }; // bad type/size -> permanent
  if (status !== 200 || !json?.uploadUrl) return null; // 5xx/misconfig -> retry
  let put;
  try {
    put = await fetch(json.uploadUrl, { method: 'PUT', body: fs.readFileSync(filePath), headers: { 'Content-Type': json.contentType || contentType } });
  } catch { return null; } // network -> retry
  if (!put.ok) return put.status === 403 ? { skip: true } : null; // 403 = size/sig mismatch (deterministic)
  return kind === 'receipt' ? { key: json.key } : { url: json.fileUrl };
}

// Cache a just-uploaded private receipt's bytes under sha256(KEY) so it renders
// offline immediately (the /api/receipt read path looks here first).
function cacheReceiptLocal(key, srcPath) {
  const dest = path.join(userData(), 'media-cache', crypto.createHash('sha256').update(key).digest('hex'));
  if (fs.existsSync(dest)) return;
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(srcPath, dest);
    fs.writeFileSync(dest + '.meta', JSON.stringify({ contentType: guessContentType(srcPath), size: fs.statSync(srcPath).size, key }));
  } catch { /* best effort */ }
}

function hostnameOf(u) { try { return new URL(u).hostname; } catch { return ''; } }

// Ask the cloud for a short-lived signed GET for a private receipt key, using the
// device sync token. The cloud binds the key to a real receipt in this church
// before signing. Returns the signed URL, or null (offline / not found).
async function signReceiptUrl(key) {
  const token = loadToken();
  if (!token) return null;
  try {
    const { status, json } = await fetchJson(`${_cloudUrl}/api/media/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ key }),
    }, 30000);
    return status === 200 ? (json?.url || null) : null;
  } catch { return null; }
}

// Phase 0: upload any local-only file bytes to the cloud and rewrite the field to
// the canonical Blob URL BEFORE the metadata push, so the push carries the
// portable URL. Covers offline-created files AND legacy uploads/ URLs. The local
// file is never deleted, so a file is never lost.
async function pushLocalFiles(token) {
  const churchId = db.syncMeta.get('church_id');
  let processed = 0;
  for (const entity of SYNC_ENTITIES) {
    const model = MODEL_OF[entity];
    const fields = db.FILE_FIELDS[model];
    if (!fields) continue;
    const rows = db.rowsWithLocalFile(model, fields);
    for (const row of rows) {
      for (const field of fields) {
        if (processed >= 50) return; // bound per-cycle work
        const lp = localPathFromUrl(row[field]);
        if (!lp || !fs.existsSync(lp)) continue;
        if (_skipFiles.has(lp)) continue; // deterministic failure earlier this session
        const result = await uploadLocalFile(token, lp, { churchId, model, field });
        if (!result) continue;                       // transient -> keep local, retry next cycle
        if (result.skip) { _skipFiles.add(lp); continue; } // permanent -> stop re-attempting
        if (result.key) {                            // receipt -> private R2 key
          db.setReceiptKey(row.id, result.key);
          cacheReceiptLocal(result.key, lp);         // finance-gated cache (offline viewing)
          try { fs.unlinkSync(lp); } catch {}        // remove the plaintext copy from the shared /uploads dir
        } else if (result.url) {                     // sermon / logo / photo -> canonical URL
          db.rewriteFileField(model, row.id, field, result.url);
          try { cacheLocalAs(result.url, lp); } catch {}
        }
        processed += 1;
      }
    }
  }
}
// Files that failed deterministically (unsupported type/size/signature) — don't
// re-attempt them every cycle. Cleared on restart (re-tries once, then re-skips).
const _skipFiles = new Set();

// Prefetch a pulled Blob URL into the local cache so it renders offline. Bounded,
// best-effort; never throws into the sync cycle.
async function prefetchUrl(url) {
  const dest = path.join(userData(), 'media-cache', cacheKey(url));
  if (fs.existsSync(dest)) return;
  try {
    const h = await fetch(url, { method: 'HEAD' });
    const len = parseInt(h.headers.get('content-length') || '0', 10);
    if (len && len > PREFETCH_MAX) return; // large: fetched on demand by the proxy instead
    const r = await fetch(url);
    if (!r.ok) return;
    const buf = Buffer.from(await r.arrayBuffer());
    const tmp = dest + '.part';
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, dest);
    try { fs.writeFileSync(dest + '.meta', JSON.stringify({ contentType: r.headers.get('content-type') || 'application/octet-stream', size: buf.length, url })); } catch {}
  } catch { /* offline / failed -> proxy fetches on demand later */ }
}
async function runPrefetch(urls) {
  const list = [...new Set(urls)];
  for (let i = 0; i < list.length; i += 2) {
    await Promise.all(list.slice(i, i + 2).map(prefetchUrl));
  }
}

async function runSync({ reason } = {}) {
  if (_running) return { skipped: true };
  if (!isEnabled()) { reportStatus({ state: 'disabled' }); return { disabled: true }; }
  const token = loadToken();
  if (!token) { reportStatus({ state: 'disabled' }); return { disabled: true }; }

  _running = true;
  reportStatus({ state: 'syncing', online: true });
  const cycleStart = new Date().toISOString(); // local clock -> next push watermark
  try {
    drainLegacyRetrySet();

    // ── RETRY previously-rejected rows first (dead-letter table) ──
    const dead = db.deadLetter.all(); // [{ entity, id }]
    if (dead.length) {
      const byEntity = {};
      for (const it of dead) (byEntity[it.entity] = byEntity[it.entity] || []).push(it.id);
      for (const [entity, ids] of Object.entries(byEntity)) {
        const model = MODEL_OF[entity];
        if (!model) { db.deadLetter.removeMany(entity, ids); continue; } // unknown entity -> drop
        const rows = db.selectByIds(model, ids);
        const present = new Set(rows.map((r) => String(r.id)));
        const gone = ids.filter((id) => !present.has(String(id))); // deleted locally -> stop retrying
        if (gone.length) db.deadLetter.removeMany(entity, gone);
        if (!rows.length) continue;
        const failed = new Set(await pushEntityRows(token, entity, rows));
        const ok = rows.map((r) => String(r.id)).filter((id) => !failed.has(id));
        if (ok.length) db.deadLetter.removeMany(entity, ok);
      }
    }

    // ── PHASE 0: upload local file bytes to Blob, rewrite fields to canonical URLs ──
    await pushLocalFiles(token);

    // ── PUSH delta (local -> cloud) ──
    const pushCursor = db.syncMeta.get('push_cursor') || null;
    const newFailures = [];
    for (const entity of SYNC_ENTITIES) {
      // Singletons are a single row: always re-evaluate them (ignore the global
      // watermark) so a logo set on this device BEFORE churchsettings became a
      // synced entity still pushes up. Cloud LWW makes the re-push idempotent
      // (equal updatedAt -> no update -> serverUpdatedAt unchanged -> no ping-pong).
      const sinceCursor = SINGLETON_MODELS.has(MODEL_OF[entity]) ? null : pushCursor;
      let cursor = null;
      for (;;) {
        const rows = db.selectChangedSince(MODEL_OF[entity], sinceCursor, { limit: PUSH_LIMIT, cursor });
        if (!rows.length) break;
        const { status, json } = await cloudPost(token, { op: 'push', changes: { [entity]: rows } });
        if (status === 401) throw Object.assign(new Error('auth'), { kind: 'auth' });
        if (!json.ok) throw new Error(json.error || 'push failed');
        if (json.failed && Array.isArray(json.failed[entity])) {
          for (const id of json.failed[entity]) newFailures.push({ entity, id: String(id) });
        }
        const last = rows[rows.length - 1];
        cursor = { updatedAt: last.updatedAt, id: last.id };
        if (rows.length < PUSH_LIMIT) break;
      }
    }
    // Advance the watermark and record delta failures ATOMICALLY, so a crash can
    // never leave push_cursor past rows whose failures weren't durably recorded.
    db.runInTransaction(() => {
      db.syncMeta.set('push_cursor', cycleStart);
      db.deadLetter.addMany(newFailures);
    });

    // ── PULL (cloud -> local) ──
    const pullCursor = db.syncMeta.get('pull_cursor') || null;
    let firstServerTime = null; // DB clock at pull start -> safe next pull watermark
    const prefetchUrls = [];
    for (const entity of SYNC_ENTITIES) {
      const ff = db.FILE_FIELDS[MODEL_OF[entity]];
      let cursor = null;
      for (;;) {
        const { status, json } = await cloudPost(token, { op: 'pull', entity, since: pullCursor, cursor, limit: PULL_LIMIT });
        if (status === 401) throw Object.assign(new Error('auth'), { kind: 'auth' });
        if (!json.ok) throw new Error(json.error || 'pull failed');
        if (firstServerTime === null) firstServerTime = json.serverTime || null;
        const rows = json.rows || [];
        if (rows.length) {
          const applyFn = SINGLETON_MODELS.has(MODEL_OF[entity]) ? db.upsertSingleton : db.upsertRemoteRow;
          db.runInTransaction(() => { for (const r of rows) applyFn(MODEL_OF[entity], r); });
          if (ff) for (const r of rows) for (const f of ff) { const v = r[f]; if (typeof v === 'string' && db.isAllowedMediaHost(hostnameOf(v))) prefetchUrls.push(v); }
        }
        if (json.hasMore && json.nextCursor) cursor = json.nextCursor;
        else break;
      }
    }
    if (firstServerTime) {
      const base = Date.parse(firstServerTime);
      const watermark = isNaN(base) ? firstServerTime : new Date(base - PULL_OVERLAP_MS).toISOString();
      db.syncMeta.set('pull_cursor', watermark);
    }
    if (prefetchUrls.length) runPrefetch(prefetchUrls); // fire-and-forget: cache pulled media for offline

    const at = new Date().toISOString();
    db.syncMeta.set('last_sync_at', at);
    const pend = db.deadLetter.count();
    db.syncMeta.set('last_error', pend ? `${pend} pending` : null);
    reportStatus({ state: 'idle', online: true });
    return { ok: true, at };
  } catch (e) {
    const msg = e?.message || 'error';
    if (e?.kind === 'auth') {
      db.syncMeta.set('last_error', 'auth');
      reportStatus({ state: 'auth', online: true });
    } else if (e?.name === 'TypeError' || e?.name === 'AbortError' || /fetch|network|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|abort|timed out/i.test(msg)) {
      db.syncMeta.set('last_error', 'offline');
      reportStatus({ state: 'offline', online: false });
    } else {
      db.syncMeta.set('last_error', msg);
      reportStatus({ state: 'error', online: true });
    }
    return { ok: false, error: msg };
  } finally {
    _running = false;
  }
}

function start() {
  if (_timer) return;
  setTimeout(() => runSync({ reason: 'startup' }), 5000);
  _timer = setInterval(() => runSync({ reason: 'interval' }), SYNC_INTERVAL_MS);
}

module.exports = { init, setWindow, start, getStatus, runSync, enableSync, disableSync, storeActivationCredentials, ensureDeviceId: deviceId, signReceiptUrl };
