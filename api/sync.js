import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

// Background sync endpoint for the offline desktop app. Authenticated by the
// long-lived DEVICE SYNC TOKEN minted in api/desktop/verify.js (NOT a Clerk
// session — the offline app has none). Everything is forced into the token's
// church_id; the token can only ever touch its own church's rows.
//
// Two ops:
//   push: upsert the client's changed rows into the cloud (last-write-wins by
//         updatedAt; NEVER deletes; timestamps preserved via raw SQL). Rows that
//         fail (e.g. a NOT-NULL violation) are reported back in `failed` so the
//         client can retry them instead of silently dropping the write.
//   pull: return cloud rows changed since a watermark, keyset-paginated by
//         serverUpdatedAt (a server-assigned arrival clock stamped by a DB
//         trigger — see prisma/sql/sync_server_stamp.sql) so a row carrying an
//         old business updatedAt is still delivered to other devices.
//
// No CORS headers on purpose: called server-to-server by the desktop's main
// process, never from a browser.

let _prisma = null;
function getPrisma() { if (!_prisma) _prisma = new PrismaClient(); return _prisma; }

const DATE_COLS = new Set(['createdAt', 'updatedAt']);

// Cloud columns that are NOT NULL with a default but are nullable locally. If the
// client pushes a NULL we substitute the schema default so the INSERT never
// violates the constraint (which would otherwise skip the row). Kept in sync with
// prisma/schema.prisma @default(...) values.
const NOT_NULL_DEFAULTS = {
  members: { membership_status: 'active' },
  departments: { media_upload_enabled: false, allowed_media_types: 'none', is_active: true },
  events: { event_type: 'service', is_public: true },
  givings: { type: 'tithe', payment_method: 'cash' },
  expenditures: { approval_status: 'pending' },
  attendances: { status: 'present' },
  smallgroups: { type: 'bible_study', meeting_frequency: 'weekly', is_active: true, is_open: true },
  smallgroupmembers: { role: 'member', is_active: true },
  pastoralcares: { type: 'prayer_request', status: 'open', priority: 'normal', is_private: false },
  volunteers: { status: 'pending', checked_in: false },
  announcements: { audience: 'all', is_pinned: false, priority: 'normal', is_active: true },
};

