import { createClerkClient } from '@clerk/backend';

// Verifies a ChurchConnect cloud account's email + password so the standalone
// (offline) desktop app can be activated with the same credentials. Called
// server-to-server by the desktop's embedded server on FIRST launch only; after
// that the desktop stores the session locally and never contacts the cloud again.

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// Best-effort in-memory throttle (per warm serverless instance). For stronger
// protection also enable Clerk's attack-protection / account-lockout and/or a
// durable limiter (e.g. Upstash).
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_EMAIL = 8;         // per (ip, email)
const MAX_PER_IP = 40;           // aggregate per ip across ALL emails (blocks sweeps)
const RESPONSE_FLOOR_MS = 700;   // masks the getUserList-only vs +verifyPassword timing delta
const buckets = new Map();       // key -> { count, first }

function bump(key, max) {
  const now = Date.now();
  if (buckets.size > 5000) { // opportunistic eviction of expired buckets
    for (const [k, v] of buckets) if (now - v.first > WINDOW_MS) buckets.delete(k);
  }
  const rec = buckets.get(key);
  if (!rec || now - rec.first > WINDOW_MS) { buckets.set(key, { count: 1, first: now }); return false; }
  rec.count += 1;
  return rec.count > max;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  // No CORS headers on purpose: this endpoint is called server-to-server by the
  // desktop's embedded server, never from a browser. Omitting
  // Access-Control-Allow-Origin stops third-party web pages from using it as a
  // credential-check oracle.
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!process.env.CLERK_SECRET_KEY) return res.status(500).json({ ok: false, error: 'Server not configured' });

  const start = Date.now();
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ ok: false, error: 'Email and password are required' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const emailKey = String(email).toLowerCase();
  const limited = bump(`e:${ip}:${emailKey}`, MAX_PER_EMAIL) || bump(`i:${ip}`, MAX_PER_IP);
  if (limited) return res.status(429).json({ ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' });

  // Constant-ish response time for auth failures so an attacker cannot tell a
  // non-existent account (returns early) from a wrong password (extra round-trip).
  async function authFail() {
    const elapsed = Date.now() - start;
    if (elapsed < RESPONSE_FLOOR_MS) await sleep(RESPONSE_FLOOR_MS - elapsed);
    return res.status(401).json({ ok: false, error: 'Invalid email or password' });
  }

  try {
    const list = await clerk.users.getUserList({ emailAddress: [String(email)], limit: 1 });
    const user = list?.data?.[0];
    if (!user) return authFail();
    try {
      await clerk.users.verifyPassword({ userId: user.id, password: String(password) });
    } catch (e) {
      const status = e?.status || e?.statusCode;
      // A 4xx (other than rate-limit) means wrong password or no password
      // credential -> treat as invalid credentials (generic, timing-masked).
      if (status && status >= 400 && status < 500 && status !== 429) return authFail();
      // Transient (429 / 5xx / network): surface as retryable + log for diagnosis.
      console.error('[desktop/verify] verifyPassword error:', status, e?.message);
      return res.status(status === 429 ? 429 : 502).json({ ok: false, error: 'Could not verify your account right now. Please try again.' });
    }
    return res.status(200).json({
      ok: true,
      user: {
        clerk_id: user.id,
        email: String(email),
        first_name: user.firstName || '',
        last_name: user.lastName || '',
      },
    });
  } catch (e) {
    console.error('[desktop/verify]', e?.message);
    return res.status(502).json({ ok: false, error: 'Could not verify your account right now. Please try again.' });
  }
}
