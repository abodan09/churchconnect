import { verifyToken } from '@clerk/backend';
import { PrismaClient } from '@prisma/client';

let _prisma = null;
function getPrisma() {
  if (!_prisma) _prisma = new PrismaClient();
  return _prisma;
}

const AUTHORIZED_PARTIES = process.env.CLERK_AUTHORIZED_PARTIES
  ? process.env.CLERK_AUTHORIZED_PARTIES.split(',').map(s => s.trim())
  : ['https://church.frozenbit.eu', 'http://localhost:5173', 'http://localhost:3000'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  let churchId;
  try {
    const payload = await verifyToken(auth.split(' ')[1], {
      secretKey: process.env.CLERK_SECRET_KEY,
      authorizedParties: AUTHORIZED_PARTIES,
    });
    const clerkId = payload?.sub;
    if (!clerkId) throw new Error('No sub');
    const profile = await getPrisma().userProfile.findUnique({
      where: { clerkId },
      select: { church_id: true },
    });
    churchId = profile?.church_id;
    if (!churchId) throw new Error('No church');
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { church_name, logo_url, language, currency_code, currency_symbol, theme_primary, theme_secondary, theme_tertiary } = req.body || {};
  if (!church_name?.trim()) return res.status(400).json({ error: 'church_name is required' });

  const data = {
    church_name: church_name.trim(),
    ...(logo_url !== undefined && { logo_url }),
    ...(language && { language }),
    ...(currency_code && { currency_code }),
    ...(currency_symbol && { currency_symbol }),
    ...(theme_primary !== undefined && { theme_primary: theme_primary || null }),
    ...(theme_secondary !== undefined && { theme_secondary: theme_secondary || null }),
    ...(theme_tertiary !== undefined && { theme_tertiary: theme_tertiary || null }),
  };

  const settings = await getPrisma().churchSettings.upsert({
    where: { church_id: churchId },
    update: data,
    create: { church_id: churchId, ...data },
  });

  return res.status(200).json({ ...settings, created_date: settings.createdAt, updated_date: settings.updatedAt });
}