// Static per-entity column lists — NEVER derived from the request, so the raw
// SQL is injection- and drift-safe. Table = Postgres table name (Prisma model,
// PascalCase, no @@map). model = Prisma client accessor for the pull query.
// serverUpdatedAt is intentionally absent: it is owned by the DB trigger.
const SYNC_ENTITIES = {
  // NOTE: user_id (the Member↔login link) is intentionally NOT synced — it is
  // backend-specific (a Clerk id on the cloud, a local user id on the desktop), so
  // syncing it would make one backend show a login that doesn't exist on the other.
  members: { model: 'member', table: 'Member', cols: ['id', 'church_id', 'first_name', 'last_name', 'email', 'phone', 'address', 'address_history', 'department_id', 'department_name', 'join_date', 'membership_status', 'profile_photo_url', 'gender', 'date_of_birth', 'marital_status', 'occupation', 'emergency_contact_name', 'emergency_contact_phone', 'notes', 'baptism_date', 'membership_class_date', 'confirmation_date', 'volunteer_status', 'background_check_date', 'created_by_id', 'createdAt', 'updatedAt'] },
  memberrelationships: { model: 'memberRelationship', table: 'MemberRelationship', cols: ['id', 'church_id', 'member_id', 'relationship_type', 'related_member_id', 'related_name', 'related_phone', 'related_email', 'related_notes', 'created_by_id', 'createdAt', 'updatedAt'] },
  departments: { model: 'department', table: 'Department', cols: ['id', 'church_id', 'name', 'description', 'head_name', 'head_user_id', 'media_upload_enabled', 'allowed_media_types', 'is_active', 'color', 'allowed_features', 'created_by_id', 'createdAt', 'updatedAt'] },
  events: { model: 'event', table: 'Event', cols: ['id', 'church_id', 'title', 'description', 'department_id', 'department_name', 'start_datetime', 'end_datetime', 'location', 'event_type', 'is_public', 'created_by_name', 'created_by_id', 'createdAt', 'updatedAt'] },
  givings: { model: 'giving', table: 'Giving', cols: ['id', 'church_id', 'member_id', 'member_name', 'date', 'amount', 'type', 'payment_method', 'service_or_event', 'notes', 'recorded_by', 'created_by_id', 'createdAt', 'updatedAt'] },
  expenditures: { model: 'expenditure', table: 'Expenditure', cols: ['id', 'church_id', 'date', 'category', 'description', 'amount', 'department_id', 'department_name', 'approval_status', 'approved_by', 'approved_date', 'receipt_url', 'notes', 'created_by_id', 'createdAt', 'updatedAt'] },
  attendances: { model: 'attendance', table: 'Attendance', cols: ['id', 'church_id', 'event_id', 'event_name', 'event_date', 'member_id', 'member_name', 'department_id', 'department_name', 'check_in_time', 'status', 'checked_in_by', 'notes', 'created_by_id', 'createdAt', 'updatedAt'] },
  sermons: { model: 'sermon', table: 'Sermon', cols: ['id', 'church_id', 'title', 'description', 'preacher', 'date', 'department_id', 'department_name', 'media_type', 'file_url', 'thumbnail_url', 'duration_minutes', 'tags', 'created_by_id', 'createdAt', 'updatedAt'] },
  properties: { model: 'property', table: 'Property', cols: ['id', 'church_id', 'type', 'name', 'description', 'location_or_serial', 'purchase_date', 'purchase_value', 'current_condition', 'assigned_department_id', 'assigned_department_name', 'maintenance_notes', 'photo_url', 'created_by_id', 'createdAt', 'updatedAt'] },
  smallgroups: { model: 'smallGroup', table: 'SmallGroup', cols: ['id', 'church_id', 'name', 'type', 'description', 'leader_id', 'leader_name', 'co_leader_name', 'meeting_day', 'meeting_time', 'meeting_frequency', 'location', 'max_capacity', 'is_active', 'is_open', 'department_id', 'department_name', 'notes', 'created_by_id', 'createdAt', 'updatedAt'] },
  smallgroupmembers: { model: 'smallGroupMember', table: 'SmallGroupMember', cols: ['id', 'church_id', 'group_id', 'group_name', 'member_id', 'member_name', 'role', 'joined_date', 'is_active', 'notes', 'created_by_id', 'createdAt', 'updatedAt'] },
  pastoralcares: { model: 'pastoralCare', table: 'PastoralCare', cols: ['id', 'church_id', 'member_id', 'member_name', 'type', 'date', 'description', 'status', 'priority', 'assigned_to', 'assigned_name', 'resolved_date', 'resolution_notes', 'is_private', 'submitted_by', 'created_by_id', 'createdAt', 'updatedAt'] },
  volunteers: { model: 'volunteer', table: 'Volunteer', cols: ['id', 'church_id', 'member_id', 'member_name', 'event_id', 'event_name', 'event_date', 'department_id', 'department_name', 'role', 'status', 'notes', 'checked_in', 'created_by_id', 'createdAt', 'updatedAt'] },
  announcements: { model: 'announcement', table: 'Announcement', cols: ['id', 'church_id', 'title', 'content', 'audience', 'department_id', 'department_name', 'published_by', 'publish_date', 'expiry_date', 'is_pinned', 'priority', 'is_active', 'created_by_id', 'createdAt', 'updatedAt'] },
};

function buildUpsertSql(table, cols) {
  const colList = cols.map((c) => `"${c}"`).join(', ');
  const ph = cols.map((_, i) => `$${i + 1}`).join(', ');
  const setCols = cols.filter((c) => c !== 'id' && c !== 'church_id' && c !== 'createdAt');
  const setClause = setCols.map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ');
  const churchParam = `$${cols.length + 1}`;
  return (
    `INSERT INTO "${table}" (${colList}) VALUES (${ph}) ` +
    `ON CONFLICT ("id") DO UPDATE SET ${setClause} ` +
    `WHERE "${table}"."church_id" = ${churchParam} AND "${table}"."updatedAt" < EXCLUDED."updatedAt"`
  );
}

