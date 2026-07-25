// Small-file upload (<= 4 MB). Buffered through the function to Vercel Blob.
// Authenticated by EITHER a Clerk session OR the device sync token; files are
// namespaced per church and content-addressed (sha256) so re-uploads dedup.
// Large files (> 4 MB) can't go through a serverless function (Vercel caps the
// request body at 4.5 MB) — those use the direct-to-blob client flow in
// api/blob-upload-token.js instead.
import { put } from '@vercel/blob';
import { verifyToken } from '@clerk/backend';
import jwt from 'jsonwebtoken';
import prisma from '../src/lib/prisma.js';

export const config = { api: { bodyParser: false } };

const MAX_BYTES = 4 * 1024 * 1024; // stay under Vercel's 4.5 MB function-body limit

// Resolve the caller's church from a Clerk session OR the device sync token.
async function authChurch(req) {
  const raw = (req.headers.authorization || '').replace(/^Bearer /, '').trim();
  if (!raw) return null;
  // Device sync token first (cheap local verify, no network).
  try {
    const secret = (process.env.DEVICE_SYNC_JWT_SECRET || '').trim();
    if (secret) {
      const c = jwt.verify(raw, secret);
      if (c?.purpose === 'sync' && c?.church_id) return String(c.church_id);
    }
  } catch { /* fall through to Clerk */ }
  // Clerk session.
  try {
    const authorizedParties = process.env.CLERK_AUTHORIZED_PARTIES
      ? process.env.CLERK_AUTHORIZED_PARTIES.split(',').map(s => s.trim())
      : ['https://church.frozenbit.eu', 'http://localhost:5173', 'http://localhost:3000'];
    const p = await verifyToken(raw, { secretKey: process.env.CLERK_SECRET_KEY, authorizedParties });
    if (p?.sub) {
      const prof = await prisma.userProfile.findUnique({ where: { clerkId: p.sub }, select: { church_id: true } });
      if (prof?.church_id) return prof.church_id;
    }
  } catch { /* fall through */ }
  return null;
}

function extOf(name) {
  const m = String(name || '').match(/\.[a-z0-9]{1,8}$/i);
  return m ? m[0].toLowerCase() : '';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Filename');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Authenticate BEFORE reading the body so an unauthorized caller never streams a file.
  const churchId = await authChurch(req);
  if (!churchId) return res.status(401).json({ error: 'Unauthorized' });

  // Restrict to media/pdf (matches the large-file token endpoint) so the store
  // can't be used to host arbitrary HTML/JS on a trusted *.blob URL.
  const contentType = req.headers['content-type'] || 'application/octet-stream';
  if (!/^(?:image\/|audio\/|video\/|application\/pdf)/i.test(contentType)) {
    return res.status(415).json({ error: 'Unsupported file type' });
  }

  try {
    const chunks = [];
    let total = 0;
    for await (const chunk of req) {
      total += chunk.length;
      if (total > MAX_BYTES) {
        return res.status(413).json({ error: 'File too large for this endpoint (max 4 MB). Use the large-file upload.' });
      }
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    if (!buffer.length) return res.status(400).json({ error: 'Empty file' });

    const base = String(req.headers['x-filename'] || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-64) || `file${extOf(req.headers['x-filename'])}`;
    // Unique blob per upload (addRandomSuffix).
    const blob = await put(`churches/${churchId}/${base}`, buffer, {
      access: 'public',
      contentType,
      addRandomSuffix: true,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return res.status(200).json({ file_url: blob.url });
  } catch (err) {
    console.error('[upload]', err?.message);
    return res.status(500).json({ error: 'Upload failed' });
  }
}
