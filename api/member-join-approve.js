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

  let callerClerkId;
  try {
    const authorizedParties = process.env.CLERK_AUTHORIZED_PARTIES
      ? process.env.CLERK_AUTHORIZED_PARTIES.split(',').map(s => s.trim())
      : ['https://church.frozenbit.eu', 'http://localhost:5173', 'http://localhost:3000'];
    const payload = await verifyToken(auth.split(' ')[1], {
      secretKey: process.env.CLERK_SECRET_KEY,
      authorizedParties,
    });
    callerClerkId = payload?.sub;
    if (!callerClerkId) throw new Error('No sub in token');
  } catch (err) {
    console.error('[member-join-approve] token verification failed:', err?.message);
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Verify caller is an admin for a church
  const callerProfile = await prisma.userProfile.findUnique({
    where: { clerkId: callerClerkId },
  });
  if (!callerProfile || !['super_admin', 'pastor_admin'].includes(callerProfile.role)) {
    return res.status(403).json({ error: 'Forbidden: admin access required' });
  }

  const { request_id, action } = req.body || {};
  if (!request_id) return res.status(400).json({ error: 'request_id is required' });
  if (!['approved', 'rejected'].includes(action)) {
    return res.status(400).json({ error: 'action must be "approved" or "rejected"' });
  }

  try {
    const request = await prisma.accessRequest.findUnique({ where: { id: request_id } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.church_id !== callerProfile.church_id) {
      return res.status(403).json({ error: 'Forbidden: request belongs to a different church' });
    }

    await prisma.accessRequest.update({
      where: { id: request_id },
      data: {
        status: action,
        reviewed_by: callerClerkId,
        reviewed_at: new Date().toISOString(),
      },
    });

    // If approving a member join request (has clerk_id), create their UserProfile
    if (action === 'approved' && request.clerk_id) {
      await prisma.userProfile.upsert({
        where: { clerkId: request.clerk_id },
        create: {
          clerkId: request.clerk_id,
          church_id: request.church_id,
          role: 'member',
        },
        update: {
          church_id: request.church_id,
          role: 'member',
        },
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[member-join-approve]', err);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
}
