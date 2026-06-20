import prisma from '../../src/lib/prisma.js';
import { createClerkClient } from '@clerk/backend';

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

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
};

async function getUser(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const token = auth.split(' ')[1];
    const payload = await clerk.verifyToken(token);
    return payload;
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const params = req.query.params || [];
  const [resource, id] = params;
  const model = MODEL_MAP[resource?.toLowerCase()];
  if (!model) return res.status(404).json({ error: 'Unknown resource' });

  const db = prisma[model];

  try {
    if (req.method === 'GET' && !id) {
      const { sort, limit, ...filter } = req.query;
      // Remove params[] from filter
      delete filter.params;
      const orderBy = sort ? { [sort.replace(/^-/, '')]: sort.startsWith('-') ? 'desc' : 'asc' } : { createdAt: 'desc' };
      const take = limit ? parseInt(limit) : 500;
      const where = Object.keys(filter).length ? filter : undefined;
      const records = await db.findMany({ where, orderBy, take });
      // Normalize: add id-based fields, map createdAt → created_date
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
      if (user?.sub) data.created_by_id = user.sub;
      // Remove any undefined/null fields to avoid Prisma errors
      Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
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
    return res.status(500).json({ error: err.message });
  }
}
