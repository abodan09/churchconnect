import { verifyToken } from '@clerk/backend';
import { PrismaClient } from '@prisma/client';

let _prisma = null;
export function getPrisma() {
  if (!_prisma) _prisma = new PrismaClient();
  return _prisma;
}

const AUTHORIZED_PARTIES = process.env.CLERK_AUTHORIZED_PARTIES
  ? process.env.CLERK_AUTHORIZED_PARTIES.split(',').map(s => s.trim())
  : ['https://churchadmin2connect.frozenbit.eu', 'http://localhost:5174'];

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

export async function requireAdmin(req, res) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  try {
    const payload = await verifyToken(auth.split(' ')[1], {
      secretKey: process.env.CLERK_SECRET_KEY,
      authorizedParties: AUTHORIZED_PARTIES,
    });
    const clerkId = payload?.sub;
    if (!clerkId) throw new Error('No sub');
    const adminIds = (process.env.PLATFORM_ADMIN_CLERK_IDS || '')
      .split(',').map(s => s.trim()).filter(Boolean);
    if (!adminIds.includes(clerkId)) {
      res.status(403).json({ error: 'Not a platform admin' });
      return null;
    }
    return clerkId;
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return null;
  }
}
