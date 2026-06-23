import { verifyToken } from '@clerk/backend';
import prisma from '../src/lib/prisma.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
    console.error('[member-join] token verification failed:', err?.message);
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { church_slug, name, email, message } = req.body || {};
  if (!church_slug?.trim()) return res.status(400).json({ error: 'church_slug is required' });

  try {
    const church = await prisma.church.findUnique({
      where: { slug: church_slug.trim().toLowerCase() },
    });
    if (!church || !church.is_active) {
      return res.status(404).json({ error: 'Church not found. Please check the slug and try again.' });
    }

    // Prevent duplicate requests
    const existing = await prisma.accessRequest.findFirst({
      where: {
        church_id: church.id,
        clerk_id: clerkId,
        status: { in: ['pending', 'approved'] },
      },
    });
    if (existing) {
      return res.status(409).json({
        error: existing.status === 'approved'
          ? 'You are already a member of this church.'
          : 'You already have a pending request to join this church.',
      });
    }

    await prisma.accessRequest.create({
      data: {
        church_id: church.id,
        clerk_id: clerkId,
        name: (name || '').trim().slice(0, 200),
        email: (email || '').trim().toLowerCase().slice(0, 200),
        social_platform: 'other',
        message: (message || '').trim().slice(0, 1000) || null,
        status: 'pending',
        requested_at: new Date().toISOString(),
      },
    });

    return res.status(200).json({ success: true, church_name: church.name });
  } catch (err) {
    console.error('[member-join]', err);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
}
