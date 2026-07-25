// Mint a short-lived presigned upload for a SERMON (public R2 bucket) or a
// RECEIPT (private R2 bucket). Called directly by the browser and by the desktop
// sync push. Plain JSON function — the bytes never pass through here (client PUTs
// straight to R2), so Vercel's 4.5 MB body cap is irrelevant.
//
// Security (see the design review): the key is built SERVER-side from the
// authenticated churchId (never a client path), size + type are pinned into the
// signature (R2 rejects mismatches), svg/text are excluded from the public bucket
// (stored-XSS), and receipt uploads are finance-role gated on the Clerk path.
import { randomUUID } from 'crypto';
import { authChurch, FINANCE_ROLES } from './_lib/authChurch.js';
import { presignPut, publicUrl, MEDIA_BUCKET, RECEIPTS_BUCKET, isConfigured } from './_lib/r2.js';

const MEDIA_MAX = 500 * 1024 * 1024;   // sermons
const RECEIPT_MAX = 25 * 1024 * 1024;  // receipts (images / pdf)

// Enumerated allowlists — NO image/svg+xml and NO text/* on the public bucket.
const SERMON_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/x-m4a', 'audio/webm',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska',
]);
const RECEIPT_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
  'application/pdf',
]);

function normType(ct) {
  return String(ct || '').split(';')[0].trim().toLowerCase();
}
function extOf(name) {
  const m = String(name || '').match(/\.[a-z0-9]{1,8}$/i);
  return m ? m[0].toLowerCase() : '';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isConfigured() || !MEDIA_BUCKET || !RECEIPTS_BUCKET) return res.status(500).json({ error: 'R2 not configured' });

  const auth = await authChurch(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const { kind, filename, contentType, size } = req.body || {};
  const bytes = Number(size);
  if (!Number.isInteger(bytes) || bytes <= 0) return res.status(400).json({ error: 'Invalid size' });
  const ct = normType(contentType);
  const ext = extOf(filename);

  if (kind === 'sermon') {
    if (bytes > MEDIA_MAX) return res.status(413).json({ error: 'File too large (max 500 MB)' });
    if (!SERMON_TYPES.has(ct)) return res.status(415).json({ error: 'Unsupported media type' });
    const key = `churches/${auth.churchId}/sermons/${randomUUID()}${ext}`;
    const uploadUrl = await presignPut({ bucket: MEDIA_BUCKET, key, contentLength: bytes });
    return res.status(200).json({ uploadUrl, contentType: ct, fileUrl: publicUrl(key), key });
  }

  if (kind === 'receipt') {
    if (bytes > RECEIPT_MAX) return res.status(413).json({ error: 'File too large (max 25 MB)' });
    if (!RECEIPT_TYPES.has(ct)) return res.status(415).json({ error: 'Unsupported receipt type' });
    // Uploading a receipt is finance-only on the browser path. The device path is
    // church-scoped (the desktop enforces the acting user's role before calling).
    if (auth.source === 'clerk' && !FINANCE_ROLES.includes(auth.role)) {
      return res.status(403).json({ error: 'Finance role required' });
    }
    const key = `churches/${auth.churchId}/receipts/${randomUUID()}${ext}`;
    const uploadUrl = await presignPut({ bucket: RECEIPTS_BUCKET, key, contentLength: bytes });
    return res.status(200).json({ uploadUrl, contentType: ct, key }); // NO public url
  }

  return res.status(400).json({ error: 'Unknown kind' });
}
