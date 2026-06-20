import prisma from '../src/lib/prisma.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, social_platform, social_handle, message } = req.body || {};

  if (!name?.trim()) return res.status(400).json({ error: 'Full name is required.' });
  if (!email?.trim() || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }

  try {
    await prisma.accessRequest.create({
      data: {
        name: name.trim().slice(0, 200),
        email: email.trim().toLowerCase().slice(0, 200),
        social_platform: (social_platform || 'other').slice(0, 50),
        social_handle: (social_handle || '').trim().slice(0, 200) || null,
        message: (message || '').trim().slice(0, 1000) || null,
        status: 'pending',
        requested_at: new Date().toISOString(),
      },
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('request-access error:', err);
    return res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
  }
}