function rowValues(row, cols, churchId, defaults) {
  return cols.map((c) => {
    if (c === 'church_id') return churchId; // forced from token, never from client
    let v = row?.[c];
    if (v === undefined || v === null) {
      if (defaults && Object.prototype.hasOwnProperty.call(defaults, c)) return defaults[c];
      return null;
    }
    if (DATE_COLS.has(c)) { const d = new Date(v); return isNaN(d.getTime()) ? new Date() : d; }
    return v;
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const secret = (process.env.DEVICE_SYNC_JWT_SECRET || '').trim();
  if (!secret || !process.env.DATABASE_URL) return res.status(500).json({ ok: false, error: 'Sync not configured' });

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  let claims;
  try { claims = jwt.verify(auth.slice(7), secret); } catch { return res.status(401).json({ ok: false, error: 'Invalid or expired token' }); }
  if (claims?.purpose !== 'sync' || !claims?.church_id) return res.status(401).json({ ok: false, error: 'Invalid token' });
  const churchId = String(claims.church_id);

  const prisma = getPrisma();
  const body = req.body || {};

  try {
    if (body.op === 'push') {
      const changes = body.changes || {};
      const applied = {};
      const failed = {};
      for (const [resource, rows] of Object.entries(changes)) {
        const ent = SYNC_ENTITIES[resource];
        if (!ent || !Array.isArray(rows)) continue;
        const sql = buildUpsertSql(ent.table, ent.cols);
        const defaults = NOT_NULL_DEFAULTS[resource];
        let n = 0;
        const fails = [];
        for (const row of rows) {
          if (!row?.id) continue;
          try {
            const values = rowValues(row, ent.cols, churchId, defaults);
            values.push(churchId); // church guard param
            await prisma.$executeRawUnsafe(sql, ...values);
            n += 1;
          } catch (e) {
            console.error(`[sync push] ${resource} ${row.id}:`, e?.message);
            fails.push(String(row.id));
          }
        }
        applied[resource] = n;
        if (fails.length) failed[resource] = fails;
      }
      return res.status(200).json({ ok: true, serverTime: new Date().toISOString(), applied, failed });
    }

    if (body.op === 'pull') {
      const ent = SYNC_ENTITIES[body.entity];
      if (!ent) return res.status(400).json({ ok: false, error: 'Unknown entity' });
      const since = body.since ? new Date(body.since) : null;
      const cursor = body.cursor && body.cursor.serverUpdatedAt ? body.cursor : null;
      const limit = Math.min(Math.max(parseInt(body.limit, 10) || 300, 1), 500);

      // Watermark base = the DATABASE clock (same clock the trigger stamps
      // serverUpdatedAt with), so the client never mixes clocks.
      const nowRows = await prisma.$queryRawUnsafe('SELECT now() AS now');
      const serverTime = new Date(nowRows?.[0]?.now || Date.now()).toISOString();

      const and = [];
      if (since && !isNaN(since.getTime())) and.push({ serverUpdatedAt: { gt: since } });
      if (cursor) {
        const cu = new Date(cursor.serverUpdatedAt);
        and.push({ OR: [{ serverUpdatedAt: { gt: cu } }, { AND: [{ serverUpdatedAt: cu }, { id: { gt: String(cursor.id || '') } }] }] });
      }
      const where = { church_id: churchId, ...(and.length ? { AND: and } : {}) };
      const rows = await prisma[ent.model].findMany({ where, orderBy: [{ serverUpdatedAt: 'asc' }, { id: 'asc' }], take: limit + 1 });

      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const last = page[page.length - 1];
      const nextCursor = hasMore && last ? { serverUpdatedAt: last.serverUpdatedAt.toISOString(), id: last.id } : null;
      return res.status(200).json({ ok: true, serverTime, entity: body.entity, rows: page, hasMore, nextCursor });
    }

    return res.status(400).json({ ok: false, error: 'Unknown op' });
  } catch (e) {
    console.error('[sync]', e?.message);
    return res.status(500).json({ ok: false, error: 'Sync failed' });
  }
}
