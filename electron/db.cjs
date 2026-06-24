'use strict';
const Database = require('better-sqlite3');
const path = require('path');
const { randomUUID } = require('crypto');

let _db = null;

const TABLE_MAP = {
  member: 'members',
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
  updateDepartment(id, department_id) {
    getDb().prepare('UPDATE local_users SET department_id = ? WHERE id = ?').run(department_id, id);
  },
};

module.exports = { initDb, createPrismaClient, localUsers };
