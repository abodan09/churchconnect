/**
 * POST /api/churches/register
 * Creates a new Church and makes the caller its super_admin.
 * Called once per church during onboarding — subsequent sign-ins just load
 * the church via UserProfile.church_id.
 */
import { verifyToken, createClerkClient } from '@clerk/backend';
import { PrismaClient } from '@prisma/client';

let _clerk = null;
function getClerk() {
  if (!_clerk) _clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  return _clerk;
}

let _prisma = null;
function getPrisma() { if (!_prisma) _prisma = new PrismaClient(); return _prisma; }

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'my-church';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // GET /api/churches/register?slug=X — public slug lookup
  if (req.method === 'GET') {
    const { slug } = req.query;
    if (!slug?.trim()) return res.status(400).json({ error: 'slug is required' });
    try {
      const prisma = getPrisma();
      const church = await prisma.church.findUnique({
        where: { slug: slug.trim().toLowerCase() },
        select: { id: true, name: true, slug: true, is_active: true },
      });
      if (!church || !church.is_active) {
        return res.status(404).json({ error: 'Church not found. Please check the slug and try again.' });
      }
      return res.status(200).json({ id: church.id, name: church.name, slug: church.slug });
    } catch (err) {
      console.error('[churches/register GET]', err);
      return res.status(500).json({ error: 'An unexpected error occurred.' });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verify caller
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
    if (!clerkId) throw new Error('No sub in token');
  } catch (err) {
    console.error('[churches/register] token verification failed:', err?.message);
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { church_name } = req.body || {};
  if (!church_name?.trim()) return res.status(400).json({ error: 'church_name is required' });

  const prisma = getPrisma();

  // Prevent creating a second church for the same user
  const existing = await prisma.userProfile.findUnique({ where: { clerkId } });
  if (existing?.church_id) {
    return res.status(409).json({ error: 'This account already belongs to a church.' });
  }

  // Generate a unique slug
  let slug = slugify(church_name.trim());
  const taken = await prisma.church.findUnique({ where: { slug } });
  if (taken) slug = `${slug}-${Date.now().toString(36)}`;

  try {
    const church = await prisma.church.create({
      data: { name: church_name.trim(), slug, plan: 'trial', is_active: true },
    });

    // Create (or update) the UserProfile, linking this user to their church as super_admin
    await prisma.userProfile.upsert({
      where:  { clerkId },
      create: { clerkId, church_id: church.id, role: 'super_admin' },
      update: { church_id: church.id, role: 'super_admin' },
    });

    // Bootstrap ChurchSettings for the new church
    await prisma.churchSettings.create({
      data: { church_id: church.id, church_name: church_name.trim() },
    });

    // Create a Clerk Organization for this church (needed for B2B billing).
    // Non-fatal: silently skipped if Clerk Orgs aren't yet enabled in the dashboard.
    try {
      const org = await getClerk().organizations.createOrganization({
        name: church_name.trim(),
        createdBy: clerkId,
      });
      await prisma.church.update({ where: { id: church.id }, data: { clerkOrgId: org.id } });
    } catch (orgErr) {
      console.warn('[churches/register] Clerk Org creation skipped:', orgErr?.message);
    }

    return res.status(201).json({ church });
  } catch (err) {
    console.error('[churches/register]', err);
    return res.status(500).json({ error: err?.message || 'Failed to create church' });
  }
}
