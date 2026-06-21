/**
 * POST /api/churches/register
 * Creates a new Church and makes the caller its super_admin.
 * Called once per church during onboarding — subsequent sign-ins just load
 * the church via UserProfile.church_id.
 */
import { verifyToken } from '@clerk/backend';
import { PrismaClient } from '@prisma/client';

let _prisma = null;
function getPrisma() { if (!_prisma) _prisma = new PrismaClient(); return _prisma; }

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'my-church';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  // Verify caller
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  let clerkId;
  try {
    const payload = await verifyToken(auth.split(' ')[1], { secretKey: process.env.CLERK_SECRET_KEY });
    clerkId = payload?.sub;
    if (!clerkId) throw new Error('No sub in token');
  } catch {
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

    return res.status(201).json({ church });
  } catch (err) {
    console.error('[churches/register]', err);
    return res.status(500).json({ error: err?.message || 'Failed to create church' });
  }
}
