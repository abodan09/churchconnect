// Cloudflare R2 (S3-compatible) client + presign helpers — the ONLY place R2
// credentials are used. Backs api/r2-presign.js (uploads) and api/media/sign.js
// (private receipt reads).
//
// SIZE is enforced at the signature layer: presignPut signs Bucket + Key +
// ContentLength, so R2 rejects any PUT whose body length doesn't match what the
// server authorised (verified against live R2: a mismatched Content-Length -> 403).
// R2 does NOT support presigned POST (returns 501), which is why we pin a fixed
// ContentLength on a PUT rather than a POST content-length-range policy.
//
// CONTENT-TYPE is NOT a security control here: R2 ignores a signed Content-Type
// (verified: a PUT with a different Content-Type than signed is still accepted and
// stored with the client's value). The presign allowlist gates the DECLARED type
// (stops honest mistakes / casual abuse) and the client sends the type so R2 stores
// it for correct playback, but a determined authenticated caller can store any
// content-type. The private receipts bucket is unaffected (never served publicly).
// For the PUBLIC bucket this is an isolated origin on pub-*.r2.dev; when moving to a
// frozenbit.eu custom domain, add a Cloudflare Transform Rule forcing
// Content-Disposition: attachment so stored HTML/SVG can't execute on the subdomain.
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const MEDIA_BUCKET = process.env.R2_MEDIA_BUCKET;       // public — sermons
export const RECEIPTS_BUCKET = process.env.R2_RECEIPTS_BUCKET; // private — receipts
export const PUBLIC_BASE = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, '');

let _client = null;
function client() {
  if (_client) return _client;
  const accountId = process.env.R2_ACCOUNT_ID;
  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  return _client;
}

export function isConfigured() {
  return !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);
}

// Presigned PUT with the object's SIZE pinned into the signature (R2 enforces it).
// Content-type is intentionally NOT signed (R2 ignores it); the client sends it as
// a plain header so the stored object carries a type for playback.
export async function presignPut({ bucket, key, contentLength, expiresIn = 300 }) {
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentLength: contentLength });
  return getSignedUrl(client(), cmd, { expiresIn });
}

// Short-lived presigned GET for a private object (receipt reads).
export async function presignGet({ bucket, key, expiresIn = 90 }) {
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
}

export function publicUrl(key) {
  return `${PUBLIC_BASE}/${key}`;
}
