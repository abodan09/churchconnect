'use strict';
const Database = require('better-sqlite3');
const path = require('path');
const { randomUUID } = require('crypto');

let _db = null;

const TABLE_MAP = {
  member: 'members',
  memberRelationship: 'member_relationships',
  department: 'departments',
  event: 'events',
  giving: 'givings',
  expenditure: 'expenditures',
  attendance: 'attendances',
  sermon: 'sermons',
  property: 'properties',
  churchSettings: 'church_settings',
  userProfile: 'user_profiles',
  accessRequest: 'access_requests',
  smallGroup: 'small_groups',
  smallGroupMember: 'small_group_members',
  pastoralCare: 'pastoral_cares',
  volunteer: 'volunteers',
  announcement: 'announcements',
};

const BOOL_FIELDS = {
  departments: ['media_upload_enabled', 'is_active'],
  events: ['is_public'],
  small_groups: ['is_active', 'is_open'],
  small_group_members: ['is_active'],
  pastoral_cares: ['is_private'],
  volunteers: ['checked_in'],
  announcements: ['is_pinned', 'is_active'],
};

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS local_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'super_admin',
  department_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS sync_dead_letter (
  entity TEXT NOT NULL,
  id TEXT NOT NULL,
  failed_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (entity, id)
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  clerkId TEXT UNIQUE,
  role TEXT DEFAULT 'member',
  departmentId TEXT,
  phone TEXT,
  profilePhotoUrl TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  department_id TEXT,
  department_name TEXT,
  join_date TEXT,
  membership_status TEXT DEFAULT 'active',
  profile_photo_url TEXT,
  gender TEXT,
  date_of_birth TEXT,
  marital_status TEXT,
  occupation TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  notes TEXT,
  user_id TEXT,
  baptism_date TEXT,
  membership_class_date TEXT,
  confirmation_date TEXT,
  volunteer_status TEXT,
  background_check_date TEXT,
  created_by_id TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS member_relationships (
  id TEXT PRIMARY KEY,
  church_id TEXT,
  member_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  related_member_id TEXT,
  related_name TEXT,
  related_phone TEXT,
  related_email TEXT,
  related_notes TEXT,
  created_by_id TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  head_name TEXT,
  head_user_id TEXT,
  media_upload_enabled INTEGER DEFAULT 0,
  allowed_media_types TEXT DEFAULT 'none',
  is_active INTEGER DEFAULT 1,
  color TEXT,
  allowed_features TEXT,
  created_by_id TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  department_id TEXT,
  department_name TEXT,
  start_datetime TEXT NOT NULL,
  end_datetime TEXT,
  location TEXT,
  event_type TEXT DEFAULT 'service',
  is_public INTEGER DEFAULT 1,
  created_by_name TEXT,
  created_by_id TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS givings (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  member_name TEXT,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  type TEXT DEFAULT 'tithe',
  payment_method TEXT DEFAULT 'cash',
  service_or_event TEXT,
  notes TEXT,
  recorded_by TEXT,
  created_by_id TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expenditures (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  department_id TEXT,
  department_name TEXT,
  approval_status TEXT DEFAULT 'pending',
  approved_by TEXT,
  approved_date TEXT,
  receipt_url TEXT,
  receipt_key TEXT,
  notes TEXT,
  created_by_id TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attendances (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  event_name TEXT,
  event_date TEXT,
  member_id TEXT NOT NULL,
  member_name TEXT,
  department_id TEXT,
  department_name TEXT,
  check_in_time TEXT,
  status TEXT DEFAULT 'present',
  checked_in_by TEXT,
  notes TEXT,
  created_by_id TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sermons (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  preacher TEXT NOT NULL,
  date TEXT NOT NULL,
  department_id TEXT,
  department_name TEXT,
  media_type TEXT,
  file_url TEXT,
  thumbnail_url TEXT,
  duration_minutes REAL,
  tags TEXT,
  created_by_id TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  location_or_serial TEXT,
  purchase_date TEXT,
  purchase_value REAL,
  current_condition TEXT,
  assigned_department_id TEXT,
  assigned_department_name TEXT,
  maintenance_notes TEXT,
  photo_url TEXT,
  created_by_id TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS church_settings (
  id TEXT PRIMARY KEY,
  church_name TEXT NOT NULL,
  logo_url TEXT,
  language TEXT DEFAULT 'en',
  currency_code TEXT DEFAULT 'EUR',
  currency_symbol TEXT DEFAULT '€',
  theme_primary TEXT,
  theme_secondary TEXT,
  theme_tertiary TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS access_requests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  social_platform TEXT DEFAULT 'other',
  social_handle TEXT,
  message TEXT,
  status TEXT DEFAULT 'pending',
  requested_at TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  rejection_reason TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS small_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'bible_study',
  description TEXT,
  leader_id TEXT,
  leader_name TEXT,
  co_leader_name TEXT,
  meeting_day TEXT,
  meeting_time TEXT,
  meeting_frequency TEXT DEFAULT 'weekly',
  location TEXT,
  max_capacity INTEGER,
  is_active INTEGER DEFAULT 1,
  is_open INTEGER DEFAULT 1,
  department_id TEXT,
  department_name TEXT,
  notes TEXT,
  created_by_id TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS small_group_members (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  group_name TEXT,
  member_id TEXT NOT NULL,
  member_name TEXT,
  role TEXT DEFAULT 'member',
  joined_date TEXT,
  is_active INTEGER DEFAULT 1,
  notes TEXT,
  created_by_id TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pastoral_cares (
  id TEXT PRIMARY KEY,
  member_id TEXT,
  member_name TEXT,
  type TEXT DEFAULT 'prayer_request',
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'normal',
  assigned_to TEXT,
  assigned_name TEXT,
  resolved_date TEXT,
  resolution_notes TEXT,
  is_private INTEGER DEFAULT 0,
  submitted_by TEXT,
  created_by_id TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS volunteers (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  member_name TEXT,
  event_id TEXT,
  event_name TEXT,
  event_date TEXT,
  department_id TEXT,
  department_name TEXT,
  role TEXT,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  checked_in INTEGER DEFAULT 0,
  created_by_id TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  audience TEXT DEFAULT 'all',
  department_id TEXT,
  department_name TEXT,
  published_by TEXT,
  publish_date TEXT,
  expiry_date TEXT,
  is_pinned INTEGER DEFAULT 0,
  priority TEXT DEFAULT 'normal',
  is_active INTEGER DEFAULT 1,
  created_by_id TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);
`;

function initDb(userDataPath) {
  if (_db) return _db;
  const dbPath = path.join(userDataPath, 'churchconnect.db');
  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.exec(SCHEMA_SQL);
  // Migrate existing databases — add new columns if not present
  for (const col of ['theme_primary', 'theme_secondary', 'theme_tertiary']) {
    try { _db.exec(`ALTER TABLE church_settings ADD COLUMN ${col} TEXT`); } catch { /* already exists */ }
  }
  try { _db.exec(`ALTER TABLE members ADD COLUMN address_history TEXT`); } catch { /* already exists */ }
  // Private R2 receipt key. MUST be an explicit ALTER — the CREATE TABLE above is a
  // no-op on existing installs, so without this a pulled receipt_key is dropped by
  // the localColumns allowlist and any local write throws "no such column".
  try { _db.exec(`ALTER TABLE expenditures ADD COLUMN receipt_key TEXT`); } catch { /* already exists */ }
  return _db;
}

function getDb() {
  if (!_db) throw new Error('DB not initialized. Call initDb(userDataPath) first.');
  return _db;
}

function buildWhere(where) {
  if (!where || !Object.keys(where).length) return { clause: '', values: [] };
  const parts = [];
  const values = [];
  for (const [k, v] of Object.entries(where)) {
    if (v === undefined) continue;
    if (v === null) {
      parts.push(`"${k}" IS NULL`);
    } else if (typeof v === 'boolean') {
      parts.push(`"${k}" = ${v ? 1 : 0}`);
    } else if (typeof v === 'object') {
      // Operator object, e.g. { gte, lte, gt, lt, equals, startsWith, contains }.
      for (const [op, opv] of Object.entries(v)) {
        if (opv === undefined || opv === null) continue;
        switch (op) {
          case 'gte':        parts.push(`"${k}" >= ?`);   values.push(opv); break;
          case 'lte':        parts.push(`"${k}" <= ?`);   values.push(opv); break;
          case 'gt':         parts.push(`"${k}" > ?`);    values.push(opv); break;
          case 'lt':         parts.push(`"${k}" < ?`);    values.push(opv); break;
          case 'equals':     parts.push(`"${k}" = ?`);    values.push(opv); break;
          case 'startsWith': parts.push(`"${k}" LIKE ?`); values.push(`${opv}%`); break;
          case 'contains':   parts.push(`"${k}" LIKE ?`); values.push(`%${opv}%`); break;
          default: break;
        }
      }
    } else {
      parts.push(`"${k}" = ?`);
      values.push(v);
    }
  }
  return { clause: parts.length ? 'WHERE ' + parts.join(' AND ') : '', values };
}

function convertRow(tableName, row) {
  if (!row) return null;
  const r = { ...row };
  const bools = BOOL_FIELDS[tableName] || [];
  bools.forEach(f => { if (r[f] !== undefined && r[f] !== null) r[f] = r[f] === 1 || r[f] === true; });
  r.created_date = r.createdAt;
  r.updated_date = r.updatedAt;
  return r;
}

function prepareData(tableName, data) {
  const r = { ...data };
  const bools = BOOL_FIELDS[tableName] || [];
  bools.forEach(f => { if (r[f] !== undefined && r[f] !== null) r[f] = r[f] ? 1 : 0; });
  return r;
}

function makeModel(modelName) {
  const tableName = TABLE_MAP[modelName];
  if (!tableName) throw new Error(`Unknown model: ${modelName}`);

  return {
    findMany({ where, orderBy = { createdAt: 'desc' }, take = 500 } = {}) {
      const db = getDb();
      const { clause, values } = buildWhere(where);
      const [orderField, orderDir] = Object.entries(orderBy)[0];
      const sql = `SELECT * FROM "${tableName}" ${clause} ORDER BY "${orderField}" ${orderDir.toUpperCase()} LIMIT ?`;
      return db.prepare(sql).all(...values, take).map(r => convertRow(tableName, r));
    },

    findUnique({ where }) {
      const db = getDb();
      const { clause, values } = buildWhere(where);
      const row = db.prepare(`SELECT * FROM "${tableName}" ${clause} LIMIT 1`).get(...values);
      return convertRow(tableName, row);
    },

    create({ data }) {
      const db = getDb();
      const now = new Date().toISOString();
      const raw = prepareData(tableName, { ...data, id: data.id || randomUUID(), createdAt: now, updatedAt: now });
      // remove undefined
      Object.keys(raw).forEach(k => raw[k] === undefined && delete raw[k]);
      const cols = Object.keys(raw).map(k => `"${k}"`).join(', ');
      const placeholders = Object.keys(raw).map(() => '?').join(', ');
      db.prepare(`INSERT INTO "${tableName}" (${cols}) VALUES (${placeholders})`).run(...Object.values(raw));
      return this.findUnique({ where: { id: raw.id } });
    },

    update({ where, data }) {
      const db = getDb();
      const now = new Date().toISOString();
      const raw = prepareData(tableName, { ...data, updatedAt: now });
      delete raw.id; delete raw.createdAt; delete raw.created_date; delete raw.updated_date;
      Object.keys(raw).forEach(k => raw[k] === undefined && delete raw[k]);
      const sets = Object.keys(raw).map(k => `"${k}" = ?`).join(', ');
      const { clause, values: whereVals } = buildWhere(where);
      db.prepare(`UPDATE "${tableName}" SET ${sets} ${clause}`).run(...Object.values(raw), ...whereVals);
      return this.findUnique({ where });
    },

    delete({ where }) {
      const db = getDb();
      const { clause, values } = buildWhere(where);
      db.prepare(`DELETE FROM "${tableName}" ${clause}`).run(...values);
    },
  };
}

// Build a fake-Prisma client keyed by model name
function createPrismaClient() {
  const client = {};
  for (const modelName of Object.keys(TABLE_MAP)) {
    client[modelName] = makeModel(modelName);
  }
  return client;
}

// Local auth users (separate table)
const localUsers = {
  findByEmail(email) {
    return getDb().prepare('SELECT * FROM local_users WHERE email = ?').get(email);
  },
  create({ id, email, password_hash, full_name, role, department_id }) {
    const now = new Date().toISOString();
    getDb().prepare(
      'INSERT INTO local_users (id, email, password_hash, full_name, role, department_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id || randomUUID(), email, password_hash, full_name || '', role || 'super_admin', department_id || null, now);
    return this.findByEmail(email);
  },
  count() {
    return getDb().prepare('SELECT COUNT(*) as c FROM local_users').get().c;
  },
  findById(id) {
    return getDb().prepare('SELECT * FROM local_users WHERE id = ?').get(id);
  },
  first() {
    return getDb().prepare('SELECT * FROM local_users ORDER BY created_at ASC LIMIT 1').get();
  },
  updateDepartment(id, department_id) {
    getDb().prepare('UPDATE local_users SET department_id = ? WHERE id = ?').run(department_id, id);
  },
  list() {
    return getDb().prepare('SELECT id, email, full_name, role, department_id, created_at FROM local_users ORDER BY created_at ASC').all();
  },
  updateRole(id, role, department_id) {
    getDb().prepare('UPDATE local_users SET role = ?, department_id = ? WHERE id = ?').run(role, department_id ?? null, id);
    return this.findById(id);
  },
  countByRole(role) {
    return getDb().prepare('SELECT COUNT(*) as c FROM local_users WHERE role = ?').get(role).c;
  },
};

// ── Sync helpers ──────────────────────────────────────────────────────────────

function runInTransaction(fn) {
  return getDb().transaction(fn)();
}

const syncMeta = {
  get(key) {
    const r = getDb().prepare('SELECT value FROM sync_meta WHERE key = ?').get(key);
    return r ? r.value : null;
  },
  set(key, value) {
    getDb().prepare(
      'INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(key, value == null ? null : String(value));
  },
  getAll() {
    const rows = getDb().prepare('SELECT key, value FROM sync_meta').all();
    const out = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  },
};

// Dead-letter queue for rows the cloud rejected on push. A real table (not a
// capped JSON blob) so it never evicts a still-failing row — the retry set is
// the ONLY compensation once push_cursor advances past a row, so losing an entry
// would be silent, permanent divergence.
const deadLetter = {
  addMany(pairs) {
    if (!pairs || !pairs.length) return;
    const stmt = getDb().prepare('INSERT INTO sync_dead_letter (entity, id, failed_at) VALUES (?, ?, ?) ON CONFLICT(entity, id) DO NOTHING');
    const now = new Date().toISOString();
    for (const p of pairs) { if (p && p.entity && p.id != null) stmt.run(p.entity, String(p.id), now); }
  },
  removeMany(entity, ids) {
    if (!entity || !ids || !ids.length) return;
    const list = ids.map(String);
    const ph = list.map(() => '?').join(', ');
    getDb().prepare(`DELETE FROM sync_dead_letter WHERE entity = ? AND id IN (${ph})`).run(entity, ...list);
  },
  all() {
    return getDb().prepare('SELECT entity, id FROM sync_dead_letter').all();
  },
  count() {
    return getDb().prepare('SELECT COUNT(*) AS c FROM sync_dead_letter').get().c;
  },
};

const _colCache = new Map();
function localColumns(tableName) {
  if (_colCache.has(tableName)) return _colCache.get(tableName);
  const cols = getDb().prepare(`PRAGMA table_info("${tableName}")`).all().map((r) => r.name);
  _colCache.set(tableName, cols);
  return cols;
}

// Local rows changed since `sinceIso` (local clock), keyset-paginated by
// (updatedAt, id) ascending. Booleans are converted back to true/false via
// convertRow so they push cleanly to Postgres.
function selectChangedSince(modelName, sinceIso, { limit = 200, cursor = null } = {}) {
  const tableName = TABLE_MAP[modelName];
  if (!tableName) return [];
  const conds = [];
  const params = [];
  if (sinceIso) { conds.push('updatedAt > ?'); params.push(sinceIso); }
  if (cursor && cursor.updatedAt) {
    conds.push('(updatedAt > ? OR (updatedAt = ? AND id > ?))');
    params.push(cursor.updatedAt, cursor.updatedAt, cursor.id || '');
  }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const sql = `SELECT * FROM "${tableName}" ${where} ORDER BY updatedAt ASC, id ASC LIMIT ?`;
  params.push(limit);
  return getDb().prepare(sql).all(...params).map((r) => convertRow(tableName, r));
}

// Exact, anchored hostname allowlist for the media proxy + prefetch (shared by
// server.cjs and sync.cjs so they can't drift). Vercel Blob (logos/photos), R2
// public sermon hosts (both the r2.dev testing host and the intended custom
// domain — a switch must not orphan already-stored URLs), and NOTHING else. Never
// a substring match; never r2.cloudflarestorage.com (that is the PRIVATE S3
// endpoint that also fronts the receipts bucket).
const MEDIA_HOST_PATTERNS = [
  /(^|\.)blob\.vercel-storage\.com$/,
  /(^|\.)r2\.dev$/,
  /^media\.church\.frozenbit\.eu$/,
];
function isAllowedMediaHost(hostname) {
  return typeof hostname === 'string' && MEDIA_HOST_PATTERNS.some((re) => re.test(hostname));
}

// File-URL columns per model (used by file sync + the media-proxy rewrite).
// churchSettings.logo_url syncs cross-device via the singleton path. expenditure
// keeps receipt_url (the transient local staging URL) but NOT receipt_key — the
// bare private key must never be treated as a fetchable/portable file URL.
const FILE_FIELDS = {
  member: ['profile_photo_url'],
  sermon: ['file_url', 'thumbnail_url'],
  property: ['photo_url'],
  expenditure: ['receipt_url'],
  churchSettings: ['logo_url'],
};

// Rows whose file field(s) still point at a local (this-device) upload URL — the
// desktop→cloud file push finds these, uploads the bytes to Blob, and rewrites.
function rowsWithLocalFile(modelName, fields) {
  const tableName = TABLE_MAP[modelName];
  if (!tableName || !fields?.length) return [];
  const conds = fields.map((f) => `("${f}" LIKE 'http://localhost:%' OR "${f}" LIKE 'http://127.0.0.1:%')`).join(' OR ');
  return getDb().prepare(`SELECT * FROM "${tableName}" WHERE ${conds}`).all().map((r) => convertRow(tableName, r));
}

// Rewrite a single file field to the canonical Blob URL. Bumps updatedAt so the
// row re-pushes once carrying the portable URL (then it no longer matches
// rowsWithLocalFile, so it won't loop).
function rewriteFileField(modelName, id, field, url) {
  const tableName = TABLE_MAP[modelName];
  if (!tableName) return;
  getDb().prepare(`UPDATE "${tableName}" SET "${field}" = ?, updatedAt = ? WHERE id = ?`).run(url, new Date().toISOString(), id);
}

// After a receipt's bytes are uploaded to private R2, write the canonical key and
// clear the transient local staging URL atomically (so the localhost URL is never
// synced and getReceiptUrl falls through to the signed-read path). Bumps updatedAt
// so the row re-pushes carrying the key.
function setReceiptKey(id, key) {
  getDb().prepare(`UPDATE expenditures SET receipt_key = ?, receipt_url = NULL, updatedAt = ? WHERE id = ?`).run(key, new Date().toISOString(), id);
}

// Local rows by id (used to re-push rows the cloud previously rejected — the
// sync dead-letter/retry set). Booleans are converted back to true/false.
function selectByIds(modelName, ids) {
  const tableName = TABLE_MAP[modelName];
  if (!tableName || !Array.isArray(ids) || !ids.length) return [];
  const ph = ids.map(() => '?').join(', ');
  const sql = `SELECT * FROM "${tableName}" WHERE id IN (${ph})`;
  return getDb().prepare(sql).all(...ids).map((r) => convertRow(tableName, r));
}

// Apply a remote (cloud) row into local SQLite, PRESERVING its createdAt/updatedAt
// (so it isn't re-selected for push -> no ping-pong). Columns not present locally
// (e.g. church_id on most tables) are dropped. Last-write-wins: only overwrites an
// existing row when the incoming updatedAt is strictly newer; createdAt is kept on
// conflict. Returns true if a row was inserted/updated, false if skipped.
function upsertRemoteRow(modelName, remoteRow) {
  const tableName = TABLE_MAP[modelName];
  if (!tableName || !remoteRow || !remoteRow.id) return false;
  const allow = new Set(localColumns(tableName));
  const prepared = prepareData(tableName, remoteRow); // booleans -> 0/1
  const data = {};
  for (const [k, v] of Object.entries(prepared)) {
    if (allow.has(k)) data[k] = v === undefined ? null : v;
  }
  // Member↔login link is device-local (see api/sync.js) — never let a pulled row
  // set/overwrite it with the other backend's id namespace.
  if (modelName === 'member') delete data.user_id;
  if (!data.id) return false;
  const cols = Object.keys(data);
  const colList = cols.map((c) => `"${c}"`).join(', ');
  const placeholders = cols.map(() => '?').join(', ');
  const setCols = cols.filter((c) => c !== 'id' && c !== 'createdAt');
  // Don't let a pulled row (whose file URL the cloud NULLed) erase a local file field
  // that still holds a not-yet-uploaded localhost /uploads staging URL — that would
  // orphan the only pointer to a receipt/photo whose bytes haven't reached R2 yet.
  const fileFields = new Set(FILE_FIELDS[modelName] || []);
  const setClause = setCols.map((c) => fileFields.has(c)
    ? `"${c}" = CASE WHEN excluded."${c}" IS NULL AND "${tableName}"."${c}" LIKE 'http://localhost:%/uploads/%' THEN "${tableName}"."${c}" ELSE excluded."${c}" END`
    : `"${c}" = excluded."${c}"`).join(', ');
  const sql =
    `INSERT INTO "${tableName}" (${colList}) VALUES (${placeholders}) ` +
    `ON CONFLICT(id) DO UPDATE SET ${setClause} ` +
    `WHERE excluded."updatedAt" > "${tableName}"."updatedAt"`;
  const info = getDb().prepare(sql).run(...cols.map((c) => data[c]));
  return info.changes > 0;
}

// Apply a pulled row into a per-church SINGLETON table (church_settings): merge
// into the ONE existing local row (last-write-wins by updatedAt) instead of
// keying on id — the cloud and this device hold different ids for the same
// church, so an id-keyed upsert would create a duplicate. Cloud-only columns
// (church_id, serverUpdatedAt) are stripped via the local-columns allowlist.
function upsertSingleton(modelName, remoteRow) {
  const tableName = TABLE_MAP[modelName];
  if (!tableName || !remoteRow) return false;
  const allow = new Set(localColumns(tableName));
  const prepared = prepareData(tableName, remoteRow);
  const data = {};
  for (const [k, v] of Object.entries(prepared)) if (allow.has(k)) data[k] = v === undefined ? null : v;

  const existing = getDb().prepare(`SELECT * FROM "${tableName}" LIMIT 1`).get();
  if (existing) {
    // LWW: only apply a strictly-newer remote row (ISO strings compare chronologically).
    if (!(remoteRow.updatedAt && (!existing.updatedAt || remoteRow.updatedAt > existing.updatedAt))) return false;
    const setCols = Object.keys(data).filter((c) => c !== 'id' && c !== 'createdAt');
    if (!setCols.length) return false;
    const setClause = setCols.map((c) => `"${c}" = ?`).join(', ');
    getDb().prepare(`UPDATE "${tableName}" SET ${setClause} WHERE id = ?`).run(...setCols.map((c) => data[c]), existing.id);
    return true;
  }
  if (!data.id) data.id = randomUUID();
  const cols = Object.keys(data);
  getDb().prepare(`INSERT INTO "${tableName}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...cols.map((c) => data[c]));
  return true;
}

module.exports = { initDb, getDb, createPrismaClient, localUsers, runInTransaction, syncMeta, deadLetter, localColumns, selectChangedSince, selectByIds, upsertRemoteRow, upsertSingleton, FILE_FIELDS, isAllowedMediaHost, rowsWithLocalFile, rewriteFileField, setReceiptKey };
