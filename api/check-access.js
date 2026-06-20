import prisma from '../src/lib/prisma.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const email = (req.query.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  try {
    const requests = await prisma.accessRequest.findMany({
      where: { email },
      select: { status: true },
    });

    if (requests.length === 0) {
      // No requests yet — first setup, allow through
      return res.status(200).json({ approved: true, reason: 'first_user' });
    }

    const approved = requests.some(r => r.status === 'approved');
    const pending = !approved && requests.some(r => r.status === 'pending');

    return res.status(200).json({ approved, pending });
  } catch (err) {
    console.error('check-access error:', err);
    // Fail open so infra issues don't lock out users
    return res.status(200).json({ approved: true, reason: 'error' });
  }
}
