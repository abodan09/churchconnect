import { verifyToken, createClerkClient } from '@clerk/backend';
import { PrismaClient } from '@prisma/client';

let _prisma = null;
function getPrisma() { if (!_prisma) _prisma = new PrismaClient(); return _prisma; }

let _clerk = null;
function getClerk() {
  if (!_clerk) _clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  return _clerk;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).end();

  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  let clerkId;
  try {
    const authorizedParties = process.env.CLERK_AUTHORIZED_PARTIES
      ? process.env.CLERK_AUTHORIZED_PARTIES.split(',').map(s => s.trim())
      : ['https://church.frozenbit.eu', 'http://localhost:5173', 'http://localhost:3000'];
    const payload = await verifyToken(auth.split(' ')[1], {
      secretKey: process.env.CLERK_SECRET_KEY,
      authorizedParties,
    });
    clerkId = payload?.sub;
    if (!clerkId) throw new Error('No sub');
  } catch (err) {
    console.error('[/api/me] token error:', err?.message);
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const prisma = getPrisma();
    const profile = await prisma.userProfile.findUnique({ where: { clerkId } });
    console.log('[/api/me] clerkId:', clerkId, '→ church_id:', profile?.church_id ?? 'NOT FOUND');

    if (!profile) return res.status(200).json(null);

    // Fetch the church so we can return clerkOrgId for billing
    const church = profile.church_id
      ? await prisma.church.findUnique({ where: { id: profile.church_id } })
      : null;

    let clerkOrgId = church?.clerkOrgId ?? null;

    // Lazy-create a Clerk Org for churches registered before billing was enabled
    if (church && !clerkOrgId) {
      try {
        const org = await getClerk().organizations.createOrganization({
          name: church.name,
          createdBy: clerkId,
        });
        clerkOrgId = org.id;
        await prisma.church.update({ where: { id: church.id }, data: { clerkOrgId } });
      } catch {
        // Org creation silently skipped if Clerk Orgs aren't enabled yet
      }
    }

    return res.status(200).json({ ...profile, clerkOrgId });
  } catch (err) {
    console.error('[/api/me] db error:', err?.message);
    return res.status(500).json({ error: 'DB error' });
  }
}
