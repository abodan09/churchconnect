// Direct-to-blob upload for LARGE files (sermon audio/video) — the client (browser
// or the desktop sync push) uploads bytes straight to Vercel Blob, bypassing the
// serverless 4.5 MB request-body limit. This route only mints a scoped, short-lived
// client token; the bytes never pass through it.
//
// Auth: the caller's token (Clerk session OR device sync JWT) is passed as
// `clientPayload`; we verify it and require the pathname to be under the caller's
// own church prefix (tenant isolation).
import { handleUpload } from '@vercel/blob/client';
import { verifyToken } from '@clerk/backend';
import jwt from 'jsonwebtoken';
import prisma from '../src/lib/prisma.js';

async function churchFromToken(raw) {
  if (!raw) return null;
  try {
    const secret = (process.env.DEVICE_SYNC_JWT_SECRET || '').trim();
    if (secret) { const c = jwt.verify(raw, secret); if (c?.purpose === 'sync' && c?.church_id) return String(c.church_id); }
  } catch { /* fall through */ }
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const jsonResponse = await handleUpload({
      request: req,
      body: req.body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const churchId = await churchFromToken((clientPayload || '').trim());
        if (!churchId) throw new Error('Unauthorized');
        if (pathname.includes('..') || !pathname.startsWith(`churches/${churchId}/`)) throw new Error('Invalid path for this church');
        return {
          addRandomSuffix: false,
          allowedContentTypes: ['image/*', 'audio/*', 'video/*', 'application/pdf'],
          maximumSizeInBytes: 500 * 1024 * 1024,
          cacheControlMaxAge: 60 * 60 * 24 * 365,
          tokenPayload: JSON.stringify({ churchId }),
        };
      },
      // Blob calls this (server-to-server) after the upload finishes. Blob is
      // already the source of truth, so nothing else to do.
      onUploadCompleted: async () => {},
    });
    return res.status(200).json(jsonResponse);
  } catch (err) {
    console.error('[blob-upload-token]', err?.message);
    return res.status(400).json({ error: err?.message || 'Upload token error' });
  }
}
