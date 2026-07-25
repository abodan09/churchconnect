'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_EXPIRY = '30d';

// Read lazily so main.cjs can inject a per-device random LOCAL_JWT_SECRET before
// the first token is signed. The hardcoded fallback is a last resort only (dev).
function getSecret() {
  return process.env.LOCAL_JWT_SECRET || 'churchconnect-local-secret-change-in-production';
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function signToken(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: JWT_EXPIRY });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, getSecret());
  } catch {
    return null;
  }
}

// Short-lived capability ticket for reading ONE private receipt through the
// unauthenticated /api/receipt route. Minted only after a finance-role check
// (see /api/receipt-grant), so a <img>/window.open navigation — which can't carry
// an Authorization header — still proves authorisation via the ?t= nonce.
function signReceiptTicket(key) {
  return jwt.sign({ purpose: 'receipt', key }, getSecret(), { expiresIn: '2m' });
}
function verifyReceiptTicket(token, key) {
  try {
    const p = jwt.verify(token, getSecret());
    return p?.purpose === 'receipt' && p?.key === key;
  } catch {
    return false;
  }
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = auth.slice(7);
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });
  req.localUser = payload;
  next();
}

// Layer after authMiddleware: only allow the given roles through. Resolves the
// LIVE role from local_users (not the 30-day JWT claim) so an admin's demotion
// takes effect immediately rather than lingering until the token expires.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.localUser) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const { localUsers } = require('./db.cjs');
      const fresh = localUsers.findById(req.localUser.sub);
      if (!fresh) return res.status(401).json({ error: 'Unknown user' });
      req.localUser.role = fresh.role;                 // overwrite stale token role with live DB role
      req.localUser.department_id = fresh.department_id;
    } catch { /* DB unavailable — fall back to token role */ }
    if (!roles.includes(req.localUser.role)) return res.status(403).json({ error: 'Admin access required' });
    next();
  };
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken, signReceiptTicket, verifyReceiptTicket, authMiddleware, requireRole };
