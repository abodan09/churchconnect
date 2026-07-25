// Shared caller-auth for the R2 endpoints (and any future ones): resolve the
// church from EITHER the device sync token OR a Clerk session. Extracted from the
// copy that lived in api/upload.js + api/blob-upload-token.js so every endpoint
// resolves churchId identically.
//
// Returns { churchId, source: 'device' | 'clerk', role } or null.
//  - device path: the sync JWT proves CHURCH membership, not a specific user, so
//    role is null (the desktop enforces per-user role locally before it calls us).
//  - clerk path: role is the caller's live UserProfile.role.
import { verifyToken } from '@clerk/backend';
import jwt from 'jsonwebtoken';
import prisma from '../../src/lib/prisma.js';

export const FINANCE_ROLES = ['finance_officer', 'pastor_admin', 'super_admin'];

export async function authChurch(req) {
  const raw = (req.headers.authorization || '').replace(/^Bearer /, '').trim();
  if (!raw) return null;

  // Device sync token first (cheap local verify, no network).
  try {
    const secret = (process.env.DEVICE_SYNC_JWT_SECRET || '').trim();
    if (secret) {
      const c = jwt.verify(raw, secret);
      if (c?.purpose === 'sync' && c?.church_id) {
        return { churchId: String(c.church_id), source: 'device', role: null };
      }
    }
  } catch { /* fall through to Clerk */ }

  // Clerk session.
  try {
    const authorizedParties = process.env.CLERK_AUTHORIZED_PARTIES
      ? process.env.CLERK_AUTHORIZED_PARTIES.split(',').map((s) => s.trim())
      : ['https://church.frozenbit.eu', 'http://localhost:5173', 'http://localhost:3000'];
    const p = await verifyToken(raw, { secretKey: process.env.CLERK_SECRET_KEY, authorizedParties });
    if (p?.sub) {
      const prof = await prisma.userProfile.findUnique({
        where: { clerkId: p.sub },
        select: { church_id: true, role: true },
      });
      if (prof?.church_id) return { churchId: prof.church_id, source: 'clerk', role: prof.role || null };
    }
  } catch { /* fall through */ }

  return null;
}
