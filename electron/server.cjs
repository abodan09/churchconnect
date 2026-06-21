'use strict';
const express = require('express');
const path = require('path');
const fs = require('fs');
const { createPrismaClient, localUsers } = require('./db.cjs');
const { hashPassword, verifyPassword, signToken, authMiddleware } = require('./auth.cjs');

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

const MODELS_WITH_CREATOR = ['member','department','event','giving','expenditure','attendance','sermon','property','userProfile','smallGroup','smallGroupMember','pastoralCare','volunteer','announcement'];
const FIELD_MAP = { created_date: 'createdAt', updated_date: 'updatedAt' };

let _prisma = null;
let uploadsDir = null;

function createServer(userDataPath) {
  uploadsDir = path.join(userDataPath, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  _prisma = createPrismaClient();
  const app = express();

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Filename');
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });

  app.use(express.json({ limit: '50mb' }));

  // Serve the built React app
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));

  // Serve uploaded files
  app.use('/uploads', express.static(uploadsDir));

  // ── Auth routes ──────────────────────────────────────────────────────────────

  app.get('/api/auth/status', (req, res) => {
    res.json({ hasUsers: localUsers.count() > 0 });
  });

  app.post('/api/auth/setup', async (req, res) => {
    try {
      if (localUsers.count() > 0) return res.status(409).json({ error: 'Already set up' });
      const { email, password, full_name } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
      const password_hash = await hashPassword(password);
      const user = localUsers.create({ email, password_hash, full_name, role: 'super_admin' });
      const token = signToken({ sub: user.id, email: user.email, role: user.role, full_name: user.full_name });
      res.json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = localUsers.findByEmail(email);
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      const ok = await verifyPassword(password, user.password_hash);
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
      const token = signToken({ sub: user.id, email: user.email, role: user.role, full_name: user.full_name, department_id: user.department_id });
      res.json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, department_id: user.department_id } });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/auth/me', authMiddleware, (req, res) => {
    const user = localUsers.findById(req.localUser.sub);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, email: user.email, full_name: user.full_name, role: user.role, department_id: user.department_id });
  });

  // ── File upload ──────────────────────────────────────────────────────────────

  app.post('/api/upload', authMiddleware, (req, res) => {
    try {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const filename = req.headers['x-filename'] || `upload-${Date.now()}`;
        const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const unique = `${Date.now()}-${safe}`;
        fs.writeFileSync(path.join(uploadsDir, unique), buffer);
        const port = req.socket.localPort;
        res.json({ file_url: `http://localhost:${port}/uploads/${unique}` });
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Entities CRUD ─────────────────────────────────────────────────────────────

  // Soft auth: populate req.localUser if a valid token is present (not required)
  const { verifyToken } = require('./auth.cjs');
  app.use('/api/entities', (req, res, next) => {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      const payload = verifyToken(auth.slice(7));
      if (payload) req.localUser = payload;
    }
    next();
  });

  async function entitiesHandler(req, res) {
    const { resource, id } = req.params;
    const model = MODEL_MAP[resource?.toLowerCase()];
    if (!model) return res.status(404).json({ error: 'Unknown resource' });

    const db = _prisma[model];

    try {
      if (req.method === 'GET' && !id) {
        const { sort, limit, ...filter } = req.query;
        Object.keys(filter).forEach(k => {
          if (filter[k] === 'true') filter[k] = true;
          else if (filter[k] === 'false') filter[k] = false;
        });
        const sortField = sort ? sort.replace(/^-/, '') : null;
        const prismaField = sortField ? (FIELD_MAP[sortField] || sortField) : null;
        const orderBy = prismaField ? { [prismaField]: sort.startsWith('-') ? 'desc' : 'asc' } : { createdAt: 'desc' };
        const take = limit ? parseInt(limit) : 500;
        const where = Object.keys(filter).length ? filter : undefined;
        const records = db.findMany({ where, orderBy, take });
        return res.json(records);
      }

      if (req.method === 'GET' && id) {
        const record = db.findUnique({ where: { id } });
        if (!record) return res.status(404).json({ error: 'Not found' });
        return res.json(record);
      }

      if (req.method === 'POST') {
        const data = { ...req.body };
        if (req.localUser?.sub && MODELS_WITH_CREATOR.includes(model)) data.created_by_id = req.localUser.sub;
        Object.keys(data).forEach(k => (data[k] === undefined || data[k] === null) && delete data[k]);
        const record = db.create({ data });
        return res.status(201).json(record);
      }

      if ((req.method === 'PUT' || req.method === 'PATCH') && id) {
        const data = { ...req.body };
        delete data.id; delete data.createdAt; delete data.updatedAt; delete data.created_date;
        const record = db.update({ where: { id }, data });
        return res.json(record);
      }

      if (req.method === 'DELETE' && id) {
        db.delete({ where: { id } });
        return res.json({ success: true });
      }

      return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
      console.error(`[entities/${resource}]`, err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  app.all('/api/entities/:resource', entitiesHandler);
  app.all('/api/entities/:resource/:id', entitiesHandler);

  // Fallback → React app (SPA routing)
  app.get('/{*path}', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return res.status(404).end();
    res.sendFile(path.join(distPath, 'index.html'));
  });

  return app;
}

module.exports = { createServer };
