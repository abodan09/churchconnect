// Resolve a stored private receipt KEY to a short-lived (90s) presigned GET.
// The key is never public; this is the only way to read a receipt object.
//
// Controls (design review): tenant isolation via the churches/<churchId>/receipts/
// prefix + no '..'; the key must belong to a real Expenditure in the caller's
// church (a finance user can't sign an arbitrary key); finance-role required on
// the Clerk path. The device path is church-scoped — the desktop enforces the
// acting local user's finance role before it calls here (the sync token already
// grants full church data, so this is not a new exposure class). The signed URL
// is never logged or persisted.
import { authChurch, FINANCE_ROLES } from '../_lib/authChurch.js';
import { presignGet, RECEIPTS_BUCKET, isConfigured } from '../_lib/r2.js';
import prisma from '../../src/lib/prisma.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isConfigured() || !RECEIPTS_BUCKET) return res.status(500).json({ error: 'R2 not configured' });

  const auth = await authChurch(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const key = String(req.body?.key || '');
  if (!key || key.includes('..') || !key.startsWith(`churches/${auth.churchId}/receipts/`)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // Finance-only on the browser path.
  if (auth.source === 'clerk' && !FINANCE_ROLES.includes(auth.role)) {
    return res.status(403).json({ error: 'Finance role required' });
  }
  // Bind the key to a real receipt in this church (can't sign arbitrary keys).
  const row = await prisma.expenditure.findFirst({
    where: { receipt_key: key, church_id: auth.churchId },
    select: { id: true },
  });
  if (!row) return res.status(404).json({ error: 'Receipt not found' });

  const url = await presignGet({ bucket: RECEIPTS_BUCKET, key, expiresIn: 90 });
  return res.status(200).json({ url, expiresIn: 90 });
}
