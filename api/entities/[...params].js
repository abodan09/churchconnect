import { createClerkClient } from '@clerk/backend';
import { PrismaClient } from '@prisma/client';

let _prisma = null;
let _clerk  = null;

function getPrisma() {
  if (!_prisma) _prisma = new PrismaClient();
  return _prisma;
}

function getClerk() {
  if (!_clerk) _clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  return _clerk;
}

const MODEL_MAP = {
  members:          'member',
  departments:      'department',
  events:           'event',
  givings:          'giving',
  expenditures:     'expenditure',
  attendances:      'attendance',
  sermons:          'sermon',
  properties:       'property',
  churchsettings:   'churchSettings',
  userprofiles:     'userProfile',
  accessrequests:   'accessRequest',
  smallgroups:      'smallGroup',
  smallgroupmembers:'smallGroupMember',
  pastoralcares:    'pastoralCare',
  volunteers:       'volunteer',
  announcements:    'announcement',
};

// These models carry church_id and must always be scoped.
const CHURCH_SCOPED = new Set([
  'member','department','event','giving','expenditure','attendance',
  'sermon','property','churchSettings','accessRequest','smallGroup',
  'smallGroupMember','pastoralCare','volunteer','announcement',
]);

// Models that can be written to and should carry church_id on creation.
const MODELS_WITH_CREATOR = new Set([
  'member','department','event','giving','expenditure','attendance',
  'sermon','property','smallGroup','smallGroupMember','pastoralCare',
  'volunteer','announcement',
]);

/**
 * Verify the Clerk JWT and return { clerkId, churchId }.
 * churchId is resolved from UserProfile — null for brand-new users with no profile yet.
 */
async function resolveIdentity(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return { clerkId: null, churchId: null };
  try {
    const token   = auth.split(' ')[1];
    const payload = await getClerk().verifyToken(token);
    const clerkId = payload?.sub;
    if (!clerkId) return { clerkId: null, churchId: null };

    // One DB lookup per request — acceptable for church-scale traffic.
    const profile = await getPrisma().userProfile.findUnique({
      where:  { clerkId },
      select: { church_id: true },
    });
    return { clerkId, churchId: profile?.church_id ?? null };
  } catch {
    return { clerkId: null, churchId: null };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL is not set.' });
  }

  const rawParams = req.query['...params'];
  const params    = Array.isArray(rawParams) ? rawParams : rawParams ? rawParams.split('/') : [];
  const [resource, id] = params;
  const model = MODEL_MAP[resource?.toLowerCase()];
  if (!model) return res.status(404).json({ error: 'Unknown resource' });

  const prisma = getPrisma();
  const db     = prisma[model];
  const FIELD_MAP = { created_date: 'createdAt', updated_date: 'updatedAt' };

  // Resolve caller identity (clerkId + churchId from UserProfile).
  const { clerkId, churchId } = await resolveIdentity(req);

  // UserProfile is special: it's the lookup source for churchId itself.
  // We allow reading by clerkId without a church gate (needed during onboarding).
  // All other scoped resources require a resolved churchId.
  const isUserProfileResource = model === 'userProfile';

  if (CHURCH_SCOPED.has(model) && !churchId) {
    return res.status(403).json({ error: 'No church associated with this account. Complete onboarding first.' });
  }

  try {
    // ── GET list ────────────────────────────────────────────────────────────
    if (req.method === 'GET' && !id) {
      const { sort, limit, ...filter } = req.query;
      delete filter['...params'];
      Object.keys(filter).forEach(k => {
        if (filter[k] === 'true')  filter[k] = true;
        else if (filter[k] === 'false') filter[k] = false;
      });
      const sortField   = sort ? sort.replace(/^-/, '') : null;
      const prismaField = sortField ? (FIELD_MAP[sortField] || sortField) : null;
      const orderBy     = prismaField ? { [prismaField]: sort.startsWith('-') ? 'desc' : 'asc' } : { createdAt: 'desc' };
      const take        = limit ? parseInt(limit) : 500;

      // Inject church scope (UserProfile: skip gate for clerkId-only queries)
      const where = { ...filter };
      if (CHURCH_SCOPED.has(model)) {
        where.church_id = churchId;
      } else if (isUserProfileResource && !filter.clerkId) {
        where.church_id = churchId;
      }

      const records = await db.findMany({ where, orderBy, take });
      return res.status(200).json(records.map(r => ({ ...r, created_date: r.createdAt, updated_date: r.updatedAt })));
    }

    // ── GET single ──────────────────────────────────────────────────────────
    if (req.method === 'GET' && id) {
      const record = await db.findUnique({ where: { id } });
      if (!record) return res.status(404).json({ error: 'Not found' });
      // Enforce church boundary — reject cross-church reads.
      if (CHURCH_SCOPED.has(model) && record.church_id && record.church_id !== churchId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      return res.status(200).json({ ...record, created_date: record.createdAt, updated_date: record.updatedAt });
    }

    // ── POST (create) ───────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const data = { ...req.body };
      // Always inject church_id from the server — clients never set it.
      if (CHURCH_SCOPED.has(model))  data.church_id     = churchId;
      if (isUserProfileResource)     data.church_id     = churchId ?? data.church_id;
      if (clerkId && MODELS_WITH_CREATOR.has(model)) data.created_by_id = clerkId;
      // Strip undefined/null loose values
      Object.keys(data).forEach(k => (data[k] === undefined || data[k] === null) && delete data[k]);
      const record = await db.create({ data });
      return res.status(201).json({ ...record, created_date: record.createdAt, updated_date: record.updatedAt });
    }

    // ── PUT / PATCH (update) ─────────────────────────────────────────────────
    if ((req.method === 'PUT' || req.method === 'PATCH') && id) {
      // Verify the record belongs to this church before updating.
      if (CHURCH_SCOPED.has(model)) {
        const existing = await db.findUnique({ where: { id }, select: { church_id: true } });
        if (!existing) return res.status(404).json({ error: 'Not found' });
        if (existing.church_id !== churchId) return res.status(403).json({ error: 'Access denied' });
      }
      const data = { ...req.body };
      // Never let a client change church_id, id, or timestamps.
      delete data.id; delete data.church_id; delete data.createdAt;
      delete data.updatedAt; delete data.created_date; delete data.updated_date;
      Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
      const record = await db.update({ where: { id }, data });
      return res.status(200).json({ ...record, created_date: record.createdAt, updated_date: record.updatedAt });
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    if (req.method === 'DELETE' && id) {
      if (CHURCH_SCOPED.has(model)) {
        const existing = await db.findUnique({ where: { id }, select: { church_id: true } });
        if (!existing) return res.status(404).json({ error: 'Not found' });
        if (existing.church_id !== churchId) return res.status(403).json({ error: 'Access denied' });
      }
      await db.delete({ where: { id } });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(`[entities/${resource}]`, err);
    return res.status(500).json({ error: err?.message || 'Unknown server error' });
  }
}
