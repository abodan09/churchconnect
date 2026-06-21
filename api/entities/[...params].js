import { createClerkClient } from '@clerk/backend';
import { PrismaClient } from '@prisma/client';

// Lazy singletons — initialized on first request, not at module load.
// This prevents cold-start crashes when env vars are missing.
let _prisma = null;
let _clerk = null;

function getPrisma() {
  if (!_prisma) _prisma = new PrismaClient();
  return _prisma;
}

function getClerk() {
  if (!_clerk) _clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  return _clerk;
}

const MODEL_MAP = {
  members: 'member',
  departments: 'department',
  events: 'event',
  givings: 'giving',
  expenditures: 'expenditure',
  attendances: 'attendance',
  sermons: 'sermon',
  properties: 'property',
  churchsettings: 'churchSettings',
  userprofiles: 'userProfile',
  accessrequests: 'accessRequest',
  smallgroups: 'smallGroup',
  smallgroupmembers: 'smallGroupMember',
  pastoralcares: 'pastoralCare',
  volunteers: 'volunteer',
  announcements: 'announcement',
};

async function getUser(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const token = auth.split(' ')[1];
    const payload = await getClerk().verifyToken(token);
    return payload;
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL is not set in Vercel environment variables.' });
  }

  const rawParams = req.query['...params'];
  const params = Array.isArray(rawParams) ? rawParams : rawParams ? rawParams.split('/') : [];
  const [resource, id] = params;
  const model = MODEL_MAP[resource?.toLowerCase()];
  if (!model) return res.status(404).json({ error: 'Unknown resource' });

  const prisma = getPrisma();
  const db = prisma[model];

  try {
    if (req.method === 'GET' && !id) {
      const { sort, limit, ...filter } = req.query;
      delete filter['...params']; // Vercel catch-all routing key — not a filter field
      // Coerce string booleans so Prisma receives the right types
      Object.keys(filter).forEach(k => {
        if (filter[k] === 'true') filter[k] = true;
        else if (filter[k] === 'false') filter[k] = false;
      });
      // Map legacy Base44 field names to Prisma column names
      const FIELD_MAP = { created_date: 'createdAt', updated_date: 'updatedAt' };
      const sortField = sort ? sort.replace(/^-/, '') : null;
      const prismaField = sortField ? (FIELD_MAP[sortField] || sortField) : null;
      const orderBy = prismaField ? { [prismaField]: sort.startsWith('-') ? 'desc' : 'asc' } : { createdAt: 'desc' };
      const take = limit ? parseInt(limit) : 500;
      const where = Object.keys(filter).length ? filter : undefined;
      const records = await db.findMany({ where, orderBy, take });
      const out = records.map(r => ({ ...r, created_date: r.createdAt, updated_date: r.updatedAt }));
      return res.status(200).json(out);
    }

    if (req.method === 'GET' && id) {
      const record = await db.findUnique({ where: { id } });
      if (!record) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json({ ...record, created_date: record.createdAt });
    }

    if (req.method === 'POST') {
      const user = await getUser(req);
      const data = { ...req.body };
      // Only add created_by_id for models that have that field
      const MODELS_WITH_CREATOR = ['member','department','event','giving','expenditure','attendance','sermon','property','userProfile','smallGroup','smallGroupMember','pastoralCare','volunteer','announcement'];
      if (user?.sub && MODELS_WITH_CREATOR.includes(model)) data.created_by_id = user.sub;
      Object.keys(data).forEach(k => (data[k] === undefined || data[k] === null) && delete data[k]);
      const record = await db.create({ data });
      return res.status(201).json({ ...record, created_date: record.createdAt });
    }

    if ((req.method === 'PUT' || req.method === 'PATCH') && id) {
      const data = { ...req.body };
      delete data.id; delete data.createdAt; delete data.updatedAt; delete data.created_date;
      Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
      const record = await db.update({ where: { id }, data });
      return res.status(200).json({ ...record, created_date: record.createdAt });
    }

    if (req.method === 'DELETE' && id) {
      await db.delete({ where: { id } });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(`[entities/${resource}]`, err);
    const message = err?.message || String(err) || 'Unknown server error';
    return res.status(500).json({ error: message });
  }
}
